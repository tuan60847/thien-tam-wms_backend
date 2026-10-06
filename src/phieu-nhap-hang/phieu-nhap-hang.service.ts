import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Prisma, type TrangThaiPhieuNhap } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { AuditService } from '../audit/audit.service.js';
import { ROLE } from '../auth/roles.constants.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { ClockService } from '../common/clock/clock.service.js';
import { CodeGeneratorService } from '../common/code-generator/code-generator.service.js';
import { CODE, formatLineCode } from '../common/code-generator/code-specs.js';
import { parseDateOnly } from '../common/clock/vn-date.js';
import { HuyPhieuDto } from '../common/dto/huy-phieu.dto.js';
import { AppException } from '../common/errors/app.exception.js';
import { ZERO } from '../common/money.js';
import {
  dateRangeFilter,
  paginate,
  parseSort,
  toOrderBy,
  type PagedResponse,
} from '../common/pagination/paginate.js';
import { appConfig } from '../config/app.config.js';
import { HangHoaService } from '../hang-hoa/hang-hoa.service.js';
import { ViTriService } from '../kho-vi-tri/vi-tri.service.js';
import { NhaCungCapService } from '../nha-cung-cap/nha-cung-cap.service.js';
import { PhuongTienService } from '../phuong-tien-van-chuyen/phuong-tien.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SoLoService } from '../so-lo/so-lo.service.js';
import { TonKhoService } from '../ton-kho/ton-kho.service.js';
import { assertColdChain } from '../ton-kho/ton-kho.rules.js';
import { TyLeQuyDoiService } from '../ty-le-quy-doi/ty-le-quy-doi.service.js';
import { toBaseQuantity } from '../ty-le-quy-doi/unit-conversion.js';
import type {
  ChiTietNhapDto,
  CreatePhieuNhapDto,
  PhieuNhapListItemDto,
  PhieuNhapResponseDto,
  QueryPhieuNhapDto,
  UpdatePhieuNhapDto,
  XacNhanNhapDto,
} from './dto/phieu-nhap.dto.js';
import {
  phieuNhapDetailInclude,
  phieuNhapListInclude,
  toPhieuNhapListItem,
  toPhieuNhapResponse,
} from './phieu-nhap-hang.mapper.js';
import {
  assertEditable,
  assertTransition,
  computeTotals,
} from './phieu-nhap-hang.rules.js';

const SORT_WHITELIST = [
  'createdAt',
  'ngayNhanHang',
  'maPhieuNhapHang',
] as const;
const REFERENCE_TYPE = 'phieu_nhap_hang';

interface PreparedLine {
  soLoId: string;
  viTriId: string;
  donViTinh: string;
  heSoQuyDoi: number;
  soLuong: number;
  soLuongCoBan: number;
  donGia: Prisma.Decimal;
}

const invalid = (field: string, message: string) =>
  new AppException('VALIDATION_FAILED', {
    details: [{ field, messages: [message] }],
  });

