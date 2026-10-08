import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClockService } from '../common/clock/clock.service.js';
import { parseDateOnly } from '../common/clock/vn-date.js';
import { AppException } from '../common/errors/app.exception.js';
import { computeNetTotals, moneyString, ZERO } from '../common/money.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  addToAging,
  ageInDays,
  assertGroupCount,
  emptyAging,
  toDecimal,
  toInt,
  toUtcRange,
  type AgingTotals,
  type RawNumber,
} from './bao-cao.rules.js';
import type {
  BaoCaoCongNoPhaiThuResponseDto,
  BaoCaoCongNoPhaiTraResponseDto,
  BaoCaoCongNoQueryDto,
  BaoCaoDoanhThuQueryDto,
  BaoCaoDoanhThuResponseDto,
  BaoCaoTopBanChayQueryDto,
  BaoCaoTopBanChayResponseDto,
  CongNoAgingDto,
  DoanhThuItemDto,
} from './dto/bao-cao.dto.js';

const ISSUED = Prisma.sql`p.trang_thai IN ('da_xuat_kho', 'da_giao')`;

// Plain-object view of the DTO class, so results can be spread safely.
type Plain<T> = { [K in keyof T]: T[K] };

const agingDto = (
  aging: AgingTotals,
  soPhieuConNo: number,
): Plain<CongNoAgingDto> => ({
  nhom0_30: moneyString(aging.nhom0_30),
  nhom31_60: moneyString(aging.nhom31_60),
  nhom61_90: moneyString(aging.nhom61_90),
  nhomTren90: moneyString(aging.nhomTren90),
  tongConNo: moneyString(
    aging.nhom0_30
      .plus(aging.nhom31_60)
      .plus(aging.nhom61_90)
      .plus(aging.nhomTren90),
  ),
  soPhieuConNo,
});

const addAging = (into: AgingTotals, from: AgingTotals): void => {
  into.nhom0_30 = into.nhom0_30.plus(from.nhom0_30);
  into.nhom31_60 = into.nhom31_60.plus(from.nhom31_60);
  into.nhom61_90 = into.nhom61_90.plus(from.nhom61_90);
  into.nhomTren90 = into.nhomTren90.plus(from.nhomTren90);
};

