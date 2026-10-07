import type { Prisma } from '@prisma/client';
import { formatDateOnly } from '../common/clock/vn-date.js';
import { computeTotals, moneyString, sumMoney } from '../common/money.js';
import type { PhieuThuResponseDto } from './dto/phieu-thu.dto.js';

const userSelect = { select: { id: true, maNV: true, hoTen: true } } as const;

export const phieuThuInclude = {
  createdBy: userSelect,
  huyBoi: userSelect,
  phieuXuatHang: {
    select: {
      id: true,
      maPhieuXuatHang: true,
      ngayXuatKho: true,
      khachHang: { select: { id: true, maKH: true, tenKH: true } },
      chiTietPhieuXuatHangs: { select: { soLuong: true, donGia: true } },
      phieuThuCongNos: { select: { soTien: true, huyAt: true } },
    },
  },
} as const satisfies Prisma.PhieuThuCongNoInclude;

export type PhieuThuRow = Prisma.PhieuThuCongNoGetPayload<{
  include: typeof phieuThuInclude;
}>;

export function toPhieuThuResponse(row: PhieuThuRow): PhieuThuResponseDto {
  const order = row.phieuXuatHang;
  const tongTien = computeTotals(order.chiTietPhieuXuatHangs);
  const daThu = sumMoney(
    order.phieuThuCongNos.filter((t) => !t.huyAt).map((t) => t.soTien),
  );
  return {
    id: row.id,
    maPhieuThuCongNo: row.maPhieuThuCongNo,
    soTien: moneyString(row.soTien),
    ngayThanhToan: formatDateOnly(row.ngayThanhToan),
    phuongThuc: row.phuongThuc,
    ghiChu: row.ghiChu,
    phieuXuat: {
      id: order.id,
      maPhieuXuatHang: order.maPhieuXuatHang,
      ngayXuatKho: order.ngayXuatKho ? formatDateOnly(order.ngayXuatKho) : null,
      tongTien: moneyString(tongTien),
      conNoSauKhiThu: moneyString(tongTien.minus(daThu)),
      khachHang: order.khachHang,
    },
    huyAt: row.huyAt,
    huyBoi: row.huyBoi,
    lyDoHuy: row.lyDoHuy,
    daHuy: row.huyAt !== null,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}