@Injectable()
export class PhieuNhapHangService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: CodeGeneratorService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    private readonly nhaCungCap: NhaCungCapService,
    private readonly phuongTien: PhuongTienService,
    private readonly soLo: SoLoService,
    private readonly hangHoa: HangHoaService,
    private readonly viTri: ViTriService,
    private readonly units: TyLeQuyDoiService,
    private readonly tonKho: TonKhoService,
    private readonly logger: PinoLogger,
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {
    this.logger.setContext(PhieuNhapHangService.name);
  }

  // ===========================================================================
  // Queries
  // ===========================================================================

  async findAll(
    query: QueryPhieuNhapDto,
  ): Promise<PagedResponse<PhieuNhapListItemDto>> {
    const ids = query.trangThaiThanhToan
      ? await this.idsByPaymentStatus(query.trangThaiThanhToan)
      : undefined;
    const where: Prisma.PhieuNhapHangWhereInput = {
      id: ids ? { in: ids } : undefined,
      nhaCungCapId: query.nhaCungCapId,
      trangThai: query.trangThai ? { in: query.trangThai } : undefined,
      createdById: query.createdById,
      createdAt: dateRangeFilter(query.createdAtFrom, query.createdAtTo),
      ngayNhanHang:
        query.ngayNhanHangFrom || query.ngayNhanHangTo
          ? {
              gte: query.ngayNhanHangFrom
                ? parseDateOnly(query.ngayNhanHangFrom)
                : undefined,
              lte: query.ngayNhanHangTo
                ? parseDateOnly(query.ngayNhanHangTo)
                : undefined,
            }
          : undefined,
      chiTietPhieuNhapHangs: query.hangHoaId
        ? { some: { soLo: { hangHoaId: query.hangHoaId } } }
        : undefined,
      OR: query.q
        ? [
            { maPhieuNhapHang: { contains: query.q } },
            { nhaCungCap: { tenNCC: { contains: query.q } } },
            { nhaCungCap: { maNCC: { contains: query.q } } },
          ]
        : undefined,
    };
    const orderBy = toOrderBy(
      parseSort(query.sort, SORT_WHITELIST, [
        { field: 'createdAt', direction: 'desc' },
      ]),
    ) as Prisma.PhieuNhapHangOrderByWithRelationInput[];

    return paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.phieuNhapHang.findMany({
          where,
          orderBy,
          skip,
          take,
          include: phieuNhapListInclude,
        }),
      count: () => this.prisma.phieuNhapHang.count({ where }),
      map: toPhieuNhapListItem,
    });
  }

  async findOne(id: string): Promise<PhieuNhapResponseDto> {
    const row = await this.prisma.phieuNhapHang.findUnique({
      where: { id },
      include: phieuNhapDetailInclude,
    });
    if (!row) {
      throw new AppException('PHIEU_NHAP_NOT_FOUND');
    }
    return toPhieuNhapResponse(
      row,
      this.clock.today(),
      this.config.expiryWarningDays,
    );
  }

  // ===========================================================================
  // Draft lifecycle
  // ===========================================================================

  async create(
    dto: CreatePhieuNhapDto,
    actor: AuthenticatedUser,
  ): Promise<PhieuNhapResponseDto> {
    const id = await this.prisma.$transaction(async (tx) => {
      const ncc = await this.nhaCungCap.findByIdOrThrow(dto.nhaCungCapId, tx);
      this.nhaCungCap.assertCanSupply(ncc);
      const prepared = await this.prepareLines(dto.chiTiet ?? [], actor, tx);
      await this.assertVehicle(dto.phuongTienVanChuyenId, prepared.hasCold, tx);

      const ma = await this.codes.next(CODE.PHIEU_NHAP, tx);
      const created = await tx.phieuNhapHang.create({
        data: {
          maPhieuNhapHang: ma,
          nhaCungCapId: dto.nhaCungCapId,
          phuongTienVanChuyenId: dto.phuongTienVanChuyenId ?? null,
          ngayNhanHang: dto.ngayNhanHang
            ? parseDateOnly(dto.ngayNhanHang)
            : null,
          ghiChu: dto.ghiChu ?? null,
          createdById: actor.id,
          updatedById: actor.id,
          chiTietPhieuNhapHangs: { create: this.lineData(ma, prepared.lines) },
        },
      });
      return created.id;
    });
    return this.findOne(id);
  }

  async update(
    id: string,
    dto: UpdatePhieuNhapDto,
    actor: AuthenticatedUser,
  ): Promise<PhieuNhapResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      // First statement of the transaction: takes the row lock and proves it is still a draft.
      await this.lockDraft(id, actor, tx);
      const current = await tx.phieuNhapHang.findUniqueOrThrow({
        where: { id },
      });

      const nhaCungCapId = dto.nhaCungCapId ?? current.nhaCungCapId;
      const ncc = await this.nhaCungCap.findByIdOrThrow(nhaCungCapId, tx);
      this.nhaCungCap.assertCanSupply(ncc);

      let hasCold: boolean;
      if (dto.chiTiet !== undefined) {
        const prepared = await this.prepareLines(dto.chiTiet, actor, tx);
        await tx.chiTietPhieuNhapHang.deleteMany({
          where: { phieuNhapHangId: id },
        });
        await tx.chiTietPhieuNhapHang.createMany({
          data: this.lineData(current.maPhieuNhapHang, prepared.lines).map(
            (line) => ({ ...line, phieuNhapHangId: id }),
          ),
        });
        hasCold = prepared.hasCold;
      } else {
        hasCold = await this.hasColdLines(id, tx);
      }
      const phuongTienId =
        dto.phuongTienVanChuyenId === undefined
          ? current.phuongTienVanChuyenId
          : dto.phuongTienVanChuyenId;
      await this.assertVehicle(phuongTienId, hasCold, tx);

      await tx.phieuNhapHang.update({
        where: { id },
        data: {
          nhaCungCapId,
          phuongTienVanChuyenId: phuongTienId,
          ngayNhanHang:
            dto.ngayNhanHang === undefined
              ? undefined
              : dto.ngayNhanHang === null
                ? null
                : parseDateOnly(dto.ngayNhanHang),
          ghiChu: dto.ghiChu,
          updatedById: actor.id,
        },
      });
    });
    return this.findOne(id);
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockDraft(id, actor, tx);
      const phieu = await tx.phieuNhapHang.findUniqueOrThrow({
        where: { id },
        include: { chiTietPhieuNhapHangs: { select: { soLoId: true } } },
      });
      await tx.chiTietPhieuNhapHang.deleteMany({
        where: { phieuNhapHangId: id },
      });
      await tx.phieuNhapHang.delete({ where: { id } });
      await this.removeOrphanLots(
        phieu.chiTietPhieuNhapHangs.map((l) => l.soLoId),
        phieu,
        tx,
      );
    });
  }

  // ===========================================================================
  // Confirm / cancel
  // ===========================================================================

  async confirm(
    id: string,
    dto: XacNhanNhapDto,
    actor: AuthenticatedUser,
  ): Promise<PhieuNhapResponseDto> {
    const today = this.clock.today();
    const ngayNhanHang = dto.ngayNhanHang
      ? parseDateOnly(dto.ngayNhanHang)
      : today;
    if (ngayNhanHang.getTime() > today.getTime()) {
      throw new AppException('PHIEU_NHAP_DATE_INVALID');
    }

    await this.prisma.$transaction(async (tx) => {
      // The conditional update is the first statement: it locks the row, so a second
      // concurrent confirmation waits and then finds it is no longer a draft.
      const { count } = await tx.phieuNhapHang.updateMany({
        where: { id, trangThai: 'cho_xac_nhan' },
        data: {
          trangThai: 'da_nhap_kho',
          xacNhanAt: this.clock.now(),
          xacNhanById: actor.id,
          updatedById: actor.id,
          ngayNhanHang,
          ghiChu: dto.ghiChu,
        },
      });
      if (count !== 1) {
        await this.throwNotDraft(id, tx);
      }

      const phieu = await tx.phieuNhapHang.findUniqueOrThrow({
        where: { id },
        include: {
          chiTietPhieuNhapHangs: {
            include: { soLo: { include: { hangHoa: true } } },
          },
        },
      });
      const lines = phieu.chiTietPhieuNhapHangs;
      if (lines.length === 0) {
        throw new AppException('PHIEU_NHAP_EMPTY');
      }

      // Everything is re-checked: suppliers, lots and vehicles change after a draft is saved.
      const ncc = await this.nhaCungCap.findByIdOrThrow(phieu.nhaCungCapId, tx);
      this.nhaCungCap.assertCanSupply(ncc);
      await this.assertVehicle(
        phieu.phuongTienVanChuyenId,
        lines.some((l) => l.soLo.hangHoa.isCanGiuLanh),
        tx,
      );

      // Fixed lock order across concurrent confirmations avoids deadlocks.
      const ordered = [...lines].sort((a, b) =>
        `${a.soLoId}|${a.viTriId}`.localeCompare(`${b.soLoId}|${b.viTriId}`),
      );
      for (const line of ordered) {
        this.hangHoa.assertReceivable(line.soLo.hangHoa);
        this.soLo.assertReceivable(line.soLo);
        await this.tonKho.increase(
          {
            soLoId: line.soLoId,
            viTriId: line.viTriId,
            soLuongCoBan: line.soLuongCoBan,
            loai: 'nhap_kho',
            thamChieu: { loai: REFERENCE_TYPE, id },
          },
          actor,
          tx,
        );
      }
    });
    this.logger.info(
      { event: 'phieu_nhap.confirmed', phieuNhapId: id },
      'receipt confirmed',
    );
    return this.findOne(id);
  }

  async cancel(
    id: string,
    dto: HuyPhieuDto,
    actor: AuthenticatedUser,
  ): Promise<PhieuNhapResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      // Locking read first: it fixes the state this cancellation is decided on.
      const locked = await tx.$queryRaw<{ trang_thai: TrangThaiPhieuNhap }[]>`
        SELECT trang_thai FROM phieu_nhap_hang WHERE id = ${id} FOR UPDATE`;
      const from = locked[0]?.trang_thai;
      if (!from) {
        throw new AppException('PHIEU_NHAP_NOT_FOUND');
      }
      assertTransition(from, 'da_huy');
      const afterReceipt = from === 'da_nhap_kho';
      if (afterReceipt && !this.mayCancelReceived(actor)) {
        throw new AppException('AUTH_FORBIDDEN');
      }

      await tx.phieuNhapHang.update({
        where: { id },
        data: {
          trangThai: 'da_huy',
          huyAt: this.clock.now(),
          huyById: actor.id,
          lyDoHuy: dto.lyDo,
          updatedById: actor.id,
        },
      });
      if (afterReceipt) {
        await this.reverseReceipt(id, actor, tx);
      }
      await this.audit.record(
        {
          hanhDong: afterReceipt
            ? 'phieu_nhap.cancel_after_receipt'
            : 'phieu_nhap.cancel',
          doiTuong: 'phieu_nhap_hang',
          doiTuongId: id,
          truoc: { trangThai: from },
          sau: { trangThai: 'da_huy' },
          lyDo: dto.lyDo,
        },
        tx,
      );
    });
    this.logger.info(
      { event: 'phieu_nhap.cancelled', phieuNhapId: id },
      'receipt cancelled',
    );
    return this.findOne(id);
  }

  // ===========================================================================
  // Used by phieu-thanh-toan
  // ===========================================================================

  async findByIdOrThrow(id: string, tx?: Prisma.TransactionClient) {
    const row = await (tx ?? this.prisma).phieuNhapHang.findUnique({
      where: { id },
    });
    if (!row) {
      throw new AppException('PHIEU_NHAP_NOT_FOUND');
    }
    return row;
  }

  async getPaymentSummary(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{
    tongTien: Prisma.Decimal;
    daThanhToan: Prisma.Decimal;
    conNo: Prisma.Decimal;
  }> {
    const client = tx ?? this.prisma;
    const [lines, paid] = await Promise.all([
      client.chiTietPhieuNhapHang.findMany({
        where: { phieuNhapHangId: id },
        select: { soLuong: true, donGia: true },
      }),
      client.phieuThanhToan.aggregate({
        where: { phieuNhapHangId: id, huyAt: null },
        _sum: { soTien: true },
      }),
    ]);
    const tongTien = computeTotals(lines);
    const daThanhToan = paid._sum.soTien ?? ZERO;
    return { tongTien, daThanhToan, conNo: tongTien.minus(daThanhToan) };
  }

  // ===========================================================================
  // helpers
  // ===========================================================================

  private mayCancelReceived(actor: AuthenticatedUser): boolean {
    const role = actor.role?.maRole;
    return role === ROLE.ADMIN || role === ROLE.QUAN_LY_KHO;
  }

  // Locks a draft for editing; throws NOT_FOUND / INVALID_STATE otherwise.
  private async lockDraft(
    id: string,
    actor: AuthenticatedUser,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const { count } = await tx.phieuNhapHang.updateMany({
      where: { id, trangThai: 'cho_xac_nhan' },
      data: { updatedById: actor.id },
    });
    if (count !== 1) {
      await this.throwNotDraft(id, tx);
    }
  }

  private async throwNotDraft(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<never> {
    const row = await tx.phieuNhapHang.findUnique({
      where: { id },
      select: { trangThai: true },
    });
    if (!row) {
      throw new AppException('PHIEU_NHAP_NOT_FOUND');
    }
    assertEditable(row.trangThai);
    throw new AppException('PHIEU_NHAP_INVALID_STATE');
  }

  private lineData(maPhieu: string, lines: PreparedLine[]) {
    return lines.map((line, index) => ({
      maChiTietPhieuNhapHang: formatLineCode(maPhieu, index + 1),
      ...line,
    }));
  }

  private async assertVehicle(
    phuongTienId: string | null | undefined,
    requireCold: boolean,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (phuongTienId) {
      await this.phuongTien.assertUsable(phuongTienId, { requireCold }, tx);
    }
  }

  private async hasColdLines(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    const cold = await tx.chiTietPhieuNhapHang.count({
      where: {
        phieuNhapHangId: id,
        soLo: { hangHoa: { isCanGiuLanh: true } },
      },
    });
    return cold > 0;
  }

  // Validates and normalises the lines of a draft; creates inline lots as needed.
  private async prepareLines(
    input: ChiTietNhapDto[],
    actor: AuthenticatedUser,
    tx: Prisma.TransactionClient,
  ): Promise<{ lines: PreparedLine[]; hasCold: boolean }> {
    const lines: PreparedLine[] = [];
    const seen = new Set<string>();
    let hasCold = false;

    for (const [index, line] of input.entries()) {
      const field = `chiTiet[${index}]`;
      if (Boolean(line.soLoId) === Boolean(line.soLo)) {
        throw invalid(field, 'Chỉ gửi một trong soLoId hoặc soLo');
      }
      const lot = line.soLoId
        ? await this.soLo.findByIdOrThrow(line.soLoId, tx)
        : await this.createInlineLot(line, actor, tx);
      const product = await this.hangHoa.findByIdOrThrow(lot.hangHoaId, tx);
      this.hangHoa.assertReceivable(product);
      this.soLo.assertReceivable(lot);

      const location = await this.viTri.assertReceivable(line.viTriId, tx);
      assertColdChain(product, location);
      hasCold ||= product.isCanGiuLanh;

      const unit = await this.units.resolveUnit(product.id, line.donViTinh, tx);
      if (!unit) {
        throw new AppException('PHIEU_NHAP_UNIT_INVALID', {
          details: { field, donViTinh: line.donViTinh },
        });
      }
      const key = `${lot.id}|${line.viTriId}`;
      if (seen.has(key)) {
        throw new AppException('PHIEU_NHAP_DUPLICATE_LINE', {
          details: { field },
        });
      }
      seen.add(key);

      lines.push({
        soLoId: lot.id,
        viTriId: line.viTriId,
        donViTinh: unit.donViTinh,
        heSoQuyDoi: unit.heSoQuyDoi,
        soLuong: line.soLuong,
        soLuongCoBan: toBaseQuantity(line.soLuong, unit.heSoQuyDoi),
        donGia: new Prisma.Decimal(line.donGia),
      });
    }
    return { lines, hasCold };
  }

  private async createInlineLot(
    line: ChiTietNhapDto,
    actor: AuthenticatedUser,
    tx: Prisma.TransactionClient,
  ) {
    const soLo = line.soLo!;
    const product = await this.hangHoa.findByIdOrThrow(soLo.hangHoaId, tx);
    this.hangHoa.assertReceivable(product);
    return this.soLo.resolveOrCreate(
      {
        hangHoaId: soLo.hangHoaId,
        tenLo: soLo.tenLo,
        ngaySX: soLo.ngaySX ? parseDateOnly(soLo.ngaySX) : null,
        hanSuDung: parseDateOnly(soLo.hanSuDung),
      },
      actor,
      tx,
    );
  }

  // Cancelling a received receipt takes the goods back out; fails as a whole if any is gone.
  private async reverseReceipt(
    id: string,
    actor: AuthenticatedUser,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    // First consistent read of this transaction, taken after the row lock above, so a
    // payment committed just before the lock was acquired is always seen.
    const payments = await tx.phieuThanhToan.count({
      where: { phieuNhapHangId: id, huyAt: null },
    });
    if (payments > 0) {
      throw new AppException('PHIEU_NHAP_CANNOT_REVERSE', {
        details: { lyDo: 'co_phieu_thanh_toan', soPhieuThanhToan: payments },
      });
    }
    const lines = await tx.chiTietPhieuNhapHang.findMany({
      where: { phieuNhapHangId: id },
      orderBy: [{ soLoId: 'asc' }, { viTriId: 'asc' }],
    });
    const missing: {
      maChiTietPhieuNhapHang: string;
      conLai: number;
      canTra: number;
    }[] = [];
    for (const line of lines) {
      try {
        await this.tonKho.decrease(
          {
            soLoId: line.soLoId,
            viTriId: line.viTriId,
            soLuongCoBan: line.soLuongCoBan,
            loai: 'huy_nhap',
            thamChieu: { loai: REFERENCE_TYPE, id },
          },
          actor,
          tx,
        );
      } catch (error) {
        if (
          error instanceof AppException &&
          error.code === 'TON_KHO_INSUFFICIENT'
        ) {
          const conLai = Number(
            (error.details as { conLai?: number } | undefined)?.conLai ?? 0,
          );
          missing.push({
            maChiTietPhieuNhapHang: line.maChiTietPhieuNhapHang,
            conLai,
            canTra: line.soLuongCoBan,
          });
          continue;
        }
        throw error;
      }
    }
    if (missing.length > 0) {
      throw new AppException('PHIEU_NHAP_CANNOT_REVERSE', {
        details: { lyDo: 'thieu_ton', dong: missing },
      });
    }
  }

  // Lots a deleted draft may have created, if nothing else refers to them any more.
  private async removeOrphanLots(
    soLoIds: string[],
    phieu: { createdAt: Date; createdById: string | null },
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    for (const soLoId of new Set(soLoIds)) {
      const lot = await tx.soLo.findUnique({ where: { id: soLoId } });
      if (
        !lot ||
        lot.createdById !== phieu.createdById ||
        lot.createdAt < phieu.createdAt
      ) {
        continue;
      }
      const [stock, moves, receipts, issues] = await Promise.all([
        tx.tonKho.count({ where: { soLoId } }),
        tx.bienDongTonKho.count({ where: { soLoId } }),
        tx.chiTietPhieuNhapHang.count({ where: { soLoId } }),
        tx.chiTietPhieuXuatHang.count({ where: { soLoId } }),
      ]);
      if (stock + moves + receipts + issues === 0) {
        await tx.soLo.delete({ where: { id: soLoId } });
      }
    }
  }

  private async idsByPaymentStatus(
    status: 'chua_thanh_toan' | 'thanh_toan_mot_phan' | 'da_thanh_toan',
  ): Promise<string[]> {
    const condition = {
      chua_thanh_toan: Prisma.sql`paid = 0 AND total > 0`,
      thanh_toan_mot_phan: Prisma.sql`paid > 0 AND paid < total`,
      da_thanh_toan: Prisma.sql`paid >= total`,
    }[status];
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM (
        SELECT p.id,
          (SELECT COALESCE(SUM(c.so_luong * c.don_gia), 0)
             FROM chi_tiet_phieu_nhap_hang c WHERE c.phieu_nhap_hang_id = p.id) AS total,
          (SELECT COALESCE(SUM(t.so_tien), 0)
             FROM phieu_thanh_toan t
            WHERE t.phieu_nhap_hang_id = p.id AND t.huy_at IS NULL) AS paid
        FROM phieu_nhap_hang p
        WHERE p.trang_thai = 'da_nhap_kho'
      ) x WHERE ${condition}`;
    return rows.map((r) => r.id);
  }
}
