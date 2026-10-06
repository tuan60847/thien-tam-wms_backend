import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { AppException } from '../common/errors/app.exception.js';
import { ViTriService } from '../kho-vi-tri/vi-tri.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TyLeQuyDoiService } from '../ty-le-quy-doi/ty-le-quy-doi.service.js';
import { TonKhoQueryService } from './ton-kho-query.service.js';
import type {
  ChuyenViTriDto,
  ChuyenViTriResponseDto,
  DieuChinhTonKhoDto,
  TonKhoResponseDto,
} from './dto/ton-kho.dto.js';
import { assertColdChain } from './ton-kho.rules.js';
import type { StockMove, StockRow } from './ton-kho.types.js';

const INT_MAX = 2_147_483_647;

@Injectable()
export class TonKhoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly viTri: ViTriService,
    private readonly units: TyLeQuyDoiService,
    private readonly query: TonKhoQueryService,
    private readonly audit: AuditService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(TonKhoService.name);
  }

  // ===========================================================================
  // The ONLY write path for TonKho. Every call writes one BienDongTonKho row in the
  // same transaction, so TonKho.soLuong always equals the sum of its movements.
  // ===========================================================================

  async increase(
    move: StockMove,
    actor: AuthenticatedUser | null,
    tx: Prisma.TransactionClient,
  ): Promise<StockRow> {
    this.assertQuantity(move.soLuongCoBan);
    const soLo = await this.loadLot(move.soLoId, tx);
    const viTri = move.boQuaKiemTraViTriHoatDong
      ? await this.viTri.findByIdOrThrow(move.viTriId, tx)
      : await this.viTri.assertReceivable(move.viTriId, tx);
    assertColdChain(soLo.hangHoa, viTri);

    // One atomic statement: creating the row for the first time must not race with a
    // concurrent increase (a read-then-insert would double-create or lose an addition).
    await tx.$executeRaw`
      INSERT INTO ton_kho (id, so_luong, updated_at, so_lo_id, vi_tri_id)
      VALUES (${randomUUID()}, ${move.soLuongCoBan}, UTC_TIMESTAMP(3), ${move.soLoId}, ${move.viTriId})
      ON DUPLICATE KEY UPDATE so_luong = so_luong + ${move.soLuongCoBan}, updated_at = UTC_TIMESTAMP(3)`;
    const row = await tx.tonKho.findUniqueOrThrow({
      where: { soLoId_viTriId: { soLoId: move.soLoId, viTriId: move.viTriId } },
    });
    await this.recordMovement(move, move.soLuongCoBan, row.soLuong, actor, tx);
    return { id: row.id, soLuong: row.soLuong };
  }

  async decrease(
    move: StockMove,
    actor: AuthenticatedUser | null,
    tx: Prisma.TransactionClient,
  ): Promise<StockRow> {
    this.assertQuantity(move.soLuongCoBan);
    // Conditional atomic decrement: never read-then-write. Two concurrent decreases of the
    // same row serialise on the row lock and the second one sees the reduced quantity.
    const { count } = await tx.tonKho.updateMany({
      where: {
        soLoId: move.soLoId,
        viTriId: move.viTriId,
        soLuong: { gte: move.soLuongCoBan },
      },
      data: { soLuong: { decrement: move.soLuongCoBan } },
    });
    if (count !== 1) {
      const current = await tx.tonKho.findUnique({
        where: {
          soLoId_viTriId: { soLoId: move.soLoId, viTriId: move.viTriId },
        },
      });
      const conLai = current?.soLuong ?? 0;
      throw new AppException('TON_KHO_INSUFFICIENT', {
        params: { conLai },
        details: {
          soLoId: move.soLoId,
          viTriId: move.viTriId,
          conLai,
          canLay: move.soLuongCoBan,
        },
      });
    }
    const row = await tx.tonKho.findUniqueOrThrow({
      where: { soLoId_viTriId: { soLoId: move.soLoId, viTriId: move.viTriId } },
    });
    await this.recordMovement(move, -move.soLuongCoBan, row.soLuong, actor, tx);
    return { id: row.id, soLuong: row.soLuong };
  }

  async getQuantity(
    soLoId: string,
    viTriId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const row = await (tx ?? this.prisma).tonKho.findUnique({
      where: { soLoId_viTriId: { soLoId, viTriId } },
    });
    return row?.soLuong ?? 0;
  }

  // ===========================================================================
  // Operations
  // ===========================================================================

  async chuyenViTri(
    dto: ChuyenViTriDto,
    actor: AuthenticatedUser,
  ): Promise<ChuyenViTriResponseDto> {
    if (dto.tuViTriId === dto.denViTriId) {
      throw new AppException('TON_KHO_SAME_LOCATION');
    }
    const ids = await this.prisma.$transaction(async (tx) => {
      const soLo = await this.loadLot(dto.soLoId, tx);
      await this.viTri.findByIdOrThrow(dto.tuViTriId, tx);
      const dest = await this.viTri.assertReceivable(dto.denViTriId, tx);
      assertColdChain(soLo.hangHoa, dest);

      const soLuongCoBan = await this.units.toBase(
        soLo.hangHoaId,
        dto.soLuong,
        dto.donViTinh,
        tx,
      );
      const thamChieu = { loai: 'chuyen_vi_tri', id: randomUUID() };
      const from = await this.decrease(
        {
          soLoId: dto.soLoId,
          viTriId: dto.tuViTriId,
          soLuongCoBan,
          loai: 'chuyen_di',
          thamChieu,
          lyDo: dto.lyDo,
        },
        actor,
        tx,
      );
      const to = await this.increase(
        {
          soLoId: dto.soLoId,
          viTriId: dto.denViTriId,
          soLuongCoBan,
          loai: 'chuyen_den',
          thamChieu,
          lyDo: dto.lyDo,
        },
        actor,
        tx,
      );
      await this.audit.record(
        {
          hanhDong: 'ton_kho.transfer',
          doiTuong: 'ton_kho',
          doiTuongId: thamChieu.id,
          truoc: { tuViTriId: dto.tuViTriId, denViTriId: dto.denViTriId },
          sau: {
            soLoId: dto.soLoId,
            soLuongCoBan,
            tonNguon: from.soLuong,
            tonDich: to.soLuong,
          },
          lyDo: dto.lyDo ?? null,
        },
        tx,
      );
      return { from: from.id, to: to.id };
    });
    const [tu, den] = await Promise.all([
      this.query.findOne(ids.from),
      this.query.findOne(ids.to),
    ]);
    return { tu, den };
  }

  async dieuChinh(
    dto: DieuChinhTonKhoDto,
    actor: AuthenticatedUser,
  ): Promise<TonKhoResponseDto> {
    const id = await this.prisma.$transaction(async (tx) => {
      const soLo = await this.loadLot(dto.soLoId, tx);
      const current = await tx.tonKho.findUnique({
        where: { soLoId_viTriId: { soLoId: dto.soLoId, viTriId: dto.viTriId } },
      });
      const before = current?.soLuong ?? 0;
      const delta = dto.soLuongMoi - before;
      if (delta === 0) {
        throw new AppException('TON_KHO_ADJUST_NO_CHANGE');
      }

      const viTri =
        delta > 0
          ? await this.viTri.assertReceivable(dto.viTriId, tx)
          : await this.viTri.findByIdOrThrow(dto.viTriId, tx);
      if (delta > 0) {
        assertColdChain(soLo.hangHoa, viTri);
      }

      let rowId: string;
      if (current) {
        // Guarded by the quantity we read: if anyone changed it meanwhile, count is 0.
        const { count } = await tx.tonKho.updateMany({
          where: { id: current.id, soLuong: before },
          data: { soLuong: dto.soLuongMoi },
        });
        if (count !== 1) {
          throw new AppException('COMMON_CONCURRENT_UPDATE');
        }
        rowId = current.id;
      } else {
        try {
          rowId = (
            await tx.tonKho.create({
              data: {
                soLoId: dto.soLoId,
                viTriId: dto.viTriId,
                soLuong: dto.soLuongMoi,
              },
            })
          ).id;
        } catch (error) {
          if ((error as { code?: string }).code === 'P2002') {
            throw new AppException('COMMON_CONCURRENT_UPDATE');
          }
          throw error;
        }
      }
      await this.recordMovement(
        {
          soLoId: dto.soLoId,
          viTriId: dto.viTriId,
          soLuongCoBan: Math.abs(delta),
          loai: 'dieu_chinh',
          lyDo: dto.lyDo,
        },
        delta,
        dto.soLuongMoi,
        actor,
        tx,
      );
      await this.audit.record(
        {
          hanhDong: 'ton_kho.adjust',
          doiTuong: 'ton_kho',
          doiTuongId: rowId,
          truoc: { soLuong: before },
          sau: { soLuong: dto.soLuongMoi },
          lyDo: dto.lyDo,
        },
        tx,
      );
      return rowId;
    });
    return this.query.findOne(id);
  }

  // ===========================================================================
  // helpers
  // ===========================================================================

  private assertQuantity(n: number): void {
    if (!Number.isInteger(n) || n < 1 || n > INT_MAX) {
      throw new AppException('VALIDATION_FAILED', {
        details: [
          { field: 'soLuong', messages: ['Số lượng phải là số nguyên dương'] },
        ],
      });
    }
  }

  private async loadLot(id: string, tx: Prisma.TransactionClient) {
    const soLo = await tx.soLo.findUnique({
      where: { id },
      include: { hangHoa: { select: { id: true, isCanGiuLanh: true } } },
    });
    if (!soLo) {
      throw new AppException('SO_LO_NOT_FOUND');
    }
    return soLo;
  }

  private async recordMovement(
    move: StockMove,
    soLuongThayDoi: number,
    soLuongSau: number,
    actor: AuthenticatedUser | null,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.bienDongTonKho.create({
      data: {
        soLoId: move.soLoId,
        viTriId: move.viTriId,
        loai: move.loai,
        soLuongThayDoi,
        soLuongSau,
        loaiThamChieu: move.thamChieu?.loai ?? null,
        thamChieuId: move.thamChieu?.id ?? null,
        lyDo: move.lyDo ?? null,
        createdById: actor?.id ?? null,
      },
    });
    this.logger.info(
      {
        event: 'stock.changed',
        soLoId: move.soLoId,
        viTriId: move.viTriId,
        loai: move.loai,
        soLuongThayDoi,
        soLuongSau,
        thamChieu: move.thamChieu ?? null,
      },
      'stock changed',
    );
  }
}
