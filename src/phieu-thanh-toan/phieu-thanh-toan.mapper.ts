import type { Prisma } from '@prisma/client';
import { formatDateOnly } from '../common/clock/vn-date.js';
import { computeTotals, moneyString, sumMoney } from '../common/money.js';
import type { PhieuThanhToanResponseDto } from './dto/phieu-thanh-toan.dto.js';

const userSelect = { select: { id: true, maNV: true, hoTen: true } } as const;

export const phieuThanhToanInclude = {
  createdBy: userSelect,
  huyBoi: userSelect,
  phieuNhapHang: {
    select: {
      id: true,
      maPhieuNhapHang: true,
      nhaCungCap: { select: { id: true, maNCC: true, tenNCC: true } },
      chiTietPhieuNhapHangs: { select: { soLuong: true, donGia: true } },
      phieuThanhToans: { select: { soTien: true, huyAt: true } },
    },
  },
} as const satisfies Prisma.PhieuThanhToanInclude;

export type PhieuThanhToanRow = Prisma.PhieuThanhToanGetPayload<{
  include: typeof phieuThanhToanInclude;
}>;

export function toPhieuThanhToanResponse(
  row: PhieuThanhToanRow,
): PhieuThanhToanResponseDto {
  const receipt = row.phieuNhapHang;
  const tongTien = computeTotals(receipt.chiTietPhieuNhapHangs);
  const daThanhToan = sumMoney(
    receipt.phieuThanhToans.filter((t) => !t.huyAt).map((t) => t.soTien),
  );
  return {
    id: row.id,
    maPhieuThanhToan: row.maPhieuThanhToan,
    soTien: moneyString(row.soTien),
    ngayThanhToan: formatDateOnly(row.ngayThanhToan),
    phuongThuc: row.phuongThuc,
    ghiChu: row.ghiChu,
    phieuNhap: {
      id: receipt.id,
      maPhieuNhapHang: receipt.maPhieuNhapHang,
      tongTien: moneyString(tongTien),
      conNoSauKhiTra: moneyString(tongTien.minus(daThanhToan)),
      nhaCungCap: receipt.nhaCungCap,
    },
    huyAt: row.huyAt,
    huyBoi: row.huyBoi,
    lyDoHuy: row.lyDoHuy,
    daHuy: row.huyAt !== null,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}
