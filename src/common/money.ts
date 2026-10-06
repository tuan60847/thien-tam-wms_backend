import { Prisma } from '@prisma/client';

export const ZERO = new Prisma.Decimal(0);

// Money leaves the API as a string with exactly two decimals.
export const moneyString = (value: Prisma.Decimal): string => value.toFixed(2);

export const sumMoney = (values: Prisma.Decimal[]): Prisma.Decimal =>
  values.reduce((total, v) => total.plus(v), ZERO);
