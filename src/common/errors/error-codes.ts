export interface ErrorDefinition {
  status: number;
  message: string | ((params: Record<string, unknown>) => string);
}

// Registry of error codes: code -> HTTP status + Vietnamese user-facing message.
// Modules add their own codes here as they are implemented
// (see docs/03-cross-cutting/error-handling.md for the full list).
const DEFINITIONS = {
  VALIDATION_FAILED: { status: 400, message: 'Dữ liệu gửi lên không hợp lệ' },
  COMMON_INVALID_ID: { status: 400, message: 'Mã định danh không hợp lệ' },

  AUTH_UNAUTHORIZED: {
    status: 401,
    message: 'Vui lòng đăng nhập để tiếp tục',
  },
  AUTH_INVALID_CREDENTIALS: {
    status: 401,
    message: 'Sai tài khoản hoặc mật khẩu',
  },
  AUTH_ACCOUNT_LOCKED: { status: 401, message: 'Tài khoản đã bị khóa' },
  AUTH_SESSION_INVALID: {
    status: 401,
    message: 'Phiên đăng nhập không hợp lệ',
  },
  AUTH_FORBIDDEN: { status: 403, message: 'Bạn không có quyền truy cập' },

  COMMON_NOT_FOUND: {
    status: 404,
    message: 'Không tìm thấy tài nguyên yêu cầu',
  },
  COMMON_CONFLICT: {
    status: 409,
    message: 'Dữ liệu xung đột với dữ liệu hiện có',
  },
  COMMON_CONCURRENT_UPDATE: {
    status: 409,
    message:
      'Dữ liệu vừa được người khác thay đổi, vui lòng tải lại và thử lại',
  },
  COMMON_PAYLOAD_TOO_LARGE: {
    status: 413,
    message: 'Dữ liệu gửi lên quá lớn',
  },
  COMMON_TOO_MANY_REQUESTS: {
    status: 429,
    message: 'Bạn thao tác quá nhanh, vui lòng thử lại sau',
  },
  COMMON_ERROR: { status: 400, message: 'Yêu cầu không hợp lệ' },
  COMMON_SERVICE_UNAVAILABLE: {
    status: 503,
    message: 'Hệ thống chưa sẵn sàng, vui lòng thử lại sau',
  },
  INTERNAL_ERROR: {
    status: 500,
    message: 'Hệ thống đang gặp sự cố, vui lòng thử lại sau',
  },
} as const satisfies Record<string, ErrorDefinition>;

export type ErrorCode = keyof typeof DEFINITIONS;

// Widened so message can be a string or a function for any code.
export const ERROR: Record<ErrorCode, ErrorDefinition> = DEFINITIONS;
