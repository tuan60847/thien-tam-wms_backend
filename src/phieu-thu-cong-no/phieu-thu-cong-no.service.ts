import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { ClockService } from '../common/clock/clock.service.js';
import {
  diffDays,
  formatDateOnly,
  parseDateOnly,
} from '../common/clock/vn-date.js';
import { CodeGeneratorService } from '../common/code-generator/code-generator.service.js';
import { CODE } from '../common/code-generator/code-specs.js';
import type { HuyPhieuDto } from '../common/dto/huy-phieu.dto.js';
import { AppException } from '../common/errors/app.exception.js';
import { moneyString, ZERO } from '../common/money.js';
import {
  paginate,
  parseSort,
  toOrderBy,
  type PagedResponse,
} from '../common/pagination/paginate.js';
import { DoiTruChungTuService } from '../doi-tru-chung-tu/doi-tru-chung-tu.service.js';
import { NhanVienKinhDoanhService } from '../nhan-vien-kinh-doanh/nhan-vien-kinh-doanh.service.js';
import {
  computeDebt,
  debtSelect,
} from '../phieu-xuat-hang/phieu-xuat-hang.debt.js';
import { PhieuXuatHangService } from '../phieu-xuat-hang/phieu-xuat-hang.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CongNoKhachQueryDto,
  CongNoKhachResponseDto,
  CongNoPhieuXuatDto,
  CreatePhieuThuDto,
  CreateThuGopDto,
  PhieuThuResponseDto,
  QueryPhieuThuDto,
} from './dto/phieu-thu.dto.js';
import {
  phieuThuInclude,
  toPhieuThuResponse,
} from './phieu-thu-cong-no.mapper.js';
import {
  ageBucket,
  overdueDays,
  assertAmountWithinDebt,
  assertReceiptDate,
  paymentDiscount,
} from './phieu-thu-cong-no.rules.js';

interface LockedOrder {
  id: string;
  trang_thai: string;
  ngay_xuat_kho: Date | null;
  nhan_vien_ban_hang_id: string | null;
  khach_hang_id: string;
}

const SORT_WHITELIST = ['ngayThanhToan', 'createdAt', 'soTien'] as const;

