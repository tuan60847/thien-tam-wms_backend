import { Prisma } from '@prisma/client';
import {
  assertAmountWithinDebt,
  assertPaymentDate,
} from './phieu-thanh-toan.rules.js';

const d = (v: string) => new Prisma.Decimal(v);
const day = (s: string) => new Date(`${s}T00:00:00Z`);

describe('phieu-thanh-toan rules', () => {
  it('số tiền: bằng hoặc nhỏ hơn nợ hợp lệ; lớn hơn → EXCEEDS_DEBT kèm conNo', () => {
    expect(() => assertAmountWithinDebt(d('100'), d('100'))).not.toThrow();
    expect(() => assertAmountWithinDebt(d('99.99'), d('100'))).not.toThrow();
    expect(() => assertAmountWithinDebt(d('100.01'), d('100'))).toThrow(
      expect.objectContaining({
        code: 'PHIEU_THANH_TOAN_EXCEEDS_DEBT',
        details: { conNo: '100.00' },
      }),
    );
  });

  it('Decimal chính xác: 0.1 + 0.2 trả đủ khoản nợ 0.30', () => {
    expect(() =>
      assertAmountWithinDebt(d('0.1').plus(d('0.2')), d('0.30')),
    ).not.toThrow();
  });

  it('ngày: hôm nay và đúng ngày nhận hàng hợp lệ; tương lai hoặc trước ngày nhận không', () => {
    const today = day('2026-10-06');
    const received = day('2026-10-01');
    expect(() => assertPaymentDate(today, today, received)).not.toThrow();
    expect(() => assertPaymentDate(received, today, received)).not.toThrow();
    expect(() =>
      assertPaymentDate(day('2026-10-07'), today, received),
    ).toThrow();
    expect(() =>
      assertPaymentDate(day('2026-09-30'), today, received),
    ).toThrow();
    expect(() =>
      assertPaymentDate(day('2020-01-01'), today, null),
    ).not.toThrow();
  });
});
