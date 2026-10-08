import { Prisma } from '@prisma/client';
import { computeDebt, type DebtRow } from './phieu-xuat-hang.debt.js';

const d = (v: string) => new Prisma.Decimal(v);
const row = (over: Partial<DebtRow> = {}): DebtRow => ({
  chiTietPhieuXuatHangs: [
    {
      soLuong: 10,
      donGia: d('100000'),
      tienChietKhau: d('50000'),
      tienThueGtgt: d('76000'),
    },
  ],
  doiTrus: [],
  traLaiHangBans: [],
  ...over,
});

describe('computeDebt', () => {
  it('chưa thu: còn nợ = tổng thanh toán (hàng − chiết khấu + thuế)', () => {
    const debt = computeDebt(row());
    expect(
      [debt.tongTien, debt.daThu, debt.giaTriTraLai, debt.conNo].map((v) =>
        v.toFixed(2),
      ),
    ).toEqual(['1026000.00', '0.00', '0.00', '1026000.00']);
  });

  it('chỉ tính các khoản đối trừ chưa bị bỏ', () => {
    const debt = computeDebt(
      row({
        doiTrus: [
          { soTienDoiTru: d('400000'), daBoDoiTru: false },
          { soTienDoiTru: d('100000'), daBoDoiTru: true },
        ],
      }),
    );
    expect(debt.daThu.toFixed(2)).toBe('400000.00');
    expect(debt.conNo.toFixed(2)).toBe('626000.00');
  });

  it('hàng trả lại giảm công nợ theo số lượng × đơn giá − chiết khấu', () => {
    const debt = computeDebt(
      row({
        traLaiHangBans: [
          {
            chiTiets: [
              { soLuong: 2, donGia: d('100000'), tienChietKhau: d('10000') },
              { soLuong: 1, donGia: d('50000'), tienChietKhau: d('0') },
            ],
          },
        ],
      }),
    );
    expect(debt.giaTriTraLai.toFixed(2)).toBe('240000.00');
    expect(debt.conNo.toFixed(2)).toBe('786000.00');
  });

  it('phiếu rỗng → mọi số bằng 0', () => {
    const debt = computeDebt(row({ chiTietPhieuXuatHangs: [] }));
    expect(debt.conNo.toFixed(2)).toBe('0.00');
  });
});
