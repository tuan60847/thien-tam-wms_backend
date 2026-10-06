import type { TrangThaiSoLo } from '@prisma/client';
import { addDays, diffDays } from '../common/clock/vn-date.js';
import { AppException } from '../common/errors/app.exception.js';

// All dates are Vietnam calendar dates stored as midnight UTC (see ClockService.today()).
// A lot whose hanSuDung is today is still usable throughout today.
export function computeStatus(
  hanSuDung: Date,
  today: Date,
  warningDays: number,
): TrangThaiSoLo {
  if (hanSuDung.getTime() < today.getTime()) {
    return 'het_han';
  }
  return hanSuDung.getTime() <= addDays(today, warningDays).getTime()
    ? 'can_date'
    : 'con_han';
}

// Negative once the lot is past its expiry date.
export function daysLeft(hanSuDung: Date, today: Date): number {
  return diffDays(hanSuDung, today);
}

// Used for both receiving and issuing; minDays = 0 switches the shelf-life rule off.
export function assertShelfLife(
  hanSuDung: Date,
  today: Date,
  minDays: number,
): void {
  if (hanSuDung.getTime() < today.getTime()) {
    throw new AppException('SO_LO_EXPIRED');
  }
  if (minDays > 0 && daysLeft(hanSuDung, today) < minDays) {
    throw new AppException('SO_LO_NEAR_EXPIRY', {
      details: {
        conLaiNgay: daysLeft(hanSuDung, today),
        toiThieuNgay: minDays,
      },
    });
  }
}

// Manufacturing date cannot be in the future and must precede the expiry date.
export function assertLotDates(
  ngaySX: Date | null | undefined,
  hanSuDung: Date,
  today: Date,
): void {
  if (ngaySX && ngaySX.getTime() > today.getTime()) {
    throw new AppException('VALIDATION_FAILED', {
      details: [
        { field: 'ngaySX', messages: ['Ngày sản xuất không được ở tương lai'] },
      ],
    });
  }
  if (ngaySX && hanSuDung.getTime() <= ngaySX.getTime()) {
    throw new AppException('SO_LO_DATE_INVALID');
  }
}

// Inclusive [lower, upper] bounds on hanSuDung for a status filter. Filtering on dates
// instead of the cached SoLo.trangThai column keeps results correct even if the daily job lags.
export interface DateBounds {
  lower?: Date;
  upper?: Date;
}

export function statusBounds(
  status: TrangThaiSoLo,
  today: Date,
  warningDays: number,
): DateBounds {
  const warnUntil = addDays(today, warningDays);
  switch (status) {
    case 'het_han':
      return { upper: addDays(today, -1) };
    case 'can_date':
      return { lower: today, upper: warnUntil };
    case 'con_han':
      return { lower: addDays(warnUntil, 1) };
  }
}

export function intersectBounds(a: DateBounds, b: DateBounds): DateBounds {
  const lower =
    a.lower && b.lower
      ? a.lower > b.lower
        ? a.lower
        : b.lower
      : (a.lower ?? b.lower);
  const upper =
    a.upper && b.upper
      ? a.upper < b.upper
        ? a.upper
        : b.upper
      : (a.upper ?? b.upper);
  return { lower, upper };
}

export function boundsToFilter(
  bounds: DateBounds,
): { gte?: Date; lte?: Date } | undefined {
  return bounds.lower || bounds.upper
    ? { gte: bounds.lower, lte: bounds.upper }
    : undefined;
}
