import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type ChiTietPhieuXuatHang,
  type TrangThaiPhieuNhap,
} from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { AuditService } from '../audit/audit.service.js';
import { ROLE } from '../auth/roles.constants.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { ClockService } from '../common/clock/clock.service.js';
import { parseDateOnly } from '../common/clock/vn-date.js';
import { CodeGeneratorService } from '../common/code-generator/code-generator.service.js';
import { CODE, formatLineCode } from '../common/code-generator/code-specs.js';
import type { HuyPhieuDto } from '../common/dto/huy-phieu.dto.js';
import { AppException } from '../common/errors/app.exception.js';
import { percentOf } from '../common/money.js';
import {
  paginate,
  parseSort,
  toOrderBy,
  type PagedResponse,
} from '../common/pagination/paginate.js';
import { ViTriService } from '../kho-vi-tri/vi-tri.service.js';
import { PhieuXuatHangService } from '../phieu-xuat-hang/phieu-xuat-hang.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TonKhoService } from '../ton-kho/ton-kho.service.js';
import { assertColdChain } from '../ton-kho/ton-kho.rules.js';
import { TyLeQuyDoiService } from '../ty-le-quy-doi/ty-le-quy-doi.service.js';
import { toBaseQuantity } from '../ty-le-quy-doi/unit-conversion.js';
import type {
  ChiTietTraLaiDto,
  CreateTraLaiDto,
  QueryTraLaiDto,
  TraLaiListItemDto,
  TraLaiResponseDto,
  UpdateTraLaiDto,
} from './dto/tra-lai.dto.js';
import {
  toTraLaiListItem,
  toTraLaiResponse,
  traLaiDetailInclude,
  traLaiListInclude,
} from './tra-lai-hang-ban.mapper.js';
import {
  assertTransition,
  returnableQuantity,
} from './tra-lai-hang-ban.rules.js';

const SORT_WHITELIST = ['createdAt', 'ngayTraLai', 'maTraLai'] as const;
const REFERENCE_TYPE = 'tra_lai_hang_ban';

interface PreparedLine {
  chiTietPhieuXuatHangId: string;
  soLoId: string;
  viTriId: string;
  donViTinh: string;
  heSoQuyDoi: number;
  soLuong: number;
  soLuongCoBan: number;
  donGia: Prisma.Decimal;
  tyLeChietKhau: Prisma.Decimal;
  tienChietKhau: Prisma.Decimal;
}

