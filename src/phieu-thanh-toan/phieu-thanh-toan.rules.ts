import type { Prisma } from '@prisma/client';
import { AppException } from '../common/errors/app.exception.js';
import { moneyString } from '../common/money.js';

// A payment can never exceed what is still owed on the receipt.
export function assertAmountWithinDebt(
  soTien: Prisma.Decimal,
  conNo: Prisma.Decimal,
): void {
  if (soTien.gt(conNo)) {
    const value = moneyString(conNo);
    throw new AppException('PHIEU_THANH_TOAN_EXCEEDS_DEBT', {
      params: { conNo: value },
      details: { conNo: value },
    });
  }
}

// Not in the future and not before the goods were received (both are Vietnam dates).
export function assertPaymentDate(
  ngayThanhToan: Date,
  today: Date,
  ngayNhanHang: Date | null,
): void {
  const time = ngayThanhToan.getTime();
  if (
    time > today.getTime() ||
    (ngayNhanHang !== null && time < ngayNhanHang.getTime())
  ) {
    throw new AppException('PHIEU_THANH_TOAN_DATE_INVALID');
  }
}
