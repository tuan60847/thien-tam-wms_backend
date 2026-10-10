import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import {
  Prisma,
  type KhachHang,
  type TrangThaiPhieuXuat,
} from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { AuditService } from '../audit/audit.service.js';
import { ROLE } from '../auth/roles.constants.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { ClockService } from '../common/clock/clock.service.js';
import { addDays, parseDateOnly } from '../common/clock/vn-date.js';
import { CodeGeneratorService } from '../common/code-generator/code-generator.service.js';
import { CODE, formatLineCode } from '../common/code-generator/code-specs.js';
import type { HuyPhieuDto } from '../common/dto/huy-phieu.dto.js';
import { AppException } from '../common/errors/app.exception.js';
import {
  computeNetTotals,
  moneyString,
  percentOf,
  ZERO,
} from '../common/money.js';
import {
  dateRangeFilter,
  paginate,
  parseSort,
  toOrderBy,
  type PagedResponse,
} from '../common/pagination/paginate.js';
import { appConfig } from '../config/app.config.js';
import { DieuKhoanThanhToanService } from '../dieu-khoan-thanh-toan/dieu-khoan-thanh-toan.service.js';
import { NhanVienKinhDoanhService } from '../nhan-vien-kinh-doanh/nhan-vien-kinh-doanh.service.js';
import { HangHoaService } from '../hang-hoa/hang-hoa.service.js';
import { KhachHangService } from '../khach-hang/khach-hang.service.js';
import { ViTriService } from '../kho-vi-tri/vi-tri.service.js';
import { PhuongTienService } from '../phuong-tien-van-chuyen/phuong-tien.service.js';
import { computeDebt, debtSelect, type Debt } from './phieu-xuat-hang.debt.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SoLoService } from '../so-lo/so-lo.service.js';
import { TonKhoService } from '../ton-kho/ton-kho.service.js';
import { TyLeQuyDoiService } from '../ty-le-quy-doi/ty-le-quy-doi.service.js';
import { toBaseQuantity } from '../ty-le-quy-doi/unit-conversion.js';
import type {
  ChiTietXuatDto,
  CreatePhieuXuatDto,
  DoiTinhTrangNoDto,
  GiaoHangDto,
  PhieuXuatListItemDto,
  PhieuXuatResponseDto,
  QueryPhieuXuatDto,
  UpdatePhieuXuatDto,
  XuatKhoDto,
  PhuongThucThuValue,
} from './dto/phieu-xuat.dto.js';
import {
  phieuXuatDetailInclude,
  phieuXuatListInclude,
  toPhieuXuatListItem,
  toPhieuXuatResponse,
} from './phieu-xuat-hang.mapper.js';
import {
  assertTransition,
  convertUnitPrice,
  isBelowMinimum,
  isOutOfFefo,
  minUnitPrice,
} from './phieu-xuat-hang.rules.js';

const SORT_WHITELIST = [
  'createdAt',
  'ngayXuatKho',
  'ngayGiaoHang',
  'maPhieuXuatHang',
] as const;
const REFERENCE_TYPE = 'phieu_xuat_hang';

interface PreparedLine {
  soLoId: string;
  viTriId: string;
  donViTinh: string;
  heSoQuyDoi: number;
  soLuong: number;
  soLuongCoBan: number;
  donGia: Prisma.Decimal;
  laHangKhuyenMai: boolean;
  tyLeChietKhau: Prisma.Decimal;
  tienChietKhau: Prisma.Decimal;
  thueSuatGtgt: Prisma.Decimal;
  tienThueGtgt: Prisma.Decimal;
  donGiaVon: Prisma.Decimal; // estimated from the product's purchase price
  tienGiaVon: Prisma.Decimal;
}

interface CreditOverride {
  hanMuc: string;
  congNoSauPhieu: string;
  lyDo: string;
}

type BelowMinLine = {
  dong: number;
  donGia: string;
  toiThieu: string;
};

const invalid = (field: string, message: string) =>
  new AppException('VALIDATION_FAILED', {
    details: [{ field, messages: [message] }],
  });

