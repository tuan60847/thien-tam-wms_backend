import { isMoney, isPositiveMoney } from './is-money.js';

describe('isMoney', () => {
  it.each(['0', '0.00', '125000', '125000.5', '125000.50', '9999999999999.99'])(
    'chấp nhận %s',
    (value) => {
      expect(isMoney(value)).toBe(true);
    },
  );

  it.each([
    ['âm', '-1'],
    ['3 chữ số thập phân', '1.234'],
    ['dấu phẩy', '1,5'],
    ['quá 13 chữ số nguyên', '12345678901234'],
    ['rỗng', ''],
    ['chữ', 'abc'],
    ['số (không phải chuỗi)', 125000],
    ['null', null],
  ])('từ chối: %s', (_name, value) => {
    expect(isMoney(value)).toBe(false);
  });
});

describe('isPositiveMoney', () => {
  it('chỉ chấp nhận số lớn hơn 0', () => {
    expect(isPositiveMoney('0.01')).toBe(true);
    expect(isPositiveMoney('1')).toBe(true);
    expect(isPositiveMoney('0')).toBe(false);
    expect(isPositiveMoney('0.00')).toBe(false);
    expect(isPositiveMoney('-1')).toBe(false);
  });
});
