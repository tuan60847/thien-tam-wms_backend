import { Prisma } from '@prisma/client';
import { computeNetTotals, percentOf, type NetLine } from '../common/money.js';

export interface QuoteLine {
  soLuong: number;
  donGia: Prisma.Decimal;
  tyLeChietKhau: Prisma.Decimal;
  thueSuatGtgt: Prisma.Decimal;
}

// A quote stores only rates; the amounts are derived exactly like on a sales order:
// discount on the gross amount, VAT on the amount after discount (half-up, 2 decimals).
export function quoteLineAmounts(line: QuoteLine): NetLine {
  const gross = line.donGia.mul(line.soLuong);
  const tienChietKhau = percentOf(gross, line.tyLeChietKhau);
  return {
    soLuong: line.soLuong,
    donGia: line.donGia,
    tienChietKhau,
    tienThueGtgt: percentOf(gross.minus(tienChietKhau), line.thueSuatGtgt),
  };
}

export const quoteTotals = (lines: QuoteLine[]) =>
  computeNetTotals(lines.map(quoteLineAmounts));

// Valid through its last day (same convention as lot expiry).
export function isExpired(hanHieuLuc: Date | null, today: Date): boolean {
  return hanHieuLuc !== null && hanHieuLuc.getTime() < today.getTime();
}

export interface AllocationInput {
  chiTietBaoGiaId: string;
  soLoId: string;
  viTriId: string;
  soLuong: number;
}

// Explicit lot allocation must cover every quote line exactly (no more, no less).
export function allocationCoversQuote(
  quoteLines: { id: string; soLuong: number }[],
  allocation: AllocationInput[],
): boolean {
  const allocated = new Map<string, number>();
  for (const a of allocation) {
    allocated.set(
      a.chiTietBaoGiaId,
      (allocated.get(a.chiTietBaoGiaId) ?? 0) + a.soLuong,
    );
  }
  if (allocated.size !== quoteLines.length) {
    return false;
  }
  return quoteLines.every((l) => allocated.get(l.id) === l.soLuong);
}