@Injectable()
export class PhieuXuatHangService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: CodeGeneratorService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    private readonly khachHang: KhachHangService,
    private readonly phuongTien: PhuongTienService,
    private readonly soLo: SoLoService,
    private readonly hangHoa: HangHoaService,
    private readonly viTri: ViTriService,
    private readonly units: TyLeQuyDoiService,
    private readonly tonKho: TonKhoService,
    private readonly nhanVien: NhanVienKinhDoanhService,
    private readonly dieuKhoan: DieuKhoanThanhToanService,
    private readonly logger: PinoLogger,
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {
    this.logger.setContext(PhieuXuatHangService.name);
  }

  // ===========================================================================
  // Queries
  // ===========================================================================

  async findAll(
    query: QueryPhieuXuatDto,
  ): Promise<PagedResponse<PhieuXuatListItemDto>> {
    const ids = query.trangThaiThu
      ? await this.idsByReceivableStatus(query.trangThaiThu)
      : undefined;
    const lineFilter: Prisma.ChiTietPhieuXuatHangWhereInput = {
      soLoId: query.soLoId,
      soLo: query.hangHoaId ? { hangHoaId: query.hangHoaId } : undefined,
    };
    const where: Prisma.PhieuXuatHangWhereInput = {
      id: ids ? { in: ids } : undefined,
      khachHangId: query.khachHangId,
      trangThai: query.trangThai ? { in: query.trangThai } : undefined,
      tinhTrangNo: query.tinhTrangNo,
      createdById: query.createdById,
      createdAt: dateRangeFilter(query.createdAtFrom, query.createdAtTo),
      ngayXuatKho: this.dateOnlyRange(
        query.ngayXuatKhoFrom,
        query.ngayXuatKhoTo,
      ),
      ngayGiaoHang: this.dateOnlyRange(
        query.ngayGiaoHangFrom,
        query.ngayGiaoHangTo,
      ),
      chiTietPhieuXuatHangs:
        query.soLoId || query.hangHoaId ? { some: lineFilter } : undefined,
      OR: query.q
        ? [
            { maPhieuXuatHang: { contains: query.q } },
            { khachHang: { tenKH: { contains: query.q } } },
            { khachHang: { maKH: { contains: query.q } } },
          ]
        : undefined,
    };
    const orderBy = toOrderBy(
      parseSort(query.sort, SORT_WHITELIST, [
        { field: 'createdAt', direction: 'desc' },
      ]),
    ) as Prisma.PhieuXuatHangOrderByWithRelationInput[];

    return paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.phieuXuatHang.findMany({
          where,
          orderBy,
          skip,
          take,
          include: phieuXuatListInclude,
        }),
      count: () => this.prisma.phieuXuatHang.count({ where }),
      map: toPhieuXuatListItem,
    });
  }

  async findOne(id: string): Promise<PhieuXuatResponseDto> {
    const row = await this.prisma.phieuXuatHang.findUnique({
      where: { id },
      include: phieuXuatDetailInclude,
    });
    if (!row) {
      throw new AppException('PHIEU_XUAT_NOT_FOUND');
    }
    const outOfFefo =
      row.trangThai === 'cho_xu_ly'
        ? await this.findOutOfFefoLines(row.chiTietPhieuXuatHangs)
        : new Set<string>();
    return toPhieuXuatResponse(
      row,
      this.clock.today(),
      this.config.expiryWarningDays,
      outOfFefo,
    );
  }

  // ===========================================================================
  // Draft lifecycle
  // ===========================================================================

  async create(
    dto: CreatePhieuXuatDto,
    actor: AuthenticatedUser,
  ): Promise<PhieuXuatResponseDto> {
    const id = await this.prisma.$transaction(async (tx) => {
      const customer = await this.khachHang.findByIdOrThrow(
        dto.khachHangId,
        tx,
      );
      this.khachHang.assertCanBuy(customer);
      const prepared = await this.prepareLines(dto.chiTiet ?? [], actor, tx);
      await this.assertVehicle(dto.phuongTienVanChuyenId, prepared.hasCold, tx);
      // Paid on the spot: no debt is created, so the credit limit does not apply.
      const exceeded =
        dto.hinhThucThanhToan === 'thu_tien_ngay'
          ? null
          : await this.assertCreditLimit(
              customer,
              computeNetTotals(prepared.lines).tongThanhToan,
              tx,
              { actor, lyDo: dto.vuotHanMucLyDo },
            );

      const ma = await this.codes.next(CODE.PHIEU_XUAT, tx);
      const created = await tx.phieuXuatHang.create({
        data: {
          maPhieuXuatHang: ma,
          khachHangId: dto.khachHangId,
          phuongTienVanChuyenId: dto.phuongTienVanChuyenId ?? null,
          ngayGiaoHang: dto.ngayGiaoHang
            ? parseDateOnly(dto.ngayGiaoHang)
            : null,
          // Snapshot: later edits of the customer's address must not change this order.
          diaChiGiaoHang:
            dto.diaChiGiaoHang ??
            (await this.defaultDeliveryAddress(customer, tx)),
          ghiChu: dto.ghiChu ?? null,
          ...(await this.createHeader(dto, customer, tx)),
          createdById: actor.id,
          updatedById: actor.id,
          chiTietPhieuXuatHangs: { create: this.lineData(ma, prepared.lines) },
        },
      });
      await this.recordBelowMin(created.id, prepared.belowMin, tx);
      await this.recordCreditOverride(created.id, exceeded, tx);
      return created.id;
    });
    return this.findOne(id);
  }

  async update(
    id: string,
    dto: UpdatePhieuXuatDto,
    actor: AuthenticatedUser,
  ): Promise<PhieuXuatResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockDraft(id, actor, tx);
      const current = await tx.phieuXuatHang.findUniqueOrThrow({
        where: { id },
      });

      const khachHangId = dto.khachHangId ?? current.khachHangId;
      const customer = await this.khachHang.findByIdOrThrow(khachHangId, tx);
      this.khachHang.assertCanBuy(customer);

      let hasCold: boolean;
      if (dto.chiTiet !== undefined) {
        const prepared = await this.prepareLines(dto.chiTiet, actor, tx);
        await tx.chiTietPhieuXuatHang.deleteMany({
          where: { phieuXuatHangId: id },
        });
        await tx.chiTietPhieuXuatHang.createMany({
          data: this.lineData(current.maPhieuXuatHang, prepared.lines).map(
            (line) => ({ ...line, phieuXuatHangId: id }),
          ),
        });
        await this.recordBelowMin(id, prepared.belowMin, tx);
        hasCold = prepared.hasCold;
      } else {
        hasCold = await this.hasColdLines(id, tx);
      }
      const paidNow =
        (dto.hinhThucThanhToan ?? current.hinhThucThanhToan) ===
        'thu_tien_ngay';
      if (!paidNow) {
        await this.recordCreditOverride(
          id,
          await this.assertCreditLimit(
            customer,
            await this.draftTotal(id, tx),
            tx,
            { actor, lyDo: dto.vuotHanMucLyDo },
          ),
          tx,
        );
      }
      const phuongTienId =
        dto.phuongTienVanChuyenId === undefined
          ? current.phuongTienVanChuyenId
          : dto.phuongTienVanChuyenId;
      await this.assertVehicle(phuongTienId, hasCold, tx);

      await tx.phieuXuatHang.update({
        where: { id },
        data: {
          khachHangId,
          phuongTienVanChuyenId: phuongTienId,
          ngayGiaoHang:
            dto.ngayGiaoHang === undefined
              ? undefined
              : dto.ngayGiaoHang === null
                ? null
                : parseDateOnly(dto.ngayGiaoHang),
          diaChiGiaoHang: dto.diaChiGiaoHang,
          ghiChu: dto.ghiChu,
          ...(await this.updateHeader(dto, current.khachHangId, customer, tx)),
          updatedById: actor.id,
        },
      });
    });
    return this.findOne(id);
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockDraft(id, actor, tx);
      await tx.chiTietPhieuXuatHang.deleteMany({
        where: { phieuXuatHangId: id },
      });
      await tx.phieuXuatHang.delete({ where: { id } });
    });
  }

  // ===========================================================================
  // Issue / deliver / cancel
  // ===========================================================================

  async issue(
    id: string,
    dto: XuatKhoDto,
    actor: AuthenticatedUser,
  ): Promise<PhieuXuatResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      // First statement: locks the row so two concurrent issues cannot both pass.
      const { count } = await tx.phieuXuatHang.updateMany({
        where: { id, trangThai: 'cho_xu_ly' },
        data: {
          trangThai: 'da_xuat_kho',
          ngayXuatKho: this.clock.today(),
          xuatKhoById: actor.id,
          updatedById: actor.id,
        },
      });
      if (count !== 1) {
        await this.throwNotDraft(id, tx);
      }

      const phieu = await tx.phieuXuatHang.findUniqueOrThrow({
        where: { id },
        include: {
          chiTietPhieuXuatHangs: {
            include: { soLo: { include: { hangHoa: true } } },
          },
        },
      });
      const lines = phieu.chiTietPhieuXuatHangs;
      if (lines.length === 0) {
        throw new AppException('PHIEU_XUAT_EMPTY');
      }

      // Customer, lots and vehicle can all change between saving a draft and issuing it.
      const customer = await this.khachHang.findByIdOrThrow(
        phieu.khachHangId,
        tx,
      );
      this.khachHang.assertCanBuy(customer);
      await this.assertVehicle(
        phieu.phuongTienVanChuyenId,
        lines.some((l) => l.soLo.hangHoa.isCanGiuLanh),
        tx,
      );
      // Paid on the spot: no debt is created, so the credit limit does not apply.
      const paidNow = phieu.hinhThucThanhToan === 'thu_tien_ngay';
      if (!paidNow) {
        // This order is already counted as issued (state updated above): +0 extra.
        await this.recordCreditOverride(
          id,
          await this.assertCreditLimit(customer, ZERO, tx, {
            actor,
            lyDo: dto.vuotHanMucLyDo,
          }),
          tx,
        );
      }
      if (!phieu.hanThanhToan && phieu.soNgayDuocNo) {
        await tx.phieuXuatHang.update({
          where: { id },
          data: {
            hanThanhToan: addDays(this.clock.today(), phieu.soNgayDuocNo),
          },
        });
      }

      // Fixed lock order across concurrent issues avoids deadlocks.
      const ordered = [...lines].sort((a, b) =>
        `${a.soLoId}|${a.viTriId}`.localeCompare(`${b.soLoId}|${b.viTriId}`),
      );
      for (const line of ordered) {
        this.soLo.assertIssuable(line.soLo);
        await this.tonKho.decrease(
          {
            soLoId: line.soLoId,
            viTriId: line.viTriId,
            soLuongCoBan: line.soLuongCoBan,
            loai: 'xuat_kho',
            thamChieu: { loai: REFERENCE_TYPE, id },
          },
          actor,
          tx,
        );
      }
      if (paidNow) {
        await this.recordImmediatePayment(
          phieu,
          dto.phuongThucThu ?? 'tien_mat',
          actor,
          tx,
        );
      }
    });
    this.logger.info(
      { event: 'phieu_xuat.stock_out', phieuXuatId: id },
      'issue stocked out',
    );
    return this.findOne(id);
  }

  // "Thu tiền ngay": the receipt for the whole order is written together with the issue, so the
  // order never shows as owing. Voiding that receipt is what allows cancelling the order.
  private async recordImmediatePayment(
    phieu: {
      id: string;
      nhanVienBanHangId: string | null;
      chiTietPhieuXuatHangs: {
        soLuong: number;
        donGia: Prisma.Decimal;
        tienChietKhau: Prisma.Decimal;
        tienThueGtgt: Prisma.Decimal;
      }[];
    },
    phuongThuc: PhuongThucThuValue,
    actor: AuthenticatedUser,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const soTien = computeNetTotals(phieu.chiTietPhieuXuatHangs).tongThanhToan;
    if (soTien.lte(0)) {
      return;
    }
    const today = this.clock.today();
    const receipt = await tx.phieuThuCongNo.create({
      data: {
        maPhieuThuCongNo: await this.codes.next(CODE.PHIEU_THU, tx),
        soTien,
        ngayThanhToan: today,
        phuongThuc,
        ghiChu: 'Thu tiền ngay khi xuất kho',
        nhanVienBanHangId: phieu.nhanVienBanHangId,
        phieuXuatHangId: phieu.id,
        createdById: actor.id,
      },
    });
    await tx.doiTruChungTu.create({
      data: {
        phieuThuCongNoId: receipt.id,
        phieuXuatHangId: phieu.id,
        soTienDoiTru: soTien,
        ngayDoiTru: today,
        createdById: actor.id,
      },
    });
  }

  async deliver(
    id: string,
    dto: GiaoHangDto,
    actor: AuthenticatedUser,
  ): Promise<PhieuXuatResponseDto> {
    const today = this.clock.today();
    const delivered = dto.ngayGiaoThucTe
      ? parseDateOnly(dto.ngayGiaoThucTe)
      : today;
    if (delivered.getTime() > today.getTime()) {
      throw invalid('ngayGiaoThucTe', 'Ngày giao hàng không được ở tương lai');
    }

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.phieuXuatHang.updateMany({
        where: { id, trangThai: 'da_xuat_kho' },
        data: {
          trangThai: 'da_giao',
          ngayGiaoThucTe: delivered,
          ghiChu: dto.ghiChu,
          updatedById: actor.id,
        },
      });
      if (count !== 1) {
        await this.throwWrongState(id, tx);
      }
      const phieu = await tx.phieuXuatHang.findUniqueOrThrow({ where: { id } });
      if (
        phieu.ngayXuatKho &&
        delivered.getTime() < phieu.ngayXuatKho.getTime()
      ) {
        throw invalid(
          'ngayGiaoThucTe',
          'Ngày giao hàng không được trước ngày xuất kho',
        );
      }
    });
    this.logger.info(
      { event: 'phieu_xuat.delivered', phieuXuatId: id },
      'order delivered',
    );
    return this.findOne(id);
  }

  // Debt classification (normal / hard to collect / uncollectable) of an issued order.
  async setDebtStatus(
    id: string,
    dto: DoiTinhTrangNoDto,
    actor: AuthenticatedUser,
  ): Promise<PhieuXuatResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        { trang_thai: TrangThaiPhieuXuat; tinh_trang_no: string }[]
      >`SELECT trang_thai, tinh_trang_no FROM phieu_xuat_hang WHERE id = ${id} FOR UPDATE`;
      const row = locked[0];
      if (!row) {
        throw new AppException('PHIEU_XUAT_NOT_FOUND');
      }
      // Only an order that created a receivable has a debt status to change.
      if (row.trang_thai !== 'da_xuat_kho' && row.trang_thai !== 'da_giao') {
        throw new AppException('PHIEU_XUAT_INVALID_STATE');
      }
      if (row.tinh_trang_no === dto.tinhTrangNo) {
        return;
      }
      await tx.phieuXuatHang.update({
        where: { id },
        data: { tinhTrangNo: dto.tinhTrangNo, updatedById: actor.id },
      });
      await this.audit.record(
        {
          hanhDong: 'phieu_xuat.debt_status',
          doiTuong: 'phieu_xuat_hang',
          doiTuongId: id,
          truoc: { tinhTrangNo: row.tinh_trang_no },
          sau: { tinhTrangNo: dto.tinhTrangNo },
          lyDo: dto.lyDo,
        },
        tx,
      );
    });
    return this.findOne(id);
  }

  async cancel(
    id: string,
    dto: HuyPhieuDto,
    actor: AuthenticatedUser,
  ): Promise<PhieuXuatResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      // Locking read first: it fixes the state this cancellation is decided on.
      const locked = await tx.$queryRaw<{ trang_thai: TrangThaiPhieuXuat }[]>`
        SELECT trang_thai FROM phieu_xuat_hang WHERE id = ${id} FOR UPDATE`;
      const from = locked[0]?.trang_thai;
      if (!from) {
        throw new AppException('PHIEU_XUAT_NOT_FOUND');
      }
      assertTransition(from, 'da_huy');
      const afterIssue = from === 'da_xuat_kho';
      if (afterIssue && !this.mayCancelIssued(actor)) {
        throw new AppException('AUTH_FORBIDDEN');
      }

      await tx.phieuXuatHang.update({
        where: { id },
        data: {
          trangThai: 'da_huy',
          huyAt: this.clock.now(),
          huyById: actor.id,
          lyDoHuy: dto.lyDo,
          updatedById: actor.id,
        },
      });
      if (afterIssue) {
        await this.restoreStock(id, actor, tx);
      }
      await this.audit.record(
        {
          hanhDong: afterIssue
            ? 'phieu_xuat.cancel_after_issue'
            : 'phieu_xuat.cancel',
          doiTuong: 'phieu_xuat_hang',
          doiTuongId: id,
          truoc: { trangThai: from },
          sau: { trangThai: 'da_huy' },
          lyDo: dto.lyDo,
        },
        tx,
      );
    });
    this.logger.info(
      { event: 'phieu_xuat.cancelled', phieuXuatId: id },
      'order cancelled',
    );
    return this.findOne(id);
  }

  // ===========================================================================
  // Used by phieu-thu-cong-no
  // ===========================================================================

  async findByIdOrThrow(id: string, tx?: Prisma.TransactionClient) {
    const row = await (tx ?? this.prisma).phieuXuatHang.findUnique({
      where: { id },
    });
    if (!row) {
      throw new AppException('PHIEU_XUAT_NOT_FOUND');
    }
    return row;
  }

  async getReceivableSummary(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Debt> {
    const row = await (tx ?? this.prisma).phieuXuatHang.findUnique({
      where: { id },
      select: debtSelect,
    });
    if (!row) {
      throw new AppException('PHIEU_XUAT_NOT_FOUND');
    }
    return computeDebt(row);
  }

  // ===========================================================================
  // helpers
  // ===========================================================================

  private isManager(actor: AuthenticatedUser): boolean {
    const role = actor.role?.maRole;
    return role === ROLE.ADMIN || role === ROLE.QUAN_LY_KHO;
  }

  private mayCancelIssued(actor: AuthenticatedUser): boolean {
    return this.isManager(actor);
  }

  private dateOnlyRange(from?: string, to?: string) {
    return from || to
      ? {
          gte: from ? parseDateOnly(from) : undefined,
          lte: to ? parseDateOnly(to) : undefined,
        }
      : undefined;
  }

  // Locks a draft for editing; throws NOT_FOUND / INVALID_STATE otherwise.
  private async lockDraft(
    id: string,
    actor: AuthenticatedUser,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const { count } = await tx.phieuXuatHang.updateMany({
      where: { id, trangThai: 'cho_xu_ly' },
      data: { updatedById: actor.id },
    });
    if (count !== 1) {
      await this.throwNotDraft(id, tx);
    }
  }

  private throwNotDraft(id: string, tx: Prisma.TransactionClient) {
    return this.throwWrongState(id, tx);
  }

  private async throwWrongState(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<never> {
    const row = await tx.phieuXuatHang.findUnique({
      where: { id },
      select: { id: true },
    });
    throw new AppException(
      row ? 'PHIEU_XUAT_INVALID_STATE' : 'PHIEU_XUAT_NOT_FOUND',
    );
  }

  private lineData(maPhieu: string, lines: PreparedLine[]) {
    return lines.map((line, index) => ({
      maChiTietPhieuXuatHang: formatLineCode(maPhieu, index + 1),
      ...line,
    }));
  }

  // The customer's default delivery location, else the registered address.
  private async defaultDeliveryAddress(
    customer: KhachHang,
    tx: Prisma.TransactionClient,
  ): Promise<string | null> {
    const preferred = await tx.diaDiemGiaoHang.findFirst({
      where: { khachHangId: customer.id, laMacDinh: true },
      select: { diaDiem: true },
    });
    return preferred?.diaDiem ?? customer.diaChi;
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
    const cold = await tx.chiTietPhieuXuatHang.count({
      where: {
        phieuXuatHangId: id,
        soLo: { hangHoa: { isCanGiuLanh: true } },
      },
    });
    return cold > 0;
  }

  // Validates and normalises the lines of a draft. Stock is only *checked* here (no
  // reservation); the binding check is the atomic decrease when the order is issued.
  private async prepareLines(
    input: ChiTietXuatDto[],
    actor: AuthenticatedUser,
    tx: Prisma.TransactionClient,
  ): Promise<{
    lines: PreparedLine[];
    hasCold: boolean;
    belowMin: BelowMinLine[];
  }> {
    const lines: PreparedLine[] = [];
    const belowMin: BelowMinLine[] = [];
    const seen = new Set<string>();
    let hasCold = false;

    for (const [index, line] of input.entries()) {
      const field = `chiTiet[${index}]`;
      const lot = await this.soLo.findByIdOrThrow(line.soLoId, tx);
      this.soLo.assertIssuable(lot);
      const product = await this.hangHoa.findByIdOrThrow(lot.hangHoaId, tx);
      await this.viTri.findByIdOrThrow(line.viTriId, tx);
      hasCold ||= product.isCanGiuLanh;

      const unit = await this.units.resolveUnit(product.id, line.donViTinh, tx);
      if (!unit) {
        throw new AppException('PHIEU_XUAT_UNIT_INVALID', {
          details: { field, donViTinh: line.donViTinh },
        });
      }
      const soLuongCoBan = toBaseQuantity(line.soLuong, unit.heSoQuyDoi);

      const stock = await tx.tonKho.findUnique({
        where: {
          soLoId_viTriId: { soLoId: lot.id, viTriId: line.viTriId },
        },
      });
      if (!stock || stock.soLuong <= 0) {
        throw new AppException('PHIEU_XUAT_LOT_NOT_AT_LOCATION', {
          details: { field },
        });
      }
      if (soLuongCoBan > stock.soLuong) {
        throw new AppException('TON_KHO_INSUFFICIENT', {
          params: { conLai: stock.soLuong },
          details: { field, conLai: stock.soLuong, canLay: soLuongCoBan },
        });
      }

      const donGia = new Prisma.Decimal(line.donGia);
      const priceUnit = product.tyLeQuyDois.find(
        (u) => u.donViTinh === product.donViTinhGia,
      );
      const minimum = minUnitPrice(
        product.giaToiThieu,
        unit.heSoQuyDoi,
        priceUnit?.soLuongQuyDoi ?? 1,
      );
      // Promotional goods are given away: the minimum price does not apply to them.
      const laHangKhuyenMai = line.laHangKhuyenMai ?? false;
      if (!laHangKhuyenMai && isBelowMinimum(donGia, minimum)) {
        // Only managers may sell below the minimum; the message never reveals it.
        if (!this.isManager(actor)) {
          throw new AppException('PHIEU_XUAT_PRICE_BELOW_MIN', {
            details: { field },
          });
        }
        belowMin.push({
          dong: index + 1,
          donGia: moneyString(donGia),
          toiThieu: moneyString(minimum),
        });
      }

      const key = `${lot.id}|${line.viTriId}`;
      if (seen.has(key)) {
        throw new AppException('PHIEU_XUAT_DUPLICATE_LINE', {
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
        soLuongCoBan,
        donGia,
        ...this.moneyColumns(line, donGia, product, unit.heSoQuyDoi),
      });
    }
    return { lines, hasCold, belowMin };
  }

  // Discount, VAT and estimated cost of one line (all rounded half-up to 2 decimals).
  private moneyColumns(
    line: ChiTietXuatDto,
    donGia: Prisma.Decimal,
    product: {
      giaNhap: Prisma.Decimal;
      thueSuatGtgt: Prisma.Decimal;
      donViTinhGia: string;
      tyLeQuyDois: { donViTinh: string; soLuongQuyDoi: number }[];
    },
    heSoQuyDoi: number,
  ) {
    const gross = donGia.mul(line.soLuong);
    const tyLeChietKhau = new Prisma.Decimal(line.tyLeChietKhau ?? '0');
    const tienChietKhau = percentOf(gross, tyLeChietKhau);
    const thueSuatGtgt = line.thueSuatGtgt
      ? new Prisma.Decimal(line.thueSuatGtgt)
      : product.thueSuatGtgt;
    const priceUnit = product.tyLeQuyDois.find(
      (u) => u.donViTinh === product.donViTinhGia,
    );
    const donGiaVon = convertUnitPrice(
      product.giaNhap,
      heSoQuyDoi,
      priceUnit?.soLuongQuyDoi ?? 1,
    );
    return {
      laHangKhuyenMai: line.laHangKhuyenMai ?? false,
      tyLeChietKhau,
      tienChietKhau,
      thueSuatGtgt,
      tienThueGtgt: percentOf(gross.minus(tienChietKhau), thueSuatGtgt),
      donGiaVon,
      tienGiaVon: donGiaVon.mul(line.soLuong),
    };
  }

  // Header fields of a new order; unset ones default from the customer.
  private async createHeader(
    dto: CreatePhieuXuatDto,
    customer: KhachHang,
    tx: Prisma.TransactionClient,
  ) {
    const nhanVienBanHangId =
      dto.nhanVienBanHangId === undefined
        ? customer.nhanVienBanHangId
        : dto.nhanVienBanHangId;
    if (dto.nhanVienBanHangId) {
      await this.nhanVien.assertUsable(dto.nhanVienBanHangId, tx);
    }
    const dieuKhoanThanhToanId =
      dto.dieuKhoanThanhToanId === undefined
        ? customer.dieuKhoanThanhToanId
        : dto.dieuKhoanThanhToanId;
    const term = dieuKhoanThanhToanId
      ? await this.dieuKhoan.findByIdOrThrow(dieuKhoanThanhToanId, tx)
      : null;
    if (dto.baoGiaId) {
      await this.assertQuoteExists(dto.baoGiaId, tx);
    }
    return {
      nhanVienBanHangId,
      dieuKhoanThanhToanId,
      soNgayDuocNo:
        dto.soNgayDuocNo ?? term?.soNgayDuocNo ?? customer.soNgayDuocNo,
      hanThanhToan: dto.hanThanhToan ? parseDateOnly(dto.hanThanhToan) : null,
      thamChieu: dto.thamChieu ?? null,
      hinhThucThanhToan: dto.hinhThucThanhToan ?? 'chua_thu_tien',
      lapKemHoaDon: dto.lapKemHoaDon ?? false,
      dieuKhoanKhac: dto.dieuKhoanKhac ?? null,
      tenMatHangChung: dto.tenMatHangChung ?? null,
      nguoiLienHe: dto.nguoiLienHe ?? customer.lienHeHoTen,
      baoGiaId: dto.baoGiaId ?? null,
      ...this.customerSnapshot(customer),
    };
  }

  // Only the header fields the caller sent (undefined keeps the stored value).
  private async updateHeader(
    dto: UpdatePhieuXuatDto,
    currentCustomerId: string,
    customer: KhachHang,
    tx: Prisma.TransactionClient,
  ) {
    if (dto.nhanVienBanHangId) {
      await this.nhanVien.assertUsable(dto.nhanVienBanHangId, tx);
    }
    const term = dto.dieuKhoanThanhToanId
      ? await this.dieuKhoan.findByIdOrThrow(dto.dieuKhoanThanhToanId, tx)
      : null;
    if (dto.baoGiaId) {
      await this.assertQuoteExists(dto.baoGiaId, tx);
    }
    return {
      nhanVienBanHangId: dto.nhanVienBanHangId,
      dieuKhoanThanhToanId: dto.dieuKhoanThanhToanId,
      soNgayDuocNo: dto.soNgayDuocNo ?? term?.soNgayDuocNo,
      hanThanhToan:
        dto.hanThanhToan === undefined
          ? undefined
          : dto.hanThanhToan === null
            ? null
            : parseDateOnly(dto.hanThanhToan),
      thamChieu: dto.thamChieu,
      hinhThucThanhToan: dto.hinhThucThanhToan,
      lapKemHoaDon: dto.lapKemHoaDon,
      dieuKhoanKhac: dto.dieuKhoanKhac,
      tenMatHangChung: dto.tenMatHangChung,
      nguoiLienHe: dto.nguoiLienHe,
      baoGiaId: dto.baoGiaId,
      // Re-snapshot only when the order moves to another customer.
      ...(customer.id === currentCustomerId
        ? {}
        : this.customerSnapshot(customer)),
    };
  }

  private customerSnapshot(customer: KhachHang) {
    return {
      khachTenSnapshot: customer.tenKH,
      khachMaSoThueSnapshot: customer.maSoThue,
      khachDiaChiSnapshot: customer.diaChi,
    };
  }

  private async assertQuoteExists(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if ((await tx.baoGia.count({ where: { id } })) === 0) {
      throw new AppException('BAO_GIA_NOT_FOUND');
    }
  }

  private async draftTotal(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<Prisma.Decimal> {
    const lines = await tx.chiTietPhieuXuatHang.findMany({
      where: { phieuXuatHangId: id },
      select: {
        soLuong: true,
        donGia: true,
        tienChietKhau: true,
        tienThueGtgt: true,
      },
    });
    return computeNetTotals(lines).tongThanhToan;
  }

  // Open receivables of a customer: Σ conNo over issued orders.
  async getOutstandingByCustomer(
    khachHangId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.Decimal> {
    const orders = await (tx ?? this.prisma).phieuXuatHang.findMany({
      where: { khachHangId, trangThai: { in: ['da_xuat_kho', 'da_giao'] } },
      select: debtSelect,
    });
    return orders.reduce(
      (sum, order) => sum.plus(computeDebt(order).conNo),
      ZERO,
    );
  }

  // Credit limit (open question #44): 0 means "no limit". `extra` is what this order adds
  // on top of the already issued receivables (0 when the order is already issued).
  private async assertCreditLimit(
    customer: KhachHang,
    extra: Prisma.Decimal,
    tx: Prisma.TransactionClient,
    override?: { actor: AuthenticatedUser; lyDo?: string },
  ): Promise<CreditOverride | null> {
    if (customer.soNoToiDa.lte(0)) {
      return null;
    }
    const after = (await this.getOutstandingByCustomer(customer.id, tx)).plus(
      extra,
    );
    if (after.lte(customer.soNoToiDa)) {
      return null;
    }
    const hanMuc = customer.soNoToiDa.toFixed(2);
    const congNoSauPhieu = after.toFixed(2);
    // Only managers may go over the limit, and only with a stated reason.
    if (override?.lyDo && this.isManager(override.actor)) {
      return { hanMuc, congNoSauPhieu, lyDo: override.lyDo };
    }
    throw new AppException('KHACH_HANG_CREDIT_EXCEEDED', {
      params: { hanMuc, sauPhieu: congNoSauPhieu },
      details: { hanMuc, congNoSauPhieu },
    });
  }

  private async recordCreditOverride(
    id: string,
    exceeded: CreditOverride | null,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (!exceeded) {
      return;
    }
    await this.audit.record(
      {
        hanhDong: 'phieu_xuat.credit_limit_override',
        doiTuong: 'phieu_xuat_hang',
        doiTuongId: id,
        sau: {
          hanMuc: exceeded.hanMuc,
          congNoSauPhieu: exceeded.congNoSauPhieu,
        },
        lyDo: exceeded.lyDo,
      },
      tx,
    );
  }

  private async recordBelowMin(
    id: string,
    belowMin: BelowMinLine[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (belowMin.length === 0) {
      return;
    }
    await this.audit.record(
      {
        hanhDong: 'phieu_xuat.below_min_price',
        doiTuong: 'phieu_xuat_hang',
        doiTuongId: id,
        sau: { dong: belowMin },
      },
      tx,
    );
  }

  // Cancelling an issued order puts the goods back where they came from. Putting stock back
  // into a location switched off since then is allowed; the cold-chain rule still applies.
  private async restoreStock(
    id: string,
    actor: AuthenticatedUser,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    // First consistent read of this transaction, taken after the row lock above.
    const [receipts, returns] = await Promise.all([
      tx.doiTruChungTu.count({
        where: { phieuXuatHangId: id, daBoDoiTru: false },
      }),
      tx.traLaiHangBan.count({
        where: { phieuXuatHangId: id, trangThai: 'da_nhap_kho' },
      }),
    ]);
    if (receipts + returns > 0) {
      throw new AppException('PHIEU_XUAT_CANNOT_REVERSE', {
        details: { soPhieuThu: receipts, soPhieuTraLai: returns },
      });
    }
    const lines = await tx.chiTietPhieuXuatHang.findMany({
      where: { phieuXuatHangId: id },
      orderBy: [{ soLoId: 'asc' }, { viTriId: 'asc' }],
    });
    for (const line of lines) {
      await this.tonKho.increase(
        {
          soLoId: line.soLoId,
          viTriId: line.viTriId,
          soLuongCoBan: line.soLuongCoBan,
          loai: 'huy_xuat',
          thamChieu: { loai: REFERENCE_TYPE, id },
          boQuaKiemTraViTriHoatDong: true,
        },
        actor,
        tx,
      );
    }
  }

  // Lines that take from a lot expiring later than another lot of the same product that
  // still has stock (soft FEFO warning, never blocks).
  private async findOutOfFefoLines(
    lines: { id: string; soLo: { hangHoaId: string; hanSuDung: Date } }[],
  ): Promise<Set<string>> {
    if (lines.length === 0) {
      return new Set();
    }
    const earliest = await this.prisma.soLo.groupBy({
      by: ['hangHoaId'],
      where: {
        hangHoaId: { in: [...new Set(lines.map((l) => l.soLo.hangHoaId))] },
        hanSuDung: { gte: this.clock.today() },
        tonKhos: { some: { soLuong: { gt: 0 } } },
      },
      _min: { hanSuDung: true },
    });
    const byProduct = new Map(
      earliest.map((e) => [e.hangHoaId, e._min.hanSuDung ?? undefined]),
    );
    return new Set(
      lines
        .filter((l) =>
          isOutOfFefo(l.soLo.hanSuDung, byProduct.get(l.soLo.hangHoaId)),
        )
        .map((l) => l.id),
    );
  }

  private async idsByReceivableStatus(
    status: 'chua_thu' | 'thu_mot_phan' | 'da_thu_du',
  ): Promise<string[]> {
    // settled = receipts applied + goods returned
    const condition = {
      chua_thu: Prisma.sql`settled = 0 AND total > 0`,
      thu_mot_phan: Prisma.sql`settled > 0 AND settled < total`,
      da_thu_du: Prisma.sql`settled >= total`,
    }[status];
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM (
        SELECT p.id,
          (SELECT COALESCE(SUM(c.so_luong * c.don_gia - c.tien_chiet_khau + c.tien_thue_gtgt), 0)
             FROM chi_tiet_phieu_xuat_hang c WHERE c.phieu_xuat_hang_id = p.id) AS total,
          (SELECT COALESCE(SUM(d.so_tien_doi_tru), 0)
             FROM doi_tru_chung_tu d
            WHERE d.phieu_xuat_hang_id = p.id AND d.da_bo_doi_tru = 0)
          + (SELECT COALESCE(SUM(l.so_luong * l.don_gia - l.tien_chiet_khau), 0)
               FROM chi_tiet_tra_lai l
               JOIN tra_lai_hang_ban t ON t.id = l.tra_lai_id
              WHERE t.phieu_xuat_hang_id = p.id AND t.trang_thai = 'da_nhap_kho') AS settled
        FROM phieu_xuat_hang p
        WHERE p.trang_thai IN ('da_xuat_kho', 'da_giao')
      ) x WHERE ${condition}`;
    return rows.map((r) => r.id);
  }
}
