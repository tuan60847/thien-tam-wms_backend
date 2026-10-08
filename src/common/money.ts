import { Prisma } from '@prisma/client';

export const ZERO = new Prisma.Decimal(0);

// Money leaves the API as a string with exactly two decimals.
export const moneyString = (value: Prisma.Decimal): string => value.toFixed(2);

export const sumMoney = (values: Prisma.Decimal[]): Prisma.Decimal =>
  values.reduce((total, v) => total.plus(v), ZERO);

export interface MoneyLine {
  soLuong: number;
  donGia: Prisma.Decimal;
}

// Line amount = quantity (in the line's own unit) × unit price (per that unit).
export const lineAmount = (line: MoneyLine): Prisma.Decimal =>
  line.donGia.mul(line.soLuong);

export const computeTotals = (lines: MoneyLine[]): Prisma.Decimal =>
  sumMoney(lines.map(lineAmount));

// A sales line also carries a discount and VAT amount (both default to 0).
export interface NetLine extends MoneyLine {
  tienChietKhau: Prisma.Decimal;
  tienThueGtgt: Prisma.Decimal;
}

// Amount payable for one line = quantity × price − discount + VAT.
export const lineNetAmount = (line: NetLine): Prisma.Decimal =>
  lineAmount(line).minus(line.tienChietKhau).plus(line.tienThueGtgt);

export interface NetTotals {
  tongTienHang: Prisma.Decimal;
  tienChietKhau: Prisma.Decimal;
  tienThueGtgt: Prisma.Decimal;
  tongThanhToan: Prisma.Decimal;
}

export function computeNetTotals(lines: NetLine[]): NetTotals {
  const tongTienHang = computeTotals(lines);
  const tienChietKhau = sumMoney(lines.map((l) => l.tienChietKhau));
  const tienThueGtgt = sumMoney(lines.map((l) => l.tienThueGtgt));
  return {
    tongTienHang,
    tienChietKhau,
    tienThueGtgt,
    tongThanhToan: tongTienHang.minus(tienChietKhau).plus(tienThueGtgt),
  };
}

// VAT / discount style percentage of an amount, rounded half-up to 2 decimals.
export const percentOf = (
  amount: Prisma.Decimal,
  percent: Prisma.Decimal,
): Prisma.Decimal =>
  amount.mul(percent).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
