import type { Prisma } from '@prisma/client';
import { AppException } from '../common/errors/app.exception.js';
import { moneyString } from '../common/money.js';

export type NhomTuoiNo = '0-30' | '31-60' | '61-90' | '>90';

// A receipt can never exceed what the customer still owes on the order.
export function assertAmountWithinDebt(
  soTien: Prisma.Decimal,
  conNo: Prisma.Decimal,
): void {
  if (soTien.gt(conNo)) {
    const value = moneyString(conNo);
    throw new AppException('PHIEU_THU_EXCEEDS_DEBT', {
      params: { conNo: value },
      details: { conNo: value },
    });
  }
}

// Not in the future and not before the goods left the warehouse (Vietnam dates).
export function assertReceiptDate(
  ngayThanhToan: Date,
  today: Date,
  ngayXuatKho: Date | null,
): void {
  const time = ngayThanhToan.getTime();
  if (
    time > today.getTime() ||
    (ngayXuatKho !== null && time < ngayXuatKho.getTime())
  ) {
    throw new AppException('PHIEU_THU_DATE_INVALID');
  }
}

// Days outstanding -> aging bucket (inclusive upper bounds 30 / 60 / 90).
export function ageBucket(days: number): NhomTuoiNo {
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '>90';
}
