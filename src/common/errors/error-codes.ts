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

  ROLE_NOT_FOUND: { status: 404, message: 'Không tìm thấy vai trò' },
  ROLE_SYSTEM_PROTECTED: {
    status: 409,
    message: 'Không thể vô hiệu hóa vai trò Quản trị viên',
  },
  ROLE_HAS_ACTIVE_USERS: {
    status: 409,
    message:
      'Vai trò vẫn còn người dùng đang hoạt động, hãy chuyển họ sang vai trò khác trước',
  },

  USER_NOT_FOUND: { status: 404, message: 'Không tìm thấy người dùng' },
  USER_USERNAME_TAKEN: {
    status: 409,
    message: 'Tên đăng nhập đã được sử dụng',
  },
  USER_EMAIL_TAKEN: { status: 409, message: 'Email đã được sử dụng' },
  USER_ROLE_INVALID: {
    status: 422,
    message: 'Vai trò không hợp lệ hoặc đã bị vô hiệu hóa',
  },
  USER_CANNOT_MODIFY_SELF: {
    status: 409,
    message: 'Bạn không thể tự thay đổi vai trò hoặc khóa chính mình',
  },
  USER_LAST_ADMIN: {
    status: 409,
    message: 'Phải còn ít nhất một quản trị viên đang hoạt động',
  },
  USER_OLD_PASSWORD_WRONG: {
    status: 422,
    message: 'Mật khẩu hiện tại không đúng',
  },

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
