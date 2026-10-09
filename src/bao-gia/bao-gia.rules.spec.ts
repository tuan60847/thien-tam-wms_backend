import { Prisma } from '@prisma/client';
import {
  allocationCoversQuote,
  isExpired,
  quoteLineAmounts,
  quoteTotals,
} from './bao-gia.rules.js';

const d = (v: string) => new Prisma.Decimal(v);
const line = (soLuong: number, donGia: string, ck = '0', vat = '0') => ({
  soLuong,
  donGia: d(donGia),
  tyLeChietKhau: d(ck),
  thueSuatGtgt: d(vat),
});

describe('bao-gia rules', () => {
  it('chiết khấu trên tiền hàng, thuế trên số tiền sau chiết khấu (như phiếu xuất)', () => {
    const amounts = quoteLineAmounts(line(2, '125000', '10', '8'));
    expect(amounts.tienChietKhau.toFixed(2)).toBe('25000.00');
    expect(amounts.tienThueGtgt.toFixed(2)).toBe('18000.00');
  });

  it('tổng báo giá = hàng − chiết khấu + thuế, làm tròn HALF_UP từng dòng', () => {
    const totals = quoteTotals([
      line(2, '125000', '10', '8'),
      line(1, '100000.05', '3.33', '5'),
    ]);
    expect(totals.tongTienHang.toFixed(2)).toBe('350000.05');
    expect(totals.tienChietKhau.toFixed(2)).toBe('28330.00');
    expect(totals.tienThueGtgt.toFixed(2)).toBe('22833.50');
    expect(totals.tongThanhToan.toFixed(2)).toBe('344503.55');
    expect(quoteTotals([]).tongThanhToan.toFixed(2)).toBe('0.00');
  });

  it('hạn hiệu lực: còn hiệu lực đến hết ngày cuối; không có hạn thì không bao giờ hết', () => {
    const today = new Date('2026-10-08T00:00:00Z');
    expect(isExpired(null, today)).toBe(false);
    expect(isExpired(new Date('2026-10-08T00:00:00Z'), today)).toBe(false);
    expect(isExpired(new Date('2026-10-07T00:00:00Z'), today)).toBe(true);
  });

  describe('allocationCoversQuote', () => {
    const quote = [
      { id: 'a', soLuong: 10 },
      { id: 'b', soLuong: 5 },
    ];
    const alloc = (id: string, soLuong: number) => ({
      chiTietBaoGiaId: id,
      soLoId: 'l',
      viTriId: 'v',
      soLuong,
    });
    it('phủ đủ, có thể chia nhiều lô cho một dòng', () => {
      expect(
        allocationCoversQuote(quote, [
          alloc('a', 6),
          alloc('a', 4),
          alloc('b', 5),
        ]),
      ).toBe(true);
    });
    it('thiếu, thừa, thiếu dòng hoặc dòng lạ đều không hợp lệ', () => {
      expect(
        allocationCoversQuote(quote, [alloc('a', 10), alloc('b', 4)]),
      ).toBe(false);
      expect(
        allocationCoversQuote(quote, [alloc('a', 11), alloc('b', 5)]),
      ).toBe(false);
      expect(allocationCoversQuote(quote, [alloc('a', 10)])).toBe(false);
      expect(
        allocationCoversQuote(quote, [
          alloc('a', 10),
          alloc('b', 5),
          alloc('x', 1),
        ]),
      ).toBe(false);
      expect(allocationCoversQuote(quote, [])).toBe(false);
    });
  });
});