@Injectable()
export class PhieuThuCongNoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: CodeGeneratorService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    private readonly phieuXuat: PhieuXuatHangService,
    private readonly nhanVien: NhanVienKinhDoanhService,
    private readonly doiTru: DoiTruChungTuService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(PhieuThuCongNoService.name);
  }

  findAll(
    query: QueryPhieuThuDto,
  ): Promise<PagedResponse<PhieuThuResponseDto>> {
    const where: Prisma.PhieuThuCongNoWhereInput = {
      phieuXuatHangId: undefined,
      phuongThuc: query.phuongThuc,
      createdById: query.createdById,
      huyAt:
        query.daHuy === undefined
          ? undefined
          : query.daHuy
            ? { not: null }
            : null,
      ngayThanhToan:
        query.ngayThanhToanFrom || query.ngayThanhToanTo
          ? {
              gte: query.ngayThanhToanFrom
                ? parseDateOnly(query.ngayThanhToanFrom)
                : undefined,
              lte: query.ngayThanhToanTo
                ? parseDateOnly(query.ngayThanhToanTo)
                : undefined,
            }
          : undefined,
      phieuXuatHang: query.khachHangId
        ? { khachHangId: query.khachHangId }
        : undefined,
      AND: [
        query.phieuXuatHangId
          ? {
              OR: [
                { phieuXuatHangId: query.phieuXuatHangId },
                {
                  doiTrus: { some: { phieuXuatHangId: query.phieuXuatHangId } },
                },
              ],
            }
          : {},
      ],
      OR: query.q
        ? [
            { maPhieuThuCongNo: { contains: query.q } },
            { phieuXuatHang: { maPhieuXuatHang: { contains: query.q } } },
            {
              phieuXuatHang: { khachHang: { tenKH: { contains: query.q } } },
            },
          ]
        : undefined,
    };
    const orderBy = toOrderBy(
      parseSort(query.sort, SORT_WHITELIST, [
        { field: 'ngayThanhToan', direction: 'desc' },
      ]),
    ) as Prisma.PhieuThuCongNoOrderByWithRelationInput[];

    return paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.phieuThuCongNo.findMany({
          where,
          orderBy,
          skip,
          take,
          include: phieuThuInclude,
        }),
      count: () => this.prisma.phieuThuCongNo.count({ where }),
      map: toPhieuThuResponse,
    });
  }

  async findOne(id: string): Promise<PhieuThuResponseDto> {
    const row = await this.prisma.phieuThuCongNo.findUnique({
      where: { id },
      include: phieuThuInclude,
    });
    if (!row) {
      throw new AppException('PHIEU_THU_NOT_FOUND');
    }
    return toPhieuThuResponse(row);
  }

  async create(
    dto: CreatePhieuThuDto,
    actor: AuthenticatedUser,
  ): Promise<PhieuThuResponseDto> {
    const soTien = new Prisma.Decimal(dto.soTien);
    const ngayThanhToan = parseDateOnly(dto.ngayThanhToan);

    const id = await this.prisma.$transaction(async (tx) => {
      // Locking read on the order is the first statement: concurrent receipts for the same
      // order run one after another, so "check the debt, then write" is safe.
      const locked = await tx.$queryRaw<
        {
          trang_thai: string;
          ngay_xuat_kho: Date | null;
          nhan_vien_ban_hang_id: string | null;
        }[]
      >`SELECT trang_thai, ngay_xuat_kho, nhan_vien_ban_hang_id FROM phieu_xuat_hang
        WHERE id = ${dto.phieuXuatHangId} FOR UPDATE`;
      const order = locked[0];
      if (!order) {
        throw new AppException('PHIEU_XUAT_NOT_FOUND');
      }
      if (
        order.trang_thai !== 'da_xuat_kho' &&
        order.trang_thai !== 'da_giao'
      ) {
        throw new AppException('PHIEU_THU_ORDER_INVALID_STATE');
      }
      assertReceiptDate(ngayThanhToan, this.clock.today(), order.ngay_xuat_kho);
      const discount = paymentDiscount(
        soTien,
        dto.tyLeChietKhau,
        dto.tienChietKhau,
      );
      // The discount reduces the debt like cash does, but is not money received.
      const giamNo = soTien.plus(discount.tienChietKhau);
      const { conNo } = await this.phieuXuat.getReceivableSummary(
        dto.phieuXuatHangId,
        tx,
      );
      assertAmountWithinDebt(giamNo, conNo);
      if (dto.nhanVienBanHangId) {
        await this.nhanVien.assertUsable(dto.nhanVienBanHangId, tx);
      }

      const created = await tx.phieuThuCongNo.create({
        data: {
          maPhieuThuCongNo: await this.codes.next(CODE.PHIEU_THU, tx),
          soTien,
          ngayThanhToan,
          phuongThuc: dto.phuongThuc,
          ghiChu: dto.ghiChu ?? null,
          nguoiNop: dto.nguoiNop ?? null,
          ngayGhiSoQuy: dto.ngayGhiSoQuy
            ? parseDateOnly(dto.ngayGhiSoQuy)
            : null,
          nhanVienBanHangId:
            dto.nhanVienBanHangId === undefined
              ? order.nhan_vien_ban_hang_id
              : dto.nhanVienBanHangId,
          tyLeChietKhau: discount.tyLeChietKhau,
          tienChietKhau: discount.tienChietKhau,
          phieuXuatHangId: dto.phieuXuatHangId,
          createdById: actor.id,
        },
      });
      await this.doiTru.apply(
        {
          phieuThuCongNoId: created.id,
          phieuXuatHangId: dto.phieuXuatHangId,
          soTien: giamNo,
        },
        actor,
        tx,
      );
      return created.id;
    });
    this.logger.info(
      { event: 'phieu_thu.created', phieuThuId: id },
      'receipt created',
    );
    return this.findOne(id);
  }

  // One receipt for several orders of a customer. Money not applied stays on the receipt and can
  // be applied later through "đối trừ chứng từ".
  async createThuGop(
    dto: CreateThuGopDto,
    actor: AuthenticatedUser,
  ): Promise<PhieuThuResponseDto> {
    const soTien = new Prisma.Decimal(dto.soTien);
    const ngayThanhToan = parseDateOnly(dto.ngayThanhToan);
    if (Boolean(dto.phanBo?.length) === Boolean(dto.tuDongPhanBo)) {
      throw new AppException('VALIDATION_FAILED', {
        details: [
          {
            field: 'phanBo',
            messages: ['Gửi đúng một trong phanBo hoặc tuDongPhanBo = true'],
          },
        ],
      });
    }

    const id = await this.prisma.$transaction(async (tx) => {
      // The locking read must be the first statement: a plain read before it would fix the
      // snapshot, and the debt would then be computed from data older than the lock.
      const locked = dto.tuDongPhanBo
        ? await tx.$queryRaw<LockedOrder[]>`
            SELECT id, trang_thai, ngay_xuat_kho, nhan_vien_ban_hang_id, khach_hang_id
            FROM phieu_xuat_hang
            WHERE khach_hang_id = ${dto.khachHangId} AND trang_thai IN ('da_xuat_kho', 'da_giao')
            ORDER BY ngay_xuat_kho ASC, ma_phieu_xuat_hang ASC FOR UPDATE`
        : await tx.$queryRaw<LockedOrder[]>`
            SELECT id, trang_thai, ngay_xuat_kho, nhan_vien_ban_hang_id, khach_hang_id
            FROM phieu_xuat_hang
            WHERE id IN (${Prisma.join(dto.phanBo!.map((p) => p.phieuXuatHangId))})
            ORDER BY id ASC FOR UPDATE`;
      const customer = await tx.khachHang.findUnique({
        where: { id: dto.khachHangId },
        select: { id: true },
      });
      if (!customer) {
        throw new AppException('KHACH_HANG_NOT_FOUND');
      }
      const byId = new Map(locked.map((o) => [o.id, o]));

      const requested = dto.tuDongPhanBo
        ? locked.map((o) => ({ phieuXuatHangId: o.id, soTien: null }))
        : dto.phanBo!.map((p) => ({
            phieuXuatHangId: p.phieuXuatHangId,
            soTien: new Prisma.Decimal(p.soTien),
          }));
      if (
        new Set(requested.map((r) => r.phieuXuatHangId)).size !==
        requested.length
      ) {
        throw new AppException('PHIEU_THU_ALLOCATION_INVALID');
      }

      const allocations: { order: LockedOrder; soTien: Prisma.Decimal }[] = [];
      let remaining = soTien;
      for (const item of requested) {
        const order = byId.get(item.phieuXuatHangId);
        if (!order) {
          throw new AppException('PHIEU_XUAT_NOT_FOUND');
        }
        if (order.khach_hang_id !== dto.khachHangId) {
          throw new AppException('PHIEU_THU_CUSTOMER_MISMATCH');
        }
        if (
          order.trang_thai !== 'da_xuat_kho' &&
          order.trang_thai !== 'da_giao'
        ) {
          throw new AppException('PHIEU_THU_ORDER_INVALID_STATE');
        }
        const { conNo } = await this.phieuXuat.getReceivableSummary(
          order.id,
          tx,
        );
        let part: Prisma.Decimal;
        if (item.soTien) {
          part = item.soTien;
          assertAmountWithinDebt(part, conNo);
        } else {
          part = Prisma.Decimal.min(remaining, conNo);
          if (part.lte(0)) {
            continue;
          }
        }
        assertReceiptDate(
          ngayThanhToan,
          this.clock.today(),
          order.ngay_xuat_kho,
        );
        if (part.gt(remaining)) {
          throw new AppException('PHIEU_THU_ALLOCATION_INVALID');
        }
        remaining = remaining.minus(part);
        allocations.push({ order, soTien: part });
        if (remaining.lte(0) && dto.tuDongPhanBo) {
          break;
        }
      }
      if (allocations.length === 0) {
        // Nothing owed to apply the money to.
        throw new AppException('PHIEU_THU_EXCEEDS_DEBT', {
          params: { conNo: '0.00' },
          details: { conNo: '0.00' },
        });
      }
      if (dto.nhanVienBanHangId) {
        await this.nhanVien.assertUsable(dto.nhanVienBanHangId, tx);
      }

      const anchor = allocations[0]!.order;
      const created = await tx.phieuThuCongNo.create({
        data: {
          maPhieuThuCongNo: await this.codes.next(CODE.PHIEU_THU, tx),
          soTien,
          ngayThanhToan,
          phuongThuc: dto.phuongThuc,
          ghiChu: dto.ghiChu ?? null,
          nguoiNop: dto.nguoiNop ?? null,
          ngayGhiSoQuy: dto.ngayGhiSoQuy
            ? parseDateOnly(dto.ngayGhiSoQuy)
            : null,
          nhanVienBanHangId:
            dto.nhanVienBanHangId === undefined
              ? anchor.nhan_vien_ban_hang_id
              : dto.nhanVienBanHangId,
          phieuXuatHangId: anchor.id,
          createdById: actor.id,
        },
      });
      for (const allocation of allocations) {
        await this.doiTru.apply(
          {
            phieuThuCongNoId: created.id,
            phieuXuatHangId: allocation.order.id,
            soTien: allocation.soTien,
          },
          actor,
          tx,
        );
      }
      return created.id;
    });
    this.logger.info(
      { event: 'phieu_thu.created', phieuThuId: id, gop: true },
      'combined receipt created',
    );
    return this.findOne(id);
  }

  // Named `voidReceipt` because `void` is reserved in JavaScript.
  async voidReceipt(
    id: string,
    dto: HuyPhieuDto,
    actor: AuthenticatedUser,
  ): Promise<PhieuThuResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.phieuThuCongNo.updateMany({
        where: { id, huyAt: null },
        data: {
          huyAt: this.clock.now(),
          huyById: actor.id,
          lyDoHuy: dto.lyDo,
        },
      });
      if (count !== 1) {
        const exists = await tx.phieuThuCongNo.findUnique({ where: { id } });
        throw new AppException(
          exists ? 'PHIEU_THU_ALREADY_VOID' : 'PHIEU_THU_NOT_FOUND',
        );
      }
      await this.doiTru.removeAllOfReceipt(id, tx);
      await this.audit.record(
        {
          hanhDong: 'phieu_thu.void',
          doiTuong: 'phieu_thu_cong_no',
          doiTuongId: id,
          lyDo: dto.lyDo,
        },
        tx,
      );
    });
    this.logger.info(
      { event: 'phieu_thu.voided', phieuThuId: id },
      'receipt voided',
    );
    return this.findOne(id);
  }

  async congNoKhachHang(
    khachHangId: string,
    query: CongNoKhachQueryDto,
  ): Promise<CongNoKhachResponseDto> {
    const customer = await this.prisma.khachHang.findUnique({
      where: { id: khachHangId },
      select: { id: true, maKH: true, tenKH: true, soNoToiDa: true },
    });
    if (!customer) {
      throw new AppException('KHACH_HANG_NOT_FOUND');
    }
    const orders = await this.prisma.phieuXuatHang.findMany({
      where: {
        khachHangId,
        trangThai: { in: ['da_xuat_kho', 'da_giao'] },
      },
      orderBy: [{ ngayXuatKho: 'asc' }, { maPhieuXuatHang: 'asc' }],
      select: {
        id: true,
        maPhieuXuatHang: true,
        ngayXuatKho: true,
        hanThanhToan: true,
        ...debtSelect,
      },
    });
    const today = this.clock.today();
    let tongPhaiThu = ZERO;
    let daThu = ZERO;
    const phieuConNo: CongNoPhieuXuatDto[] = [];
    for (const order of orders) {
      const debt = computeDebt(order);
      const { tongTien, conNo } = debt;
      // Goods returned count as settled, like receipts.
      const collected = debt.daThu.plus(debt.giaTriTraLai);
      tongPhaiThu = tongPhaiThu.plus(tongTien);
      daThu = daThu.plus(collected);
      if ((query.chiConNo ?? true) && conNo.lte(0)) {
        continue;
      }
      const soNgayNo = order.ngayXuatKho
        ? diffDays(today, order.ngayXuatKho)
        : 0;
      phieuConNo.push({
        phieuXuatId: order.id,
        maPhieuXuatHang: order.maPhieuXuatHang,
        ngayXuatKho: order.ngayXuatKho
          ? formatDateOnly(order.ngayXuatKho)
          : null,
        tongTien: moneyString(tongTien),
        daThu: moneyString(collected),
        conNo: moneyString(conNo),
        soNgayNo,
        hanThanhToan: order.hanThanhToan
          ? formatDateOnly(order.hanThanhToan)
          : null,
        soNgayQuaHan: overdueDays(order.hanThanhToan, today),
        nhomTuoiNo: ageBucket(soNgayNo),
      });
    }
    const conNoTong = tongPhaiThu.minus(daThu);
    const hasLimit = customer.soNoToiDa.gt(0);
    return {
      khachHang: {
        id: customer.id,
        maKH: customer.maKH,
        tenKH: customer.tenKH,
        hanMucCongNo: hasLimit ? moneyString(customer.soNoToiDa) : null,
      },
      tongPhaiThu: moneyString(tongPhaiThu),
      daThu: moneyString(daThu),
      conNo: moneyString(conNoTong),
      vuotHanMuc: hasLimit ? conNoTong.gt(customer.soNoToiDa) : null,
      phieuConNo,
      generatedAt: this.clock.now(),
    };
  }
}
