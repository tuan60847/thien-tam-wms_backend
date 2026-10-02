import { isStrongPassword } from './is-strong-password.js';
import { isUsername } from './is-username.js';

describe('isStrongPassword', () => {
  it.each(['Admin@123', 'Abcdefg1', 'Mật khẩu Dài 1 ok'])(
    'chấp nhận %s',
    (value) => {
      expect(isStrongPassword(value)).toBe(true);
    },
  );

  it.each([
    ['ngắn hơn 8 ký tự', 'Ab1cdef'],
    ['thiếu chữ hoa', 'abcdefg1'],
    ['thiếu chữ thường', 'ABCDEFG1'],
    ['thiếu chữ số', 'Abcdefgh'],
    ['quá 72 byte', 'Aa1' + 'x'.repeat(70)],
    ['không phải chuỗi', 12345678],
  ])('từ chối: %s', (_name, value) => {
    expect(isStrongPassword(value)).toBe(false);
  });

  it('giới hạn tính theo byte chứ không theo ký tự (tiếng Việt nhiều byte)', () => {
    // 'ệ' = 3 bytes in UTF-8; 25 of them already exceed 72 bytes.
    expect(isStrongPassword('Aa1' + 'ệ'.repeat(25))).toBe(false);
    expect(isStrongPassword('Aa1' + 'ệ'.repeat(20))).toBe(true);
  });
});

describe('isUsername', () => {
  it.each(['admin', 'nv.test', 'a_b-c', 'abc', 'x'.repeat(32), 'user01'])(
    'chấp nhận %s',
    (value) => {
      expect(isUsername(value)).toBe(true);
    },
  );

  it.each(['ab', 'x'.repeat(33), 'Admin', 'a b', 'tên', 'a@b', '', null])(
    'từ chối %j',
    (value) => {
      expect(isUsername(value)).toBe(false);
    },
  );
});
