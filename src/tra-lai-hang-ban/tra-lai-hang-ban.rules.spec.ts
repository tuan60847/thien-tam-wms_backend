import { Prisma } from '@prisma/client';
import {
  assertTransition,
  lineValue,
  returnableQuantity,
  totalValue,
} from './tra-lai-hang-ban.rules.js';

const d = (v: string) => new Prisma.Decimal(v);

describe('tra-lai-hang-ban rules', () => {
  it('vòng đời: nháp → nhập kho/hủy, nhập kho → hủy, hủy là cuối', () => {
    expect(() => assertTransition('cho_xac_nhan', 'da_nhap_kho')).not.toThrow();
    expect(() => assertTransition('da_nhap_kho', 'da_huy')).not.toThrow();
    expect(() => assertTransition('da_nhap_kho', 'cho_xac_nhan')).toThrow(
      expect.objectContaining({ code: 'TRA_LAI_INVALID_STATE' }),
    );
    expect(() => assertTransition('da_huy', 'da_nhap_kho')).toThrow();
  });

  it('giá trị dòng = số lượng × đơn giá − chiết khấu; tổng cộng Decimal chính xác', () => {
    const a = { soLuong: 2, donGia: d('100000'), tienChietKhau: d('10000') };
    const b = { soLuong: 1, donGia: d('0.1'), tienChietKhau: d('0') };
    expect(lineValue(a).toFixed(2)).toBe('190000.00');
    expect(
      totalValue([
        a,
        b,
        { soLuong: 1, donGia: d('0.2'), tienChietKhau: d('0') },
      ]).toFixed(2),
    ).toBe('190000.30');
    expect(totalValue([]).toFixed(2)).toBe('0.00');
  });

  it('số lượng còn được trả không âm', () => {
    expect(returnableQuantity(200, 0)).toBe(200);
    expect(returnableQuantity(200, 150)).toBe(50);
    expect(returnableQuantity(200, 250)).toBe(0);
  });
});
