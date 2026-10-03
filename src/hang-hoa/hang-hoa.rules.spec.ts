import {
  assertControlType,
  assertPriceOrder,
  buildUnits,
  canSeeCost,
  findUnitName,
  resolvePriceUnit,
} from './hang-hoa.rules.js';

describe('buildUnits', () => {
  it('đơn vị cơ bản đứng đầu với hệ số 1, rồi các đơn vị khác', () => {
    expect(
      buildUnits('  viên ', [
        { donViTinh: 'vỉ', soLuongQuyDoi: 10 },
        { donViTinh: 'hộp', soLuongQuyDoi: 100 },
      ]),
    ).toEqual([
      { donViTinh: 'viên', soLuongQuyDoi: 1 },
      { donViTinh: 'vỉ', soLuongQuyDoi: 10 },
      { donViTinh: 'hộp', soLuongQuyDoi: 100 },
    ]);
  });

  it('chỉ có đơn vị cơ bản vẫn hợp lệ', () => {
    expect(buildUnits('chai')).toEqual([
      { donViTinh: 'chai', soLuongQuyDoi: 1 },
    ]);
  });

  it('trùng tên (không phân biệt hoa/thường, bỏ khoảng trắng) → TY_LE_QUY_DOI_UNIT_TAKEN', () => {
    expect(() =>
      buildUnits('Viên', [{ donViTinh: ' viên ', soLuongQuyDoi: 10 }]),
    ).toThrow(expect.objectContaining({ code: 'TY_LE_QUY_DOI_UNIT_TAKEN' }));
    expect(() =>
      buildUnits('viên', [
        { donViTinh: 'hộp', soLuongQuyDoi: 100 },
        { donViTinh: 'HỘP', soLuongQuyDoi: 50 },
      ]),
    ).toThrow(expect.objectContaining({ code: 'TY_LE_QUY_DOI_UNIT_TAKEN' }));
  });

  it('đơn vị khác có hệ số < 2 → TY_LE_QUY_DOI_BASE_REQUIRED', () => {
    expect(() =>
      buildUnits('viên', [{ donViTinh: 'vỉ', soLuongQuyDoi: 1 }]),
    ).toThrow(expect.objectContaining({ code: 'TY_LE_QUY_DOI_BASE_REQUIRED' }));
  });
});

describe('findUnitName / resolvePriceUnit', () => {
  const units = [{ donViTinh: 'viên' }, { donViTinh: 'Hộp' }];

  it('trả đúng cách viết gốc của đơn vị', () => {
    expect(findUnitName(units, ' hộp ')).toBe('Hộp');
    expect(findUnitName(units, 'thùng')).toBeNull();
  });

  it('resolvePriceUnit ném HANG_HOA_PRICE_UNIT_INVALID khi đơn vị lạ', () => {
    expect(resolvePriceUnit(units, 'HỘP')).toBe('Hộp');
    expect(() => resolvePriceUnit(units, 'thùng')).toThrow(
      expect.objectContaining({ code: 'HANG_HOA_PRICE_UNIT_INVALID' }),
    );
  });
});

describe('assertPriceOrder', () => {
  it.each([
    ['1400.00', '1500.00'],
    ['1500.00', '1500.00'],
    ['0', '0'],
  ])('giá tối thiểu %s ≤ giá hiển thị %s là hợp lệ', (min, display) => {
    expect(() => assertPriceOrder(min, display)).not.toThrow();
  });

  it('giá tối thiểu lớn hơn giá hiển thị → HANG_HOA_PRICE_INVALID', () => {
    expect(() => assertPriceOrder('1500.01', '1500.00')).toThrow(
      expect.objectContaining({ code: 'HANG_HOA_PRICE_INVALID' }),
    );
  });

  it('so sánh Decimal chính xác, không sai số float', () => {
    expect(() => assertPriceOrder('0.3', '0.30')).not.toThrow();
    expect(() => assertPriceOrder('0.1', '0.09')).toThrow();
  });
});

describe('assertControlType (bảng chân trị)', () => {
  const ok = [
    { isKeDon: false, loaiKiemSoat: 'thuong', soDangKy: null },
    { isKeDon: false, loaiKiemSoat: null, soDangKy: null },
    { isKeDon: false, loaiKiemSoat: undefined, soDangKy: undefined },
    { isKeDon: false, loaiKiemSoat: 'thuong', soDangKy: 'VD-1' },
    { isKeDon: true, loaiKiemSoat: 'ke_don', soDangKy: 'VD-1' },
    { isKeDon: true, loaiKiemSoat: 'kiem_soat_dac_biet', soDangKy: 'VD-1' },
    { isKeDon: false, loaiKiemSoat: 'ke_don', soDangKy: 'VD-1' },
  ] as const;
  const bad = [
    [
      'kê đơn nhưng loại kiểm soát "thường"',
      { isKeDon: true, loaiKiemSoat: 'thuong', soDangKy: 'VD-1' },
    ],
    [
      'kê đơn nhưng chưa có loại kiểm soát',
      { isKeDon: true, loaiKiemSoat: null, soDangKy: 'VD-1' },
    ],
    [
      'kê đơn thiếu số đăng ký',
      { isKeDon: true, loaiKiemSoat: 'ke_don', soDangKy: null },
    ],
    [
      'số đăng ký chỉ có khoảng trắng',
      { isKeDon: true, loaiKiemSoat: 'ke_don', soDangKy: '   ' },
    ],
    [
      'kiểm soát đặc biệt thiếu số đăng ký',
      { isKeDon: false, loaiKiemSoat: 'kiem_soat_dac_biet', soDangKy: '' },
    ],
  ] as const;

  it.each(ok.map((c) => [JSON.stringify(c), c] as const))(
    'hợp lệ: %s',
    (_n, input) => {
      expect(() => assertControlType(input)).not.toThrow();
    },
  );

  it.each(bad)('không hợp lệ: %s', (_n, input) => {
    expect(() => assertControlType(input)).toThrow(
      expect.objectContaining({ code: 'HANG_HOA_CONTROL_TYPE_INVALID' }),
    );
  });
});

describe('canSeeCost', () => {
  it('chỉ ADMIN, QUAN_LY_KHO, KE_TOAN thấy giá nhập / giá tối thiểu', () => {
    expect(canSeeCost('ADMIN')).toBe(true);
    expect(canSeeCost('QUAN_LY_KHO')).toBe(true);
    expect(canSeeCost('KE_TOAN')).toBe(true);
    expect(canSeeCost('NHAN_VIEN_KHO')).toBe(false);
    expect(canSeeCost(null)).toBe(false);
    expect(canSeeCost(undefined)).toBe(false);
  });
});
