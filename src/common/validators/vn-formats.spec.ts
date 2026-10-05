import { isVehiclePlate, normalizePlate } from './is-vehicle-plate.js';
import { isVnPhone, normalizePhone } from './is-vn-phone.js';
import { isVnTaxCode } from './is-vn-tax-code.js';

describe('normalizePhone / isVnPhone', () => {
  it.each([
    ['0901 234 567', '0901234567'],
    ['090.123.4567', '0901234567'],
    ['(028) 3822-1234', '02838221234'],
    ['+84 901 234 567', '+84901234567'],
  ])('chuẩn hóa %s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    '0901234567',
    '02838221234',
    '+84901234567',
    '0901 234 567',
    '090-123-4567',
  ])('chấp nhận %s', (value) => {
    expect(isVnPhone(value)).toBe(true);
  });

  it.each([
    ['quá ngắn', '090123'],
    ['quá dài', '090123456789'],
    ['không bắt đầu bằng 0 hoặc +84', '9012345678'],
    ['+84 thiếu số', '+8490123'],
    ['có chữ', '09012345ab'],
    ['rỗng', ''],
    ['không phải chuỗi', 901234567],
  ])('từ chối: %s', (_name, value) => {
    expect(isVnPhone(value)).toBe(false);
  });
});

describe('isVnTaxCode', () => {
  it.each(['0312345678', '0312345678-001'])('chấp nhận %s', (value) => {
    expect(isVnTaxCode(value)).toBe(true);
  });

  it.each([
    '031234567',
    '03123456789',
    '0312345678-01',
    '0312345678001',
    'abcdefghij',
    '',
    null,
  ])('từ chối %j', (value) => {
    expect(isVnTaxCode(value)).toBe(false);
  });
});

describe('normalizePlate / isVehiclePlate', () => {
  it.each([
    ['51c-123.45', '51C12345'],
    ['51C 12345', '51C12345'],
    ['29LD-123.45', '29LD12345'],
    ['30a-1234', '30A1234'],
  ])('chuẩn hóa %s → %s', (input, expected) => {
    expect(normalizePlate(input)).toBe(expected);
  });

  it.each(['51C-123.45', '51c 12345', '29LD-123.45', '30A-1234', '51C123456'])(
    'chấp nhận %s',
    (value) => {
      expect(isVehiclePlate(value)).toBe(true);
    },
  );

  it.each([
    '',
    'ABC',
    '5C-12345',
    '51C-123',
    '51CDE-12345',
    '51C-1234567',
    '51C_12345',
    null,
  ])('từ chối %j', (value) => {
    expect(isVehiclePlate(value)).toBe(false);
  });

  it('hai cách viết cùng một biển cho cùng kết quả chuẩn hóa', () => {
    expect(normalizePlate('51C-123.45')).toBe(normalizePlate('51c 12345'));
  });
});