@Injectable()
export class TraLaiHangBanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: CodeGeneratorService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    private readonly phieuXuat: PhieuXuatHangService,
    private readonly viTri: ViTriService,
    private readonly units: TyLeQuyDoiService,
    private readonly tonKho: TonKhoService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(TraLaiHangBanService.name);
  }

  // ===========================================================================
  // Queries
  // ===========================================================================

  findAll(query: QueryTraLaiDto): Promise<PagedResponse<TraLaiListItemDto>> {
    const where: Prisma.TraLaiHangBanWhereInput = {
      khachHangId: query.khachHangId,
      phieuXuatHangId: query.phieuXuatHangId,
      trangThai: query.trangThai ? { in: query.trangThai } : undefined,
      ngayTraLai:
        query.ngayTraLaiFrom || query.ngayTraLaiTo
          ? {
              gte: query.ngayTraLaiFrom
                ? parseDateOnly(query.ngayTraLaiFrom)
                : undefined,
              lte: query.ngayTraLaiTo
                ? parseDateOnly(query.ngayTraLaiTo)
                : undefined,
            }
          : undefined,
      OR: query.q
        ? [
            { maTraLai: { contains: query.q } },
            { khachHang: { tenKH: { contains: query.q } } },
            { khachHang: { maKH: { contains: query.q } } },
          ]
        : undefined,
    };
    const orderBy = toOrderBy(
      parseSort(query.sort, SORT_WHITELIST, [
        { field: 'createdAt', direction: 'desc' },
      ]),
    ) as Prisma.TraLaiHangBanOrderByWithRelationInput[];
    return paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.traLaiHangBan.findMany({
          where,
          orderBy,
          skip,
          take,
          include: traLaiListInclude,
        }),
      count: () => this.prisma.traLaiHangBan.count({ where }),
      map: toTraLaiListItem,
    });
  }

  async findOne(id: string): Promise<TraLaiResponseDto> {
    const row = await this.prisma.traLaiHangBan.findUnique({
      where: { id },
      include: traLaiDetailInclude,
    });
    if (!row) {
      throw new AppException('TRA_LAI_NOT_FOUND');
    }
    return toTraLaiResponse(row);
  }

  // ===========================================================================
  // Draft lifecycle
  // ===========================================================================

  async create(
    dto: CreateTraLaiDto,
    actor: AuthenticatedUser,
  ): Promise<TraLaiResponseDto> {
    const id = await this.prisma.$transaction(async (tx) => {
      const order = await this.loadReturnableOrder(dto.phieuXuatHangId, tx);
      const ngayTraLai = this.returnDate(dto.ngayTraLai, order.ngayXuatKho);
      const lines = await this.prepareLines(
        order.id,
        dto.chiTiet ?? [],
        null,
        tx,
      );

      const ma = await this.codes.next(CODE.TRA_LAI, tx);
      const created = await tx.traLaiHangBan.create({
        data: {
          maTraLai: ma,
          ngayTraLai,
          lyDo: dto.lyDo ?? null,
          ghiChu: dto.ghiChu ?? null,
          khachHangId: order.khachHangId,
          phieuXuatHangId: order.id,
          createdById: actor.id,
          chiTiets: { create: this.lineData(ma, lines) },
        },
      });
      return created.id;
    });
    return this.findOne(id);
  }

  async update(id: string, dto: UpdateTraLaiDto): Promise<TraLaiResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockDraft(id, tx);
      const current = await tx.traLaiHangBan.findUniqueOrThrow({
        where: { id },
        include: { phieuXuatHang: { select: { ngayXuatKho: true } } },
      });
      const orderId = current.phieuXuatHangId!;
      await this.loadReturnableOrder(orderId, tx);

      if (dto.chiTiet !== undefined) {
        const lines = await this.prepareLines(orderId, dto.chiTiet, id, tx);
        await tx.chiTietTraLai.deleteMany({ where: { traLaiId: id } });
        await tx.chiTietTraLai.createMany({
          data: this.lineData(current.maTraLai, lines).map((line) => ({
            ...line,
            traLaiId: id,
          })),
        });
      }
      await tx.traLaiHangBan.update({
        where: { id },
        data: {
          ngayTraLai:
            dto.ngayTraLai === undefined || dto.ngayTraLai === null
              ? undefined
              : this.returnDate(
                  dto.ngayTraLai,
                  current.phieuXuatHang?.ngayXuatKho ?? null,
                ),
          lyDo: dto.lyDo,
          ghiChu: dto.ghiChu,
        },
      });
    });
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockDraft(id, tx);
      await tx.chiTietTraLai.deleteMany({ where: { traLaiId: id } });
      await tx.traLaiHangBan.delete({ where: { id } });
    });
  }

  // ===========================================================================
  // Confirm / cancel
  // ===========================================================================

  async confirm(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<TraLaiResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      // The conditional update is the first statement: it locks the return, so two
      // concurrent confirmations cannot both put the goods back.
      const { count } = await tx.traLaiHangBan.updateMany({
        where: { id, trangThai: 'cho_xac_nhan' },
        data: { trangThai: 'da_nhap_kho', xacNhanAt: this.clock.now() },
      });
      if (count !== 1) {
        await this.throwWrongState(id, tx);
      }
      const phieu = await tx.traLaiHangBan.findUniqueOrThrow({
        where: { id },
        include: { chiTiets: true },
      });
      if (phieu.chiTiets.length === 0) {
        throw new AppException('TRA_LAI_EMPTY');
      }
      // Lock the order (same lock the receipts take) before looking at its debt.
      await tx.$queryRaw`SELECT id FROM phieu_xuat_hang WHERE id = ${phieu.phieuXuatHangId} FOR UPDATE`;
      await this.loadReturnableOrder(phieu.phieuXuatHangId!, tx);
      // Quantities are re-checked against the *other* confirmed returns.
      await this.prepareLines(
        phieu.phieuXuatHangId!,
        phieu.chiTiets.map((l) => ({
          chiTietPhieuXuatHangId: l.chiTietPhieuXuatHangId!,
          viTriId: l.viTriId,
          donViTinh: l.donViTinh,
          soLuong: l.soLuong,
          donGia: l.donGia.toFixed(2),
          tyLeChietKhau: l.tyLeChietKhau.toFixed(2),
        })),
        id,
        tx,
        'da_nhap_kho',
      );

      // The goods are worth more than what is still owed: money would have to go back.
      const { conNo } = await this.phieuXuat.getReceivableSummary(
        phieu.phieuXuatHangId!,
        tx,
      );
      if (conNo.lt(0)) {
        throw new AppException('TRA_LAI_EXCEEDS_DEBT');
      }

      const ordered = [...phieu.chiTiets].sort((a, b) =>
        `${a.soLoId}|${a.viTriId}`.localeCompare(`${b.soLoId}|${b.viTriId}`),
      );
      for (const line of ordered) {
        await this.tonKho.increase(
          {
            soLoId: line.soLoId,
            viTriId: line.viTriId,
            soLuongCoBan: line.soLuongCoBan,
            loai: 'tra_hang',
            thamChieu: { loai: REFERENCE_TYPE, id },
            lyDo: phieu.lyDo ?? undefined,
          },
          actor,
          tx,
        );
      }
    });
    this.logger.info(
      { event: 'tra_lai.confirmed', traLaiId: id },
      'return confirmed',
    );
    return this.findOne(id);
  }

  async cancel(
    id: string,
    dto: HuyPhieuDto,
    actor: AuthenticatedUser,
  ): Promise<TraLaiResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ trang_thai: TrangThaiPhieuNhap }[]>`
        SELECT trang_thai FROM tra_lai_hang_ban WHERE id = ${id} FOR UPDATE`;
      const from = locked[0]?.trang_thai;
      if (!from) {
        throw new AppException('TRA_LAI_NOT_FOUND');
      }
      assertTransition(from, 'da_huy');
      const afterReceipt = from === 'da_nhap_kho';
      if (afterReceipt && !this.isManager(actor)) {
        throw new AppException('AUTH_FORBIDDEN');
      }
      await tx.traLaiHangBan.update({
        where: { id },
        data: {
          trangThai: 'da_huy',
          huyAt: this.clock.now(),
          lyDoHuy: dto.lyDo,
        },
      });
      if (afterReceipt) {
        await this.takeGoodsBackOut(id, actor, tx);
      }
      await this.audit.record(
        {
          hanhDong: afterReceipt
            ? 'tra_lai.cancel_after_receipt'
            : 'tra_lai.cancel',
          doiTuong: 'tra_lai_hang_ban',
          doiTuongId: id,
          truoc: { trangThai: from },
          sau: { trangThai: 'da_huy' },
          lyDo: dto.lyDo,
        },
        tx,
      );
    });
    return this.findOne(id);
  }

  // ===========================================================================
  // helpers
  // ===========================================================================

  private isManager(actor: AuthenticatedUser): boolean {
    const role = actor.role?.maRole;
    return role === ROLE.ADMIN || role === ROLE.QUAN_LY_KHO;
  }

  private async lockDraft(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const { count } = await tx.traLaiHangBan.updateMany({
      where: { id, trangThai: 'cho_xac_nhan' },
      data: { updatedAt: this.clock.now() },
    });
    if (count !== 1) {
      await this.throwWrongState(id, tx);
    }
  }

  private async throwWrongState(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<never> {
    const row = await tx.traLaiHangBan.findUnique({
      where: { id },
      select: { id: true },
    });
    throw new AppException(row ? 'TRA_LAI_INVALID_STATE' : 'TRA_LAI_NOT_FOUND');
  }

  private async loadReturnableOrder(id: string, tx: Prisma.TransactionClient) {
    const order = await tx.phieuXuatHang.findUnique({
      where: { id },
      select: {
        id: true,
        khachHangId: true,
        trangThai: true,
        ngayXuatKho: true,
      },
    });
    if (!order) {
      throw new AppException('PHIEU_XUAT_NOT_FOUND');
    }
    if (order.trangThai !== 'da_xuat_kho' && order.trangThai !== 'da_giao') {
      throw new AppException('TRA_LAI_ORDER_INVALID');
    }
    return order;
  }

  // Return date: not in the future and not before the goods left the warehouse.
  private returnDate(
    value: string | null | undefined,
    ngayXuatKho: Date | null,
  ): Date {
    const today = this.clock.today();
    const date = value ? parseDateOnly(value) : today;
    if (
      date.getTime() > today.getTime() ||
      (ngayXuatKho !== null && date.getTime() < ngayXuatKho.getTime())
    ) {
      throw new AppException('TRA_LAI_DATE_INVALID');
    }
    return date;
  }

  private lineData(maPhieu: string, lines: PreparedLine[]) {
    return lines.map((line, index) => ({
      maChiTiet: formatLineCode(maPhieu, index + 1),
      ...line,
    }));
  }

  // Validates return lines against the sold lines of the order. `countStatus` limits which
  // other returns already use up the sold quantity: drafts and confirmed ones when drafting,
  // only confirmed ones when confirming.
  private async prepareLines(
    orderId: string,
    input: ChiTietTraLaiDto[],
    exceptReturnId: string | null,
    tx: Prisma.TransactionClient,
    countStatus: 'cho_xac_nhan' | 'da_nhap_kho' = 'cho_xac_nhan',
  ): Promise<PreparedLine[]> {
    const sold = new Map<string, ChiTietPhieuXuatHang>(
      (
        await tx.chiTietPhieuXuatHang.findMany({
          where: {
            phieuXuatHangId: orderId,
            id: { in: input.map((l) => l.chiTietPhieuXuatHangId) },
          },
        })
      ).map((l) => [l.id, l]),
    );
    const statuses: TrangThaiPhieuNhap[] =
      countStatus === 'da_nhap_kho'
        ? ['da_nhap_kho']
        : ['cho_xac_nhan', 'da_nhap_kho'];
    const used = await tx.chiTietTraLai.groupBy({
      by: ['chiTietPhieuXuatHangId'],
      where: {
        chiTietPhieuXuatHangId: { in: [...sold.keys()] },
        traLai: {
          trangThai: { in: statuses },
          ...(exceptReturnId ? { id: { not: exceptReturnId } } : {}),
        },
      },
      _sum: { soLuongCoBan: true },
    });
    const usedBy = new Map(
      used.map((u) => [u.chiTietPhieuXuatHangId, u._sum.soLuongCoBan ?? 0]),
    );

    const seen = new Set<string>();
    const result: PreparedLine[] = [];
    const returnedNow = new Map<string, number>();
    for (const [index, line] of input.entries()) {
      const field = `chiTiet[${index}]`;
      const original = sold.get(line.chiTietPhieuXuatHangId);
      if (!original || seen.has(original.id)) {
        throw new AppException('TRA_LAI_LINE_INVALID', { details: { field } });
      }
      seen.add(original.id);

      const donViTinh = line.donViTinh ?? original.donViTinh;
      const unit = await this.units.resolveUnit(
        await this.productOfLot(original.soLoId, tx),
        donViTinh,
        tx,
      );
      if (!unit) {
        throw new AppException('TRA_LAI_UNIT_INVALID', { details: { field } });
      }
      const soLuongCoBan = toBaseQuantity(line.soLuong, unit.heSoQuyDoi);
      const conLai = returnableQuantity(
        original.soLuongCoBan,
        usedBy.get(original.id) ?? 0,
      );
      if (soLuongCoBan > conLai) {
        throw new AppException('TRA_LAI_QUANTITY_EXCEEDED', {
          params: { conLai },
          details: { field, conLai, canTra: soLuongCoBan },
        });
      }
      returnedNow.set(original.id, soLuongCoBan);

      const sameUnit = unit.donViTinh === original.donViTinh;
      if (!line.donGia && !sameUnit) {
        throw new AppException('VALIDATION_FAILED', {
          details: [
            {
              field: `${field}.donGia`,
              messages: ['Cần nhập đơn giá khi đổi đơn vị tính'],
            },
          ],
        });
      }
      const donGia = line.donGia
        ? new Prisma.Decimal(line.donGia)
        : original.donGia;
      const tyLeChietKhau = new Prisma.Decimal(
        line.tyLeChietKhau ?? original.tyLeChietKhau.toFixed(2),
      );

      const viTriId = line.viTriId ?? original.viTriId;
      const location = await this.viTri.assertReceivable(viTriId, tx);
      const lot = await tx.soLo.findUniqueOrThrow({
        where: { id: original.soLoId },
        include: { hangHoa: { select: { isCanGiuLanh: true } } },
      });
      assertColdChain(lot.hangHoa, location);

      result.push({
        chiTietPhieuXuatHangId: original.id,
        soLoId: original.soLoId,
        viTriId,
        donViTinh: unit.donViTinh,
        heSoQuyDoi: unit.heSoQuyDoi,
        soLuong: line.soLuong,
        soLuongCoBan,
        donGia,
        tyLeChietKhau,
        tienChietKhau: percentOf(donGia.mul(line.soLuong), tyLeChietKhau),
      });
    }
    return result;
  }

  private async productOfLot(
    soLoId: string,
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const lot = await tx.soLo.findUniqueOrThrow({
      where: { id: soLoId },
      select: { hangHoaId: true },
    });
    return lot.hangHoaId;
  }

  // Cancelling a received return takes the goods out again; fails as a whole if any is gone.
  private async takeGoodsBackOut(
    id: string,
    actor: AuthenticatedUser,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const lines = await tx.chiTietTraLai.findMany({
      where: { traLaiId: id },
      orderBy: [{ soLoId: 'asc' }, { viTriId: 'asc' }],
    });
    const missing: { maChiTiet: string; conLai: number; canTra: number }[] = [];
    for (const line of lines) {
      try {
        await this.tonKho.decrease(
          {
            soLoId: line.soLoId,
            viTriId: line.viTriId,
            soLuongCoBan: line.soLuongCoBan,
            loai: 'tra_hang',
            thamChieu: { loai: REFERENCE_TYPE, id },
            lyDo: 'Hủy phiếu trả lại hàng',
          },
          actor,
          tx,
        );
      } catch (error) {
        if (
          error instanceof AppException &&
          error.code === 'TON_KHO_INSUFFICIENT'
        ) {
          missing.push({
            maChiTiet: line.maChiTiet,
            conLai: Number(
              (error.details as { conLai?: number } | undefined)?.conLai ?? 0,
            ),
            canTra: line.soLuongCoBan,
          });
          continue;
        }
        throw error;
      }
    }
    if (missing.length > 0) {
      throw new AppException('TRA_LAI_CANNOT_REVERSE', {
        details: { dong: missing },
      });
    }
  }
}
