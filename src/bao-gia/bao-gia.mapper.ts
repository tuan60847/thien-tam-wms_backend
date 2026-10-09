import type { Prisma } from '@prisma/client';
import { formatDateOnly } from '../common/clock/vn-date.js';
import { lineAmount, moneyString } from '../common/money.js';
import type {
  BaoGiaListItemDto,
  BaoGiaResponseDto,
} from './dto/bao-gia.dto.js';
import { isExpired, quoteLineAmounts, quoteTotals } from './bao-gia.rules.js';

// Plain object shape of a response class (spreading class instances trips the linter).
type Plain<T> = { [K in keyof T]: T[K] };

const userSelect = { select: { id: true, maNV: true, hoTen: true } } as const;

export const baoGiaListInclude = {
  khachHang: { select: { id: true, maKH: true, tenKH: true } },
  chiTiets: {
    select: {
      soLuong: true,
      donGia: true,
      tyLeChietKhau: true,
      thueSuatGtgt: true,
    },
  },
  phieuXuatHangs: {
    select: { id: true, maPhieuXuatHang: true, trangThai: true },
  },
} as const satisfies Prisma.BaoGiaInclude;

export const baoGiaDetailInclude = {
  khachHang: { select: { id: true, maKH: true, tenKH: true } },
  nhanVienBanHang: userSelect,
  createdBy: userSelect,
  chiTiets: {
    // Lines have no sequence column, so they are shown by product name.
    orderBy: [{ hangHoa: { tenSP: 'asc' } }, { id: 'asc' }],
    include: { hangHoa: { select: { id: true, maSP: true, tenSP: true } } },
  },
  phieuXuatHangs: {
    orderBy: { createdAt: 'asc' },
    select: { id: true, maPhieuXuatHang: true, trangThai: true },
  },
} as const satisfies Prisma.BaoGiaInclude;

export type BaoGiaListRow = Prisma.BaoGiaGetPayload<{
  include: typeof baoGiaListInclude;
}>;
export type BaoGiaDetailRow = Prisma.BaoGiaGetPayload<{
  include: typeof baoGiaDetailInclude;
}>;

// Cancelled orders no longer count: the quote can be converted again.
export const hasLiveOrder = (orders: { trangThai: string }[]): boolean =>
  orders.some((o) => o.trangThai !== 'da_huy');

function toListItem(
  row: BaoGiaListRow | BaoGiaDetailRow,
  today: Date,
): Plain<BaoGiaListItemDto> {
  const totals = quoteTotals(row.chiTiets);
  return {
    id: row.id,
    maBaoGia: row.maBaoGia,
    ngayBaoGia: formatDateOnly(row.ngayBaoGia),
    hanHieuLuc: row.hanHieuLuc ? formatDateOnly(row.hanHieuLuc) : null,
    conHieuLuc: !isExpired(row.hanHieuLuc, today),
    daChuyenPhieuXuat: hasLiveOrder(row.phieuXuatHangs),
    khachHang: row.khachHang,
    soDong: row.chiTiets.length,
    tongTienHang: moneyString(totals.tongTienHang),
    tienChietKhau: moneyString(totals.tienChietKhau),
    tienThueGtgt: moneyString(totals.tienThueGtgt),
    tongThanhToan: moneyString(totals.tongThanhToan),
    createdAt: row.createdAt,
  };
}

export const toBaoGiaListItem =
  (today: Date) =>
  (row: BaoGiaListRow): BaoGiaListItemDto =>
    toListItem(row, today);

export function toBaoGiaResponse(
  row: BaoGiaDetailRow,
  today: Date,
): BaoGiaResponseDto {
  return {
    ...toListItem(row, today),
    ghiChu: row.ghiChu,
    nhanVienBanHang: row.nhanVienBanHang,
    createdBy: row.createdBy,
    chiTiet: row.chiTiets.map((line) => {
      const amounts = quoteLineAmounts(line);
      return {
        id: line.id,
        hangHoa: line.hangHoa,
        donViTinh: line.donViTinh,
        soLuong: line.soLuong,
        donGia: moneyString(line.donGia),
        thanhTien: moneyString(lineAmount(line)),
        tyLeChietKhau: moneyString(line.tyLeChietKhau),
        tienChietKhau: moneyString(amounts.tienChietKhau),
        thueSuatGtgt: moneyString(line.thueSuatGtgt),
        tienThueGtgt: moneyString(amounts.tienThueGtgt),
      };
    }),
    phieuXuats: row.phieuXuatHangs.map((o) => ({
      id: o.id,
      maPhieuXuatHang: o.maPhieuXuatHang,
      trangThai: o.trangThai,
    })),
    updatedAt: row.updatedAt,
  };
}
