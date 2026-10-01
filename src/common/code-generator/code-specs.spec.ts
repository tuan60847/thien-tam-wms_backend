import { CODE, formatCode, formatLineCode, toDateKey } from './code-specs.js';

describe('code-specs', () => {
  it('toDateKey đổi YYYY-MM-DD thành yyMMdd', () => {
    expect(toDateKey('2026-10-01')).toBe('261001');
    expect(toDateKey('2027-01-09')).toBe('270109');
  });

  it('mã chứng từ theo ngày', () => {
    expect(formatCode(CODE.PHIEU_NHAP, 1, '261001')).toBe('PN2610010001');
    expect(formatCode(CODE.PHIEU_XUAT, 37, '261001')).toBe('PX2610010037');
    expect(formatCode(CODE.PHIEU_THU, 1, '261001')).toBe('PT2610010001');
    expect(formatCode(CODE.PHIEU_THANH_TOAN, 12, '261001')).toBe(
      'TT2610010012',
    );
  });

  it('mã đối tượng liên tục, không chứa ngày', () => {
    expect(formatCode(CODE.KHACH_HANG, 1, '261001')).toBe('KH00001');
    expect(formatCode(CODE.NHAN_VIEN, 2, '261001')).toBe('NV0002');
    expect(formatCode(CODE.SAN_PHAM, 123, '261001')).toBe('SP00123');
    expect(formatCode(CODE.NHA_CUNG_CAP, 7, '261001')).toBe('NCC0007');
  });

  it('số thứ tự vượt độ rộng vẫn không bị cắt', () => {
    expect(formatCode(CODE.PHIEU_NHAP, 12345, '261001')).toBe('PN26100112345');
  });

  it('mã dòng chi tiết', () => {
    expect(formatLineCode('PN2610010001', 1)).toBe('PN2610010001-01');
    expect(formatLineCode('PN2610010001', 12)).toBe('PN2610010001-12');
  });
});
