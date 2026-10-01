import { AppException } from './app.exception.js';
import { ERROR, type ErrorCode } from './error-codes.js';

describe('ERROR registry', () => {
  const codes = Object.keys(ERROR) as ErrorCode[];

  it.each(codes)(
    '%s có status HTTP hợp lệ và message tiếng Việt không rỗng',
    (code) => {
      const { status, message } = ERROR[code];
      const text = typeof message === 'function' ? message({}) : message;
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(600);
      expect(text.trim().length).toBeGreaterThan(0);
    },
  );

  it('mã lỗi đặt theo dạng UPPER_SNAKE', () => {
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/);
    }
  });

  it('khớp message của Auth đã có', () => {
    expect(ERROR.AUTH_INVALID_CREDENTIALS.message).toBe(
      'Sai tài khoản hoặc mật khẩu',
    );
    expect(ERROR.AUTH_ACCOUNT_LOCKED.message).toBe('Tài khoản đã bị khóa');
    expect(ERROR.AUTH_SESSION_INVALID.message).toBe(
      'Phiên đăng nhập không hợp lệ',
    );
    expect(ERROR.AUTH_FORBIDDEN.message).toBe('Bạn không có quyền truy cập');
  });
});

describe('AppException', () => {
  it('lấy status và message từ registry', () => {
    const exception = new AppException('AUTH_FORBIDDEN');
    expect(exception.getStatus()).toBe(403);
    expect(exception.message).toBe('Bạn không có quyền truy cập');
    expect(exception.code).toBe('AUTH_FORBIDDEN');
    expect(exception.details).toBeNull();
  });

  it('mang theo details', () => {
    const exception = new AppException('COMMON_CONFLICT', {
      details: { conLai: 3 },
    });
    expect(exception.details).toEqual({ conLai: 3 });
  });

  it('cho phép ghi đè message', () => {
    expect(
      new AppException('VALIDATION_FAILED', { message: 'x' }).message,
    ).toBe('x');
  });
});
