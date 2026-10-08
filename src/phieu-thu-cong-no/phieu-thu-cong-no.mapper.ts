import type { Prisma } from '@prisma/client';
import { formatDateOnly } from '../common/clock/vn-date.js';
import { moneyString, ZERO } from '../common/money.js';
import {
  computeDebt,
  debtSelect,
} from '../phieu-xuat-hang/phieu-xuat-hang.debt.js';
import type { PhieuThuResponseDto } from './dto/phieu-thu.dto.js';

const userSelect = { select: { id: true, maNV: true, hoTen: true } } as const;

export const phieuThuInclude = {
  createdBy: userSelect,
  huyBoi: userSelect,
  nhanVienBanHang: userSelect,
  // The order the receipt is filed under (the first one of a combined receipt).
  phieuXuatHang: {
    select: {
      id: true,
      maPhieuXuatHang: true,
      ngayXuatKho: true,
      khachHang: { select: { id: true, maKH: true, tenKH: true } },
      ...debtSelect,
    },
  },
  doiTrus: {
    orderBy: { createdAt: 'asc' },
    include: {
      phieuXuatHang: { select: { id: true, maPhieuXuatHang: true } },
    },
  },
} as const satisfies Prisma.PhieuThuCongNoInclude;

export type PhieuThuRow = Prisma.PhieuThuCongNoGetPayload<{
  include: typeof phieuThuInclude;
}>;

export function toPhieuThuResponse(row: PhieuThuRow): PhieuThuResponseDto {
  const order = row.phieuXuatHang;
  const debt = computeDebt(order);
  const applied = row.doiTrus
    .filter((d) => !d.daBoDoiTru)
    .reduce((sum, d) => sum.plus(d.soTienDoiTru), ZERO);
  return {
    id: row.id,
    maPhieuThuCongNo: row.maPhieuThuCongNo,
    soTien: moneyString(row.soTien),
    ngayThanhToan: formatDateOnly(row.ngayThanhToan),
    phuongThuc: row.phuongThuc,
    ghiChu: row.ghiChu,
    nguoiNop: row.nguoiNop,
    ngayGhiSoQuy: row.ngayGhiSoQuy ? formatDateOnly(row.ngayGhiSoQuy) : null,
    nhanVienBanHang: row.nhanVienBanHang,
    phieuXuat: {
      id: order.id,
      maPhieuXuatHang: order.maPhieuXuatHang,
      ngayXuatKho: order.ngayXuatKho ? formatDateOnly(order.ngayXuatKho) : null,
      tongTien: moneyString(debt.tongTien),
      conNoSauKhiThu: moneyString(debt.conNo),
      khachHang: order.khachHang,
    },
    phanBo: row.doiTrus.map((d) => ({
      doiTruId: d.id,
      phieuXuatId: d.phieuXuatHang.id,
      maPhieuXuatHang: d.phieuXuatHang.maPhieuXuatHang,
      soTien: moneyString(d.soTienDoiTru),
      daBo: d.daBoDoiTru,
    })),
    soTienChuaDoiTru: moneyString(row.huyAt ? ZERO : row.soTien.minus(applied)),
    huyAt: row.huyAt,
    huyBoi: row.huyBoi,
    lyDoHuy: row.lyDoHuy,
    daHuy: row.huyAt !== null,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}
