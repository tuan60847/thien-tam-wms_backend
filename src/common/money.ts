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
