import type { Prisma } from '@prisma/client';
import { computeNetTotals, ZERO } from '../common/money.js';

// What is needed to work out how much a customer still owes on one sales order.
export const debtSelect = {
  chiTietPhieuXuatHangs: {
    select: {
      soLuong: true,
      donGia: true,
      tienChietKhau: true,
      tienThueGtgt: true,
    },
  },
  // Amounts of receipts applied to this order (removed ones are skipped in computeDebt).
  doiTrus: { select: { soTienDoiTru: true, daBoDoiTru: true } },
  // Goods the customer gave back and that were taken into stock again.
  traLaiHangBans: {
    where: { trangThai: 'da_nhap_kho' },
    select: {
      chiTiets: {
        select: { soLuong: true, donGia: true, tienChietKhau: true },
      },
    },
  },
} as const satisfies Prisma.PhieuXuatHangSelect;

export type DebtRow = Prisma.PhieuXuatHangGetPayload<{
  select: typeof debtSelect;
}>;

export interface Debt {
  tongTienHang: Prisma.Decimal;
  tienChietKhau: Prisma.Decimal;
  tienThueGtgt: Prisma.Decimal;
  // Payable = goods − discount + VAT.
  tongTien: Prisma.Decimal;
  daThu: Prisma.Decimal;
  giaTriTraLai: Prisma.Decimal;
  conNo: Prisma.Decimal;
}

// Value of returned goods: quantity × price − discount (VAT is not refunded separately).
export function returnedValue(
  traLais: DebtRow['traLaiHangBans'],
): Prisma.Decimal {
  return traLais
    .flatMap((t) => t.chiTiets)
    .reduce(
      (sum, l) => sum.plus(l.donGia.mul(l.soLuong)).minus(l.tienChietKhau),
      ZERO,
    );
}

export function computeDebt(
  row: Pick<DebtRow, 'chiTietPhieuXuatHangs' | 'doiTrus' | 'traLaiHangBans'>,
): Debt {
  const totals = computeNetTotals(row.chiTietPhieuXuatHangs);
  const daThu = row.doiTrus
    .filter((d) => !d.daBoDoiTru)
    .reduce((sum, d) => sum.plus(d.soTienDoiTru), ZERO);
  const giaTriTraLai = returnedValue(row.traLaiHangBans);
  return {
    tongTienHang: totals.tongTienHang,
    tienChietKhau: totals.tienChietKhau,
    tienThueGtgt: totals.tienThueGtgt,
    tongTien: totals.tongThanhToan,
    daThu,
    giaTriTraLai,
    conNo: totals.tongThanhToan.minus(daThu).minus(giaTriTraLai),
  };
}
