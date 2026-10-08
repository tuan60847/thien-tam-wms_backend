import type { Prisma, TrangThaiPhieuNhap } from '@prisma/client';
import { AppException } from '../common/errors/app.exception.js';
import { ZERO } from '../common/money.js';

// A return follows the same lifecycle as a goods receipt: draft -> received -> cancelled.
const TRANSITIONS: Record<TrangThaiPhieuNhap, TrangThaiPhieuNhap[]> = {
  cho_xac_nhan: ['da_nhap_kho', 'da_huy'],
  da_nhap_kho: ['da_huy'],
  da_huy: [],
};

export function assertTransition(
  from: TrangThaiPhieuNhap,
  to: TrangThaiPhieuNhap,
): void {
  if (!TRANSITIONS[from].includes(to)) {
    throw new AppException('TRA_LAI_INVALID_STATE');
  }
}

export interface ReturnLine {
  soLuong: number;
  donGia: Prisma.Decimal;
  tienChietKhau: Prisma.Decimal;
}

// Value of one returned line: quantity × price − discount.
export const lineValue = (line: ReturnLine): Prisma.Decimal =>
  line.donGia.mul(line.soLuong).minus(line.tienChietKhau);

export const totalValue = (lines: ReturnLine[]): Prisma.Decimal =>
  lines.reduce((sum, line) => sum.plus(lineValue(line)), ZERO);

// How many base units of a sold line can still be returned.
export const returnableQuantity = (
  sold: number,
  alreadyReturned: number,
): number => Math.max(0, sold - alreadyReturned);
