import { Prisma } from '@prisma/client';
import {
  addToAging,
  ageInDays,
  assertGroupCount,
  canSeeValues,
  classifyLot,
  closingStock,
  emptyAging,
  toDecimal,
  toInt,
  toUtcRange,
} from './bao-cao.rules.js';

const day = (s: string) => new Date(`${s}T00:00:00Z`);

describe('bao-cao rules', () => {
  describe('toUtcRange', () => {
    it('bao gồm cả hai đầu, theo giờ Việt Nam', () => {
      const { start, endExclusive } = toUtcRange('2026-10-01', '2026-10-01');
      expect(start.toISOString()).toBe('2026-09-30T17:00:00.000Z');
      expect(endExclusive.toISOString()).toBe('2026-10-01T17:00:00.000Z');
    });

    it('từ ngày sau đến ngày → BAO_CAO_RANGE_INVALID', () => {
      expect(() => toUtcRange('2026-10-02', '2026-10-01')).toThrow(
        expect.objectContaining({ code: 'BAO_CAO_RANGE_INVALID' }),
      );
    });

    it('đúng 366 ngày được; 367 ngày → BAO_CAO_RANGE_TOO_LARGE', () => {
      expect(() => toUtcRange('2026-01-01', '2027-01-01')).not.toThrow();
      expect(() => toUtcRange('2026-01-01', '2027-01-02')).toThrow(
        expect.objectContaining({ code: 'BAO_CAO_RANGE_TOO_LARGE' }),
      );
    });
  });

  it('assertGroupCount: tối đa 1000 nhóm', () => {
    expect(() => assertGroupCount(1000)).not.toThrow();
    expect(() => assertGroupCount(1001)).toThrow(
      expect.objectContaining({ code: 'BAO_CAO_TOO_MANY_GROUPS' }),
    );
  });

  it('toDecimal / toInt chấp nhận Decimal, bigint, number, chuỗi và null', () => {
    expect(toDecimal(new Prisma.Decimal('1.5')).toFixed(2)).toBe('1.50');
    expect(toDecimal(10n).toFixed(2)).toBe('10.00');
    expect(toDecimal('2.345').toFixed(3)).toBe('2.345');
    expect(toDecimal(null).toFixed(2)).toBe('0.00');
    expect(toInt(7n)).toBe(7);
    expect(toInt('12')).toBe(12);
    expect(toInt(undefined)).toBe(0);
  });

  it('canSeeValues: nhân viên kho không thấy giá trị; các role khác thấy', () => {
    expect(canSeeValues('NHAN_VIEN_KHO')).toBe(false);
    expect(canSeeValues('KE_TOAN')).toBe(true);
    expect(canSeeValues('ADMIN')).toBe(true);
    expect(canSeeValues(undefined)).toBe(true);
  });

  it.each([
    [0, 'nhom0_30'],
    [30, 'nhom0_30'],
    [31, 'nhom31_60'],
    [60, 'nhom31_60'],
    [61, 'nhom61_90'],
    [90, 'nhom61_90'],
    [91, 'nhomTren90'],
  ] as const)('addToAging(%i ngày) vào %s', (days, field) => {
    const totals = emptyAging();
    addToAging(totals, days, new Prisma.Decimal(100));
    expect(totals[field].toFixed(2)).toBe('100.00');
    const others = Object.entries(totals).filter(([k]) => k !== field);
    expect(others.every(([, v]) => v.isZero())).toBe(true);
  });

  it('ageInDays không âm (phiếu ngày tương lai tính 0)', () => {
    expect(ageInDays(day('2026-10-10'), day('2026-10-01'))).toBe(9);
    expect(ageInDays(day('2026-10-01'), day('2026-10-10'))).toBe(0);
  });

  it('classifyLot: hạn đúng hôm nay vẫn dùng được; cận date đến hết ngưỡng', () => {
    const today = day('2026-10-08');
    const warn = day('2027-01-06');
    expect(classifyLot(day('2026-10-07'), today, warn)).toBe('het_han');
    expect(classifyLot(day('2026-10-08'), today, warn)).toBe('can_date');
    expect(classifyLot(day('2027-01-06'), today, warn)).toBe('can_date');
    expect(classifyLot(day('2027-01-07'), today, warn)).toBe('con_han');
  });

  it('closingStock = đầu kỳ + mọi biến động theo dấu', () => {
    expect(
      closingStock({
        tonDau: 100,
        nhap: 500,
        xuat: -200,
        huyNhap: -50,
        huyXuat: 20,
        traHang: 10,
        dieuChinh: -5,
        chuyenRong: 0,
      }),
    ).toBe(375);
  });
});
