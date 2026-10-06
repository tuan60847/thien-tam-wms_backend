import { Prisma } from '@prisma/client';
import {
  assertEditable,
  assertTransition,
  canTransition,
  computeTotals,
  lineAmount,
  paymentStatus,
} from './phieu-nhap-hang.rules.js';

const d = (v: string) => new Prisma.Decimal(v);

describe('phieu-nhap-hang rules', () => {
  it('bảng chuyển trạng thái: nháp → nhập kho/hủy, nhập kho → hủy, hủy là cuối', () => {
    expect(canTransition('cho_xac_nhan', 'da_nhap_kho')).toBe(true);
    expect(canTransition('cho_xac_nhan', 'da_huy')).toBe(true);
    expect(canTransition('da_nhap_kho', 'da_huy')).toBe(true);
    expect(canTransition('da_nhap_kho', 'cho_xac_nhan')).toBe(false);
    expect(canTransition('da_huy', 'da_nhap_kho')).toBe(false);
    expect(() => assertTransition('da_huy', 'da_huy')).toThrow();
    expect(() => assertTransition('da_nhap_kho', 'da_huy')).not.toThrow();
  });

  it('chỉ phiếu nháp sửa được', () => {
    expect(() => assertEditable('cho_xac_nhan')).not.toThrow();
    expect(() => assertEditable('da_nhap_kho')).toThrow();
    expect(() => assertEditable('da_huy')).toThrow();
  });

  it('computeTotals cộng Decimal chính xác; rỗng → 0', () => {
    expect(
      computeTotals([
        { soLuong: 1, donGia: d('0.1') },
        { soLuong: 1, donGia: d('0.2') },
      ]).toFixed(2),
    ).toBe('0.30');
    expect(computeTotals([]).toFixed(2)).toBe('0.00');
    expect(lineAmount({ soLuong: 3, donGia: d('90000') }).toFixed(2)).toBe(
      '270000.00',
    );
  });

  it('paymentStatus: chỉ khi đã nhập kho; trả đủ / một phần / chưa', () => {
    expect(paymentStatus('cho_xac_nhan', d('10'), d('0'))).toBeNull();
    expect(paymentStatus('da_huy', d('10'), d('0'))).toBeNull();
    expect(paymentStatus('da_nhap_kho', d('10'), d('0'))).toBe(
      'chua_thanh_toan',
    );
    expect(paymentStatus('da_nhap_kho', d('10'), d('4'))).toBe(
      'thanh_toan_mot_phan',
    );
    expect(paymentStatus('da_nhap_kho', d('10'), d('10'))).toBe(
      'da_thanh_toan',
    );
  });
});
