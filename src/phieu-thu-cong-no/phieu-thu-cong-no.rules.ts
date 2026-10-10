import { Prisma } from '@prisma/client';
import { diffDays } from '../common/clock/vn-date.js';
import { AppException } from '../common/errors/app.exception.js';
import { moneyString, percentOf, ZERO } from '../common/money.js';

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

// Days past the due date; null when there is no due date or it has not passed yet.
export function overdueDays(
  hanThanhToan: Date | null,
  today: Date,
): number | null {
  if (!hanThanhToan) {
    return null;
  }
  const days = diffDays(today, hanThanhToan);
  return days > 0 ? days : null;
}

export interface PaymentDiscount {
  tyLeChietKhau: Prisma.Decimal;
  tienChietKhau: Prisma.Decimal;
}

// Early-payment discount granted on top of the money received: either a percentage of the
// amount paid or a fixed amount, never both. It is never more than the amount paid.
export function paymentDiscount(
  soTien: Prisma.Decimal,
  tyLe: string | undefined,
  tien: string | undefined,
): PaymentDiscount {
  if (tyLe !== undefined && tien !== undefined) {
    throw new AppException('VALIDATION_FAILED', {
      details: [
        {
          field: 'tienChietKhau',
          messages: [
            'Chỉ gửi tỷ lệ chiết khấu hoặc số tiền chiết khấu, không gửi cả hai',
          ],
        },
      ],
    });
  }
  if (tien !== undefined) {
    const tienChietKhau = new Prisma.Decimal(tien);
    if (tienChietKhau.gt(soTien)) {
      throw new AppException('VALIDATION_FAILED', {
        details: [
          {
            field: 'tienChietKhau',
            messages: ['Chiết khấu không được lớn hơn số tiền thu'],
          },
        ],
      });
    }
    // The percentage is only informative here; it is derived from the amount.
    return {
      tienChietKhau,
      tyLeChietKhau: soTien.gt(0)
        ? tienChietKhau
            .mul(100)
            .div(soTien)
            .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
        : ZERO,
    };
  }
  const tyLeChietKhau = new Prisma.Decimal(tyLe ?? 0);
  return { tyLeChietKhau, tienChietKhau: percentOf(soTien, tyLeChietKhau) };
}
