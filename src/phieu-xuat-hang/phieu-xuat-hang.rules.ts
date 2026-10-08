import { Prisma, type TrangThaiPhieuXuat } from '@prisma/client';
import { AppException } from '../common/errors/app.exception.js';

export type TrangThaiThu = 'chua_thu' | 'thu_mot_phan' | 'da_thu_du';

const TRANSITIONS: Record<TrangThaiPhieuXuat, TrangThaiPhieuXuat[]> = {
  cho_xu_ly: ['da_xuat_kho', 'da_huy'],
  da_xuat_kho: ['da_giao', 'da_huy'],
  da_giao: [],
  da_huy: [],
};

export function canTransition(
  from: TrangThaiPhieuXuat,
  to: TrangThaiPhieuXuat,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(
  from: TrangThaiPhieuXuat,
  to: TrangThaiPhieuXuat,
): void {
  if (!canTransition(from, to)) {
    throw new AppException('PHIEU_XUAT_INVALID_STATE');
  }
}

// A received-money status only exists once the goods have left the warehouse.
export function receivableStatus(
  trangThai: TrangThaiPhieuXuat,
  tongTien: Prisma.Decimal,
  daThu: Prisma.Decimal,
): TrangThaiThu | null {
  if (trangThai !== 'da_xuat_kho' && trangThai !== 'da_giao') {
    return null;
  }
  if (daThu.gte(tongTien)) {
    return 'da_thu_du';
  }
  return daThu.gt(0) ? 'thu_mot_phan' : 'chua_thu';
}

// A product price is stored per "price unit"; the price of a line unit is
// price × heSo(line unit) ÷ heSo(price unit), rounded half-up to 2 decimals.
export function convertUnitPrice(
  price: Prisma.Decimal,
  heSoDonViDong: number,
  heSoDonViGia: number,
): Prisma.Decimal {
  return price
    .mul(heSoDonViDong)
    .div(heSoDonViGia)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

// Lowest allowed unit price for a line, from the product's per-price-unit minimum.
export const minUnitPrice = convertUnitPrice;

export function isBelowMinimum(
  donGia: Prisma.Decimal,
  minimum: Prisma.Decimal,
): boolean {
  return donGia.lt(minimum);
}

// Soft FEFO warning: the line takes from a lot that expires later than another lot of the
// same product that still has usable stock.
export function isOutOfFefo(
  lineExpiry: Date,
  earliestAvailableExpiry: Date | undefined,
): boolean {
  return (
    earliestAvailableExpiry !== undefined &&
    lineExpiry.getTime() > earliestAvailableExpiry.getTime()
  );
}
