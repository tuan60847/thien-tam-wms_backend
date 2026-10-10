import { Prisma } from '@prisma/client';
import {
  ageBucket,
  assertAmountWithinDebt,
  assertReceiptDate,
  paymentDiscount,
} from './phieu-thu-cong-no.rules.js';

const d = (v: string) => new Prisma.Decimal(v);
const day = (s: string) => new Date(`${s}T00:00:00Z`);

describe('phieu-thu-cong-no rules', () => {
  it('số tiền: ≤ nợ hợp lệ; > nợ → EXCEEDS_DEBT kèm conNo', () => {
    expect(() => assertAmountWithinDebt(d('100'), d('100'))).not.toThrow();
    expect(() =>
      assertAmountWithinDebt(d('0.1').plus(d('0.2')), d('0.30')),
    ).not.toThrow();
    expect(() => assertAmountWithinDebt(d('100.01'), d('100'))).toThrow(
      expect.objectContaining({
        code: 'PHIEU_THU_EXCEEDS_DEBT',
        details: { conNo: '100.00' },
      }),
    );
  });

  it('ngày: hôm nay và đúng ngày xuất kho hợp lệ; tương lai hoặc trước ngày xuất không', () => {
    const today = day('2026-10-06');
    const issued = day('2026-10-01');
    expect(() => assertReceiptDate(today, today, issued)).not.toThrow();
    expect(() => assertReceiptDate(issued, today, issued)).not.toThrow();
    expect(() => assertReceiptDate(day('2026-10-07'), today, issued)).toThrow();
    expect(() => assertReceiptDate(day('2026-09-30'), today, issued)).toThrow();
    expect(() =>
      assertReceiptDate(day('2020-01-01'), today, null),
    ).not.toThrow();
  });

  it.each([
    [0, '0-30'],
    [30, '0-30'],
    [31, '31-60'],
    [60, '31-60'],
    [61, '61-90'],
    [90, '61-90'],
    [91, '>90'],
    [400, '>90'],
  ])('ageBucket(%i) = %s (biên 30/31, 60/61, 90/91)', (days, bucket) => {
    expect(ageBucket(days)).toBe(bucket);
  });
});

describe('paymentDiscount', () => {
  it('không gửi gì = không chiết khấu', () => {
    const r = paymentDiscount(d('100000'), undefined, undefined);
    expect(r.tienChietKhau.toFixed(2)).toBe('0.00');
    expect(r.tyLeChietKhau.toFixed(2)).toBe('0.00');
  });

  it('theo %: tính trên số tiền thu, làm tròn HALF_UP 2 chữ số', () => {
    expect(
      paymentDiscount(d('100000'), '2', undefined).tienChietKhau.toFixed(2),
    ).toBe('2000.00');
    expect(
      paymentDiscount(d('333.33'), '1.5', undefined).tienChietKhau.toFixed(2),
    ).toBe('5.00');
  });

  it('theo số tiền: suy ra tỷ lệ, tối đa bằng số tiền thu', () => {
    const r = paymentDiscount(d('200000'), undefined, '5000');
    expect(r.tienChietKhau.toFixed(2)).toBe('5000.00');
    expect(r.tyLeChietKhau.toFixed(2)).toBe('2.50');
    expect(
      paymentDiscount(d('100'), undefined, '100').tyLeChietKhau.toFixed(2),
    ).toBe('100.00');
    expect(() => paymentDiscount(d('100'), undefined, '100.01')).toThrow();
  });

  it('gửi cả tỷ lệ và số tiền bị từ chối', () => {
    expect(() => paymentDiscount(d('100'), '1', '1')).toThrow();
  });
});
