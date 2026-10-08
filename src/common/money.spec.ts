import { Prisma } from '@prisma/client';
import {
  computeNetTotals,
  lineNetAmount,
  percentOf,
  type NetLine,
} from './money.js';

const d = (v: string) => new Prisma.Decimal(v);
const line = (
  soLuong: number,
  donGia: string,
  ck = '0',
  thue = '0',
): NetLine => ({
  soLuong,
  donGia: d(donGia),
  tienChietKhau: d(ck),
  tienThueGtgt: d(thue),
});

describe('money helpers', () => {
  it('lineNetAmount = số lượng × đơn giá − chiết khấu + thuế', () => {
    expect(lineNetAmount(line(10, '100000', '50000', '76000')).toFixed(2)).toBe(
      '1026000.00',
    );
    expect(lineNetAmount(line(2, '10')).toFixed(2)).toBe('20.00');
  });

  it('computeNetTotals tách tiền hàng, chiết khấu, thuế và tổng thanh toán', () => {
    const totals = computeNetTotals([
      line(1, '1000', '100', '72'),
      line(2, '500', '0', '80'),
    ]);
    expect(
      [
        totals.tongTienHang,
        totals.tienChietKhau,
        totals.tienThueGtgt,
        totals.tongThanhToan,
      ].map((v) => v.toFixed(2)),
    ).toEqual(['2000.00', '100.00', '152.00', '2052.00']);
  });

  it('danh sách rỗng → toàn 0', () => {
    expect(computeNetTotals([]).tongThanhToan.toFixed(2)).toBe('0.00');
  });

  it('percentOf làm tròn HALF_UP 2 chữ số', () => {
    expect(percentOf(d('100000'), d('8')).toFixed(2)).toBe('8000.00');
    expect(percentOf(d('33.33'), d('10')).toFixed(2)).toBe('3.33');
    expect(percentOf(d('0.05'), d('10')).toFixed(2)).toBe('0.01');
    expect(percentOf(d('100'), d('0')).toFixed(2)).toBe('0.00');
  });
});