// Sales and receivable / payable reports (read only).
@Injectable()
export class BaoCaoKinhDoanhService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  // ---------------------------------------------------------------------------
  // Doanh thu
  // ---------------------------------------------------------------------------

  async doanhThu(
    query: BaoCaoDoanhThuQueryDto,
  ): Promise<BaoCaoDoanhThuResponseDto> {
    toUtcRange(query.tuNgay, query.denNgay); // validates the range
    const groupBy = query.groupBy ?? 'ngay';
    const from = parseDateOnly(query.tuNgay);
    const to = parseDateOnly(query.denNgay);
    const filters = this.salesFilters(from, to, query);

    const key = {
      ngay: {
        id: Prisma.sql`DATE_FORMAT(p.ngay_xuat_kho, '%Y-%m-%d')`,
        name: Prisma.sql`DATE_FORMAT(p.ngay_xuat_kho, '%Y-%m-%d')`,
      },
      thang: {
        id: Prisma.sql`DATE_FORMAT(p.ngay_xuat_kho, '%Y-%m')`,
        name: Prisma.sql`DATE_FORMAT(p.ngay_xuat_kho, '%Y-%m')`,
      },
      'khach-hang': { id: Prisma.sql`kh.id`, name: Prisma.sql`kh.ten_kh` },
      'hang-hoa': { id: Prisma.sql`h.id`, name: Prisma.sql`h.ten_sp` },
      'nguoi-tao': {
        id: Prisma.sql`COALESCE(u.id, '-')`,
        name: Prisma.sql`COALESCE(u.ho_ten, 'Không xác định')`,
      },
    }[groupBy];

    const rows = await this.prisma.$queryRaw<
      {
        khoa: string;
        ten: string;
        so_phieu: RawNumber;
        so_luong: RawNumber;
        tien_hang: RawNumber;
        chiet_khau: RawNumber;
      }[]
    >`
      SELECT ${key.id} AS khoa, ${key.name} AS ten,
        COUNT(DISTINCT p.id) AS so_phieu,
        SUM(c.so_luong_co_ban) AS so_luong,
        SUM(c.so_luong * c.don_gia) AS tien_hang,
        SUM(c.tien_chiet_khau) AS chiet_khau
      ${this.salesFrom(filters)}
      GROUP BY ${key.id}, ${key.name}
      ORDER BY ten ASC, khoa ASC`;
    assertGroupCount(rows.length);

    const items: DoanhThuItemDto[] = rows.map((r) => {
      const tienHang = toDecimal(r.tien_hang);
      const chietKhau = toDecimal(r.chiet_khau);
      return {
        nhom: { khoa: String(r.khoa), ten: String(r.ten) },
        soPhieu: toInt(r.so_phieu),
        soLuongCoBan: toInt(r.so_luong),
        tienHang: moneyString(tienHang),
        chietKhau: moneyString(chietKhau),
        doanhThu: moneyString(tienHang.minus(chietKhau)),
      };
    });

    // Totals are computed on their own: a plain sum of groups would count an order twice when
    // grouped by product.
    const [total] = await this.prisma.$queryRaw<
      {
        so_phieu: RawNumber;
        so_luong: RawNumber;
        tien_hang: RawNumber;
        chiet_khau: RawNumber;
        thue: RawNumber;
      }[]
    >`
      SELECT COUNT(DISTINCT p.id) AS so_phieu, SUM(c.so_luong_co_ban) AS so_luong,
        SUM(c.so_luong * c.don_gia) AS tien_hang, SUM(c.tien_chiet_khau) AS chiet_khau,
        SUM(c.tien_thue_gtgt) AS thue
      ${this.salesFrom(filters)}`;
    const tienHang = toDecimal(total?.tien_hang);
    const chietKhau = toDecimal(total?.chiet_khau);
    const doanhThu = tienHang.minus(chietKhau);
    const giaTriTraLai = await this.returnedValue(from, to, query.khachHangId);
    return {
      items,
      tong: {
        soPhieu: toInt(total?.so_phieu),
        soLuongCoBan: toInt(total?.so_luong),
        tienHang: moneyString(tienHang),
        chietKhau: moneyString(chietKhau),
        tienThueGtgt: moneyString(toDecimal(total?.thue)),
        doanhThu: moneyString(doanhThu),
        giaTriTraLai: moneyString(giaTriTraLai),
        doanhThuThuan: moneyString(doanhThu.minus(giaTriTraLai)),
      },
      groupBy,
      kyBaoCao: { tuNgay: query.tuNgay, denNgay: query.denNgay },
      generatedAt: this.clock.now(),
    };
  }

  async topBanChay(
    query: BaoCaoTopBanChayQueryDto,
  ): Promise<BaoCaoTopBanChayResponseDto> {
    toUtcRange(query.tuNgay, query.denNgay);
    const filters = this.salesFilters(
      parseDateOnly(query.tuNgay),
      parseDateOnly(query.denNgay),
      { loaiHangId: query.loaiHangId },
    );
    const limit = query.limit ?? 10;
    const byQuantity = query.tieuChi === 'so-luong';
    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        ma_sp: string;
        ten_sp: string;
        so_luong: RawNumber;
        doanh_thu: RawNumber;
        so_phieu: RawNumber;
      }[]
    >`
      SELECT h.id, h.ma_sp, h.ten_sp,
        SUM(c.so_luong_co_ban) AS so_luong,
        SUM(c.so_luong * c.don_gia - c.tien_chiet_khau) AS doanh_thu,
        COUNT(DISTINCT p.id) AS so_phieu
      ${this.salesFrom(filters)}
      GROUP BY h.id, h.ma_sp, h.ten_sp
      ORDER BY ${byQuantity ? Prisma.sql`so_luong` : Prisma.sql`doanh_thu`} DESC, h.ten_sp ASC
      LIMIT ${limit}`;
    const units = await this.prisma.tyLeQuyDoi.findMany({
      where: { hangHoaId: { in: rows.map((r) => r.id) }, soLuongQuyDoi: 1 },
      select: { hangHoaId: true, donViTinh: true },
    });
    const unitOf = new Map(units.map((u) => [u.hangHoaId, u.donViTinh]));
    return {
      items: rows.map((r, index) => ({
        hang: index + 1,
        hangHoa: {
          id: r.id,
          maSP: r.ma_sp,
          tenSP: r.ten_sp,
          donViCoBan: unitOf.get(r.id) ?? null,
        },
        soLuongCoBan: toInt(r.so_luong),
        doanhThu: moneyString(toDecimal(r.doanh_thu)),
        soPhieu: toInt(r.so_phieu),
      })),
      kyBaoCao: { tuNgay: query.tuNgay, denNgay: query.denNgay },
      generatedAt: this.clock.now(),
    };
  }

  // ---------------------------------------------------------------------------
  // Công nợ phải thu / phải trả
  // ---------------------------------------------------------------------------

  // Receivables as of `denNgay` (default today). Receipts and returns dated after it are left
  // out; a receipt applied later but removed since is only known as "removed now" (the ledger
  // does not keep the removal date), so past dates are an approximation.
  async congNoPhaiThu(
    query: BaoCaoCongNoQueryDto,
  ): Promise<BaoCaoCongNoPhaiThuResponseDto> {
    const asOf = this.asOf(query.denNgay);
    const orders = await this.prisma.phieuXuatHang.findMany({
      where: {
        khachHangId: query.khachHangId,
        trangThai: { in: ['da_xuat_kho', 'da_giao'] },
        ngayXuatKho: { lte: asOf },
      },
      select: {
        ngayXuatKho: true,
        khachHang: { select: { id: true, maKH: true, tenKH: true } },
        chiTietPhieuXuatHangs: {
          select: {
            soLuong: true,
            donGia: true,
            tienChietKhau: true,
            tienThueGtgt: true,
          },
        },
        doiTrus: {
          where: { daBoDoiTru: false, ngayDoiTru: { lte: asOf } },
          select: { soTienDoiTru: true },
        },
        traLaiHangBans: {
          where: { trangThai: 'da_nhap_kho', ngayTraLai: { lte: asOf } },
          select: {
            chiTiets: {
              select: { soLuong: true, donGia: true, tienChietKhau: true },
            },
          },
        },
      },
    });

    const groups = new Map<
      string,
      {
        khachHang: { id: string; maKH: string; tenKH: string };
        aging: AgingTotals;
        count: number;
      }
    >();
    for (const order of orders) {
      const total = computeNetTotals(order.chiTietPhieuXuatHangs).tongThanhToan;
      const received = order.doiTrus.reduce(
        (s, d) => s.plus(d.soTienDoiTru),
        ZERO,
      );
      const returned = order.traLaiHangBans
        .flatMap((t) => t.chiTiets)
        .reduce(
          (s, l) => s.plus(l.donGia.mul(l.soLuong)).minus(l.tienChietKhau),
          ZERO,
        );
      const owed = total.minus(received).minus(returned);
      const entry = groups.get(order.khachHang.id) ?? {
        khachHang: order.khachHang,
        aging: emptyAging(),
        count: 0,
      };
      if (owed.gt(0)) {
        addToAging(entry.aging, ageInDays(asOf, order.ngayXuatKho!), owed);
        entry.count += 1;
      }
      groups.set(order.khachHang.id, entry);
    }
    return this.agingReport(
      [...groups.values()],
      query.chiConNo,
      (g) => g.khachHang.tenKH,
      (g) => ({ khachHang: g.khachHang }),
      asOf,
    ) as BaoCaoCongNoPhaiThuResponseDto;
  }

  async congNoPhaiTra(
    query: BaoCaoCongNoQueryDto,
  ): Promise<BaoCaoCongNoPhaiTraResponseDto> {
    const asOf = this.asOf(query.denNgay);
    const receipts = await this.prisma.phieuNhapHang.findMany({
      where: {
        nhaCungCapId: query.nhaCungCapId,
        trangThai: 'da_nhap_kho',
        ngayNhanHang: { lte: asOf },
      },
      select: {
        ngayNhanHang: true,
        nhaCungCap: { select: { id: true, maNCC: true, tenNCC: true } },
        chiTietPhieuNhapHangs: { select: { soLuong: true, donGia: true } },
        phieuThanhToans: {
          where: { huyAt: null, ngayThanhToan: { lte: asOf } },
          select: { soTien: true },
        },
      },
    });
    const groups = new Map<
      string,
      {
        nhaCungCap: { id: string; maNCC: string; tenNCC: string };
        aging: AgingTotals;
        count: number;
      }
    >();
    for (const receipt of receipts) {
      const total = receipt.chiTietPhieuNhapHangs.reduce(
        (s, l) => s.plus(l.donGia.mul(l.soLuong)),
        ZERO,
      );
      const paid = receipt.phieuThanhToans.reduce(
        (s, p) => s.plus(p.soTien),
        ZERO,
      );
      const owed = total.minus(paid);
      const entry = groups.get(receipt.nhaCungCap.id) ?? {
        nhaCungCap: receipt.nhaCungCap,
        aging: emptyAging(),
        count: 0,
      };
      if (owed.gt(0)) {
        addToAging(entry.aging, ageInDays(asOf, receipt.ngayNhanHang!), owed);
        entry.count += 1;
      }
      groups.set(receipt.nhaCungCap.id, entry);
    }
    return this.agingReport(
      [...groups.values()],
      query.chiConNo,
      (g) => g.nhaCungCap.tenNCC,
      (g) => ({ nhaCungCap: g.nhaCungCap }),
      asOf,
    ) as BaoCaoCongNoPhaiTraResponseDto;
  }

  // ---------------------------------------------------------------------------
  // helpers
  // ---------------------------------------------------------------------------

  private asOf(denNgay: string | undefined): Date {
    const today = this.clock.today();
    const date = denNgay ? parseDateOnly(denNgay) : today;
    if (date.getTime() > today.getTime()) {
      throw new AppException('BAO_CAO_RANGE_INVALID');
    }
    return date;
  }

  private agingReport<G extends { aging: AgingTotals; count: number }>(
    groups: G[],
    chiConNo: boolean | undefined,
    sortKey: (group: G) => string,
    label: (group: G) => Record<string, unknown>,
    asOf: Date,
  ) {
    const kept =
      (chiConNo ?? true) ? groups.filter((g) => g.count > 0) : groups;
    assertGroupCount(kept.length);
    kept.sort((a, b) => sortKey(a).localeCompare(sortKey(b), 'vi'));
    const total = emptyAging();
    let count = 0;
    for (const group of kept) {
      addAging(total, group.aging);
      count += group.count;
    }
    return {
      items: kept.map((group) => ({
        ...label(group),
        ...agingDto(group.aging, group.count),
      })),
      tong: agingDto(total, count),
      denNgay: asOf.toISOString().slice(0, 10),
      generatedAt: this.clock.now(),
    };
  }

  private salesFilters(
    from: Date,
    to: Date,
    f: {
      khachHangId?: string;
      hangHoaId?: string;
      loaiHangId?: string;
      createdById?: string;
    },
  ): Prisma.Sql {
    return Prisma.sql`${ISSUED} AND p.ngay_xuat_kho >= ${from} AND p.ngay_xuat_kho <= ${to}
      ${f.khachHangId ? Prisma.sql`AND p.khach_hang_id = ${f.khachHangId}` : Prisma.empty}
      ${f.hangHoaId ? Prisma.sql`AND h.id = ${f.hangHoaId}` : Prisma.empty}
      ${f.loaiHangId ? Prisma.sql`AND h.loai_hang_id = ${f.loaiHangId}` : Prisma.empty}
      ${f.createdById ? Prisma.sql`AND p.created_by_id = ${f.createdById}` : Prisma.empty}`;
  }

  private salesFrom(where: Prisma.Sql): Prisma.Sql {
    return Prisma.sql`FROM phieu_xuat_hang p
      JOIN chi_tiet_phieu_xuat_hang c ON c.phieu_xuat_hang_id = p.id
      JOIN so_lo s ON s.id = c.so_lo_id
      JOIN hang_hoa h ON h.id = s.hang_hoa_id
      JOIN khach_hang kh ON kh.id = p.khach_hang_id
      LEFT JOIN user u ON u.id = p.created_by_id
      WHERE ${where}`;
  }

  // Goods taken back into stock in the period (value before VAT).
  private async returnedValue(
    from: Date,
    to: Date,
    khachHangId: string | undefined,
  ): Promise<Prisma.Decimal> {
    const [row] = await this.prisma.$queryRaw<{ value: RawNumber }[]>`
      SELECT SUM(l.so_luong * l.don_gia - l.tien_chiet_khau) AS value
      FROM chi_tiet_tra_lai l
      JOIN tra_lai_hang_ban t ON t.id = l.tra_lai_id
      WHERE t.trang_thai = 'da_nhap_kho'
        AND t.ngay_tra_lai >= ${from} AND t.ngay_tra_lai <= ${to}
        ${khachHangId ? Prisma.sql`AND t.khach_hang_id = ${khachHangId}` : Prisma.empty}`;
    return toDecimal(row?.value);
  }
}
