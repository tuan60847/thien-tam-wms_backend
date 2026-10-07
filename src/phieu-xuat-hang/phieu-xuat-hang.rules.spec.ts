import { Prisma } from '@prisma/client';
import {
  assertTransition,
  canTransition,
  isBelowMinimum,
  isOutOfFefo,
  minUnitPrice,
  receivableStatus,
} from './phieu-xuat-hang.rules.js';

const d = (v: string) => new Prisma.Decimal(v);
const day = (s: string) => new Date(`${s}T00:00:00Z`);

describe('phieu-xuat-hang rules', () => {
  it('bảng chuyển trạng thái: chờ → xuất/hủy, xuất → giao/hủy, giao và hủy là cuối', () => {
    expect(canTransition('cho_xu_ly', 'da_xuat_kho')).toBe(true);
    expect(canTransition('cho_xu_ly', 'da_giao')).toBe(false);
    expect(canTransition('da_xuat_kho', 'da_giao')).toBe(true);
    expect(canTransition('da_xuat_kho', 'da_huy')).toBe(true);
    expect(canTransition('da_giao', 'da_huy')).toBe(false);
    expect(canTransition('da_huy', 'cho_xu_ly')).toBe(false);
    expect(() => assertTransition('da_giao', 'da_huy')).toThrow(
      expect.objectContaining({ code: 'PHIEU_XUAT_INVALID_STATE' }),
    );
  });

  it('receivableStatus: chỉ khi đã xuất kho/giao; chưa thu / một phần / đủ', () => {
    expect(receivableStatus('cho_xu_ly', d('10'), d('0'))).toBeNull();
    expect(receivableStatus('da_huy', d('10'), d('0'))).toBeNull();
    expect(receivableStatus('da_xuat_kho', d('10'), d('0'))).toBe('chua_thu');
    expect(receivableStatus('da_giao', d('10'), d('3'))).toBe('thu_mot_phan');
    expect(receivableStatus('da_giao', d('10'), d('10'))).toBe('da_thu_du');
  });

  describe('minUnitPrice', () => {
    it('cùng đơn vị tính giá → giữ nguyên', () => {
      expect(minUnitPrice(d('100000'), 100, 100).toFixed(2)).toBe('100000.00');
    });
    it('đơn vị nhỏ hơn đơn vị tính giá → chia theo hệ số (hộp 100 → viên)', () => {
      expect(minUnitPrice(d('100000'), 1, 100).toFixed(2)).toBe('1000.00');
      expect(minUnitPrice(d('100000'), 10, 100).toFixed(2)).toBe('10000.00');
    });
    it('đơn vị lớn hơn → nhân; làm tròn HALF_UP 2 chữ số', () => {
      expect(minUnitPrice(d('1000'), 100, 1).toFixed(2)).toBe('100000.00');
      expect(minUnitPrice(d('100'), 1, 3).toFixed(2)).toBe('33.33');
      expect(minUnitPrice(d('100'), 2, 3).toFixed(2)).toBe('66.67');
      expect(minUnitPrice(d('0.05'), 1, 10).toFixed(2)).toBe('0.01');
    });
    it('isBelowMinimum: bằng đúng mức thì hợp lệ', () => {
      expect(isBelowMinimum(d('99.99'), d('100'))).toBe(true);
      expect(isBelowMinimum(d('100'), d('100'))).toBe(false);
    });
  });

  it('isOutOfFefo: chỉ cảnh báo khi có lô khác hết hạn sớm hơn', () => {
    expect(isOutOfFefo(day('2027-01-01'), day('2026-12-01'))).toBe(true);
    expect(isOutOfFefo(day('2026-12-01'), day('2026-12-01'))).toBe(false);
    expect(isOutOfFefo(day('2026-12-01'), day('2027-01-01'))).toBe(false);
    expect(isOutOfFefo(day('2026-12-01'), undefined)).toBe(false);
  });
});
