import { Prisma } from '@prisma/client';
import { diffDays, vnDayRangeUtc } from '../common/clock/vn-date.js';
import { AppException } from '../common/errors/app.exception.js';
import { ROLE } from '../auth/roles.constants.js';
import {
  ageBucket,
  type NhomTuoiNo,
} from '../phieu-thu-cong-no/phieu-thu-cong-no.rules.js';

export const MAX_RANGE_DAYS = 366;
export const MAX_GROUPS = 1000;
// Upper bound of stock rows read into memory for one summary report.
export const MAX_ROWS = 100_000;

const DAY_MS = 24 * 60 * 60 * 1000;

// Validates an inclusive VN date range and returns its UTC instants [start, endExclusive).
export function toUtcRange(
  tuNgay: string,
  denNgay: string,
): { start: Date; endExclusive: Date } {
  if (tuNgay > denNgay) {
    throw new AppException('BAO_CAO_RANGE_INVALID');
  }
  const range = vnDayRangeUtc(tuNgay, denNgay);
  const days = Math.round(
    (range.endExclusive.getTime() - range.start.getTime()) / DAY_MS,
  );
  if (days > MAX_RANGE_DAYS) {
    throw new AppException('BAO_CAO_RANGE_TOO_LARGE');
  }
  return range;
}

export function assertGroupCount(count: number): void {
  if (count > MAX_GROUPS) {
    throw new AppException('BAO_CAO_TOO_MANY_GROUPS');
  }
}

// Raw SQL aggregates arrive as Decimal, bigint or number depending on the column type.
export type RawNumber =
  Prisma.Decimal | bigint | number | string | null | undefined;

export const toDecimal = (value: RawNumber): Prisma.Decimal =>
  new Prisma.Decimal(
    value === null || value === undefined ? 0 : value.toString(),
  );
export const toInt = (value: RawNumber): number =>
  value === null || value === undefined ? 0 : Number(value);

// Cost fields are hidden from warehouse staff.
export const canSeeValues = (role: string | null | undefined): boolean =>
  role !== ROLE.NHAN_VIEN_KHO;

export interface AgingTotals {
  nhom0_30: Prisma.Decimal;
  nhom31_60: Prisma.Decimal;
  nhom61_90: Prisma.Decimal;
  nhomTren90: Prisma.Decimal;
}

export const emptyAging = (): AgingTotals => ({
  nhom0_30: new Prisma.Decimal(0),
  nhom31_60: new Prisma.Decimal(0),
  nhom61_90: new Prisma.Decimal(0),
  nhomTren90: new Prisma.Decimal(0),
});

const BUCKET_FIELD: Record<NhomTuoiNo, keyof AgingTotals> = {
  '0-30': 'nhom0_30',
  '31-60': 'nhom31_60',
  '61-90': 'nhom61_90',
  '>90': 'nhomTren90',
};

// Adds `amount` to the aging bucket of an item that is `days` old.
export function addToAging(
  totals: AgingTotals,
  days: number,
  amount: Prisma.Decimal,
): void {
  const field = BUCKET_FIELD[ageBucket(days)];
  totals[field] = totals[field].plus(amount);
}

export const ageInDays = (asOf: Date, since: Date): number =>
  Math.max(0, diffDays(asOf, since));

// Stock of a lot is "usable" through its expiry date; near expiry within `warningDays`.
export function classifyLot(
  hanSuDung: Date,
  today: Date,
  warnUntil: Date,
): 'het_han' | 'can_date' | 'con_han' {
  if (hanSuDung.getTime() < today.getTime()) return 'het_han';
  return hanSuDung.getTime() <= warnUntil.getTime() ? 'can_date' : 'con_han';
}

export interface NxtRow {
  tonDau: number;
  nhap: number;
  xuat: number;
  huyNhap: number;
  huyXuat: number;
  traHang: number;
  dieuChinh: number;
  chuyenRong: number;
}

// Closing stock = opening + every movement of the period (movements carry their own sign).
export const closingStock = (row: NxtRow): number =>
  row.tonDau +
  row.nhap +
  row.xuat +
  row.huyNhap +
  row.huyXuat +
  row.traHang +
  row.dieuChinh +
  row.chuyenRong;
