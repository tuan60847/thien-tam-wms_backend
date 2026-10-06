import {
  allocateFefo,
  assertColdChain,
  summarizeByProduct,
} from './ton-kho.rules.js';

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe('assertColdChain', () => {
  it('hàng lạnh vào vị trí thường → lỗi; còn lại hợp lệ', () => {
    expect(() =>
      assertColdChain({ isCanGiuLanh: true }, { isCapDong: false }),
    ).toThrow();
    expect(() =>
      assertColdChain({ isCanGiuLanh: true }, { isCapDong: true }),
    ).not.toThrow();
    expect(() =>
      assertColdChain({ isCanGiuLanh: false }, { isCapDong: true }),
    ).not.toThrow();
    expect(() =>
      assertColdChain({ isCanGiuLanh: false }, { isCapDong: false }),
    ).not.toThrow();
  });
});

describe('allocateFefo', () => {
  const c = (
    soLoId: string,
    hanSuDung: string,
    soLuong: number,
    viTriId = 'v',
  ) => ({
    soLoId,
    viTriId,
    hanSuDung: d(hanSuDung),
    soLuong,
  });

  it('lấy lô hết hạn sớm trước và cắt đúng số cần', () => {
    const { phanBo, thieu } = allocateFefo(
      [c('b', '2027-01-01', 10), c('a', '2026-12-01', 5)],
      8,
    );
    expect(phanBo.map((p) => [p.soLoId, p.phanBo])).toEqual([
      ['a', 5],
      ['b', 3],
    ]);
    expect(thieu).toBe(0);
  });

  it('cùng hạn: dòng nhiều tồn hơn trước; bỏ dòng 0; thiếu thì báo thiếu', () => {
    const { phanBo, thieu } = allocateFefo(
      [
        c('a', '2027-01-01', 2),
        c('b', '2027-01-01', 9),
        c('z', '2026-01-01', 0),
      ],
      20,
    );
    expect(phanBo.map((p) => p.soLoId)).toEqual(['b', 'a']);
    expect(thieu).toBe(9);
  });

  it('cần 0 → không phân bổ', () => {
    expect(allocateFefo([c('a', '2027-01-01', 5)], 0)).toEqual({
      phanBo: [],
      thieu: 0,
    });
  });
});

describe('summarizeByProduct', () => {
  it('tách tồn khả dụng / cận date / hết hạn; hạn đúng hôm nay vẫn dùng được', () => {
    const today = d('2026-10-06');
    const warnUntil = d('2027-01-04');
    const rows = [
      { hangHoaId: 'h', soLoId: 'l1', soLuong: 10, hanSuDung: d('2026-10-05') },
      { hangHoaId: 'h', soLoId: 'l2', soLuong: 20, hanSuDung: d('2026-10-06') },
      { hangHoaId: 'h', soLoId: 'l3', soLuong: 30, hanSuDung: d('2028-01-01') },
    ];
    expect(summarizeByProduct(rows, today, warnUntil)).toEqual([
      expect.objectContaining({
        hangHoaId: 'h',
        tongTon: 60,
        tonHetHan: 10,
        tonCanDate: 20,
        soLo: 3,
      }),
    ]);
  });
});
