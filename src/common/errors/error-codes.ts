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

  LOAI_HANG_NOT_FOUND: { status: 404, message: 'Không tìm thấy loại hàng' },
  LOAI_HANG_NAME_TAKEN: { status: 409, message: 'Tên loại hàng đã tồn tại' },
  LOAI_HANG_IN_USE: {
    status: 409,
    message: 'Không thể xóa loại hàng đang có hàng hóa',
  },

  HANG_HOA_NOT_FOUND: { status: 404, message: 'Không tìm thấy hàng hóa' },
  HANG_HOA_CODE_TAKEN: { status: 409, message: 'Mã hàng hóa đã tồn tại' },
  HANG_HOA_PRICE_INVALID: {
    status: 422,
    message: 'Giá tối thiểu không được lớn hơn giá hiển thị',
  },
  HANG_HOA_CONTROL_TYPE_INVALID: {
    status: 422,
    message:
      'Thuốc kê đơn/kiểm soát đặc biệt cần khai báo loại kiểm soát và số đăng ký',
  },
  HANG_HOA_PRICE_UNIT_INVALID: {
    status: 422,
    message: 'Đơn vị tính giá không thuộc các đơn vị của hàng hóa',
  },
  HANG_HOA_INACTIVE: { status: 422, message: 'Hàng hóa đã ngừng kinh doanh' },
  HANG_HOA_IN_USE: {
    status: 409,
    message:
      'Không thể xóa hàng hóa đã phát sinh lô, hãy chuyển sang ngừng kinh doanh',
  },

  TY_LE_QUY_DOI_NOT_FOUND: {
    status: 404,
    message: 'Không tìm thấy đơn vị tính',
  },
  TY_LE_QUY_DOI_UNIT_TAKEN: {
    status: 409,
    message: 'Đơn vị tính đã tồn tại cho hàng hóa này',
  },
  TY_LE_QUY_DOI_BASE_REQUIRED: {
    status: 422,
    message:
      'Mỗi hàng hóa chỉ có một đơn vị cơ bản, các đơn vị khác phải có hệ số quy đổi lớn hơn 1',
  },
  TY_LE_QUY_DOI_BASE_IMMUTABLE: {
    status: 409,
    message: 'Không thể xóa hoặc thay đổi hệ số của đơn vị cơ bản',
  },
  TY_LE_QUY_DOI_LOCKED: {
    status: 409,
    message: 'Hàng hóa đã phát sinh lô nên không thể đổi tên hoặc hệ số đơn vị',
  },
  TY_LE_QUY_DOI_IN_USE: {
    status: 409,
    message: 'Đơn vị tính đang được sử dụng nên không thể xóa',
  },

  KHO_NOT_FOUND: { status: 404, message: 'Không tìm thấy kho' },
  KHO_NAME_TAKEN: { status: 409, message: 'Tên kho đã tồn tại' },
  KHO_HAS_VI_TRI: {
    status: 409,
    message: 'Kho còn vị trí lưu trữ, hãy xóa hoặc chuyển các vị trí trước',
  },
  KHO_IN_USE: {
    status: 409,
    message: 'Kho đang còn hàng tồn nên không thể vô hiệu hóa',
  },
  VI_TRI_NOT_FOUND: { status: 404, message: 'Không tìm thấy vị trí' },
  VI_TRI_NAME_TAKEN: {
    status: 409,
    message: 'Tên vị trí đã tồn tại trong kho này',
  },
  VI_TRI_HAS_STOCK: {
    status: 409,
    message: 'Vị trí còn hàng tồn, hãy chuyển hoặc xuất hết hàng trước',
  },
  VI_TRI_COLD_CONFLICT: {
    status: 409,
    message:
      'Vị trí đang chứa hàng cần bảo quản lạnh nên không thể bỏ thuộc tính cấp đông',
  },
  VI_TRI_INACTIVE: { status: 422, message: 'Vị trí đã ngừng sử dụng' },
  VI_TRI_IN_USE: {
    status: 409,
    message: 'Vị trí đã phát sinh dữ liệu nên không thể xóa, hãy vô hiệu hóa',
  },

  KHACH_HANG_NOT_FOUND: { status: 404, message: 'Không tìm thấy khách hàng' },
  KHACH_HANG_TAX_CODE_TAKEN: {
    status: 409,
    message: 'Mã số thuế đã được sử dụng cho khách hàng khác',
  },
  KHACH_HANG_INACTIVE: {
    status: 422,
    message: 'Khách hàng đã ngừng hoạt động',
  },
  KHACH_HANG_LICENSE_EXPIRED: {
    status: 422,
    message:
      'Giấy phép kinh doanh của khách hàng đã hết hạn hoặc chưa được khai báo',
  },
  KHACH_HANG_IN_USE: {
    status: 409,
    message:
      'Khách hàng đã phát sinh phiếu xuất nên không thể xóa, hãy chuyển sang ngừng hoạt động',
  },

  NHA_CUNG_CAP_NOT_FOUND: {
    status: 404,
    message: 'Không tìm thấy nhà cung cấp',
  },
  NHA_CUNG_CAP_CODE_TAKEN: {
    status: 409,
    message: 'Mã nhà cung cấp đã tồn tại',
  },
  NHA_CUNG_CAP_LICENSE_INCOMPLETE: {
    status: 422,
    message: 'Hồ sơ giấy phép chưa đầy đủ để xác minh',
  },
  NHA_CUNG_CAP_LICENSE_EXPIRED: {
    status: 422,
    message: 'Giấy phép của nhà cung cấp đã hết hạn',
  },
  NHA_CUNG_CAP_NOT_VERIFIED: {
    status: 422,
    message: 'Nhà cung cấp chưa được xác minh',
  },
  NHA_CUNG_CAP_INACTIVE: {
    status: 422,
    message: 'Nhà cung cấp đã ngừng hoạt động',
  },
  NHA_CUNG_CAP_IN_USE: {
    status: 409,
    message:
      'Nhà cung cấp đã phát sinh phiếu nhập nên không thể xóa, hãy chuyển sang ngừng hoạt động',
  },

  PHUONG_TIEN_NOT_FOUND: { status: 404, message: 'Không tìm thấy phương tiện' },
  PHUONG_TIEN_PLATE_TAKEN: { status: 409, message: 'Biển số đã tồn tại' },
  PHUONG_TIEN_NOT_COLD: {
    status: 422,
    message:
      'Phương tiện không phải xe lạnh nên không thể chở hàng cần bảo quản lạnh',
  },
  PHUONG_TIEN_INACTIVE: {
    status: 422,
    message: 'Phương tiện đã ngừng sử dụng',
  },
  PHUONG_TIEN_IN_USE: {
    status: 409,
    message:
      'Phương tiện đã được sử dụng nên không thể xóa, hãy chuyển sang ngừng sử dụng',
  },

  SO_LO_NOT_FOUND: { status: 404, message: 'Không tìm thấy số lô' },
  SO_LO_NAME_TAKEN: {
    status: 409,
    message: 'Số lô này đã tồn tại cho hàng hóa',
  },
  SO_LO_DATE_INVALID: {
    status: 422,
    message:
      'Ngày sản xuất hoặc hạn sử dụng không hợp lệ hoặc không khớp với lô đã có',
  },
  SO_LO_EXPIRED: { status: 422, message: 'Lô đã hết hạn sử dụng' },
  SO_LO_NEAR_EXPIRY: {
    status: 422,
    message:
      'Lô sắp hết hạn, không đạt thời hạn sử dụng tối thiểu để nhập/xuất',
  },
  SO_LO_IN_USE: {
    status: 409,
    message: 'Lô đã phát sinh dữ liệu nên không thể xóa hoặc đổi tên',
  },
  SO_LO_EXPIRY_LOCKED: {
    status: 409,
    message: 'Lô đã được xuất kho nên không thể thay đổi hạn sử dụng',
  },

  TON_KHO_NOT_FOUND: {
    status: 404,
    message: 'Không tìm thấy dòng tồn kho',
  },
  TON_KHO_INSUFFICIENT: {
    status: 409,
    message: (p) => `Số lượng tồn không đủ (còn ${Number(p.conLai ?? 0)})`,
  },
  TON_KHO_COLD_CHAIN_VIOLATION: {
    status: 422,
    message: 'Hàng cần bảo quản lạnh chỉ được đặt ở vị trí cấp đông',
  },
  TON_KHO_SAME_LOCATION: {
    status: 422,
    message: 'Vị trí đích phải khác vị trí nguồn',
  },
  TON_KHO_ADJUST_NO_CHANGE: {
    status: 422,
    message: 'Số lượng điều chỉnh trùng với tồn hiện tại',
  },

  PHIEU_NHAP_NOT_FOUND: {
    status: 404,
    message: 'Không tìm thấy phiếu nhập hàng',
  },
  PHIEU_NHAP_INVALID_STATE: {
    status: 409,
    message: 'Phiếu nhập không ở trạng thái cho phép thực hiện thao tác này',
  },
  PHIEU_NHAP_EMPTY: {
    status: 422,
    message: 'Phiếu nhập chưa có mặt hàng nào',
  },
  PHIEU_NHAP_DUPLICATE_LINE: {
    status: 422,
    message: 'Phiếu có hai dòng trùng lô và vị trí, hãy gộp lại',
  },
  PHIEU_NHAP_UNIT_INVALID: {
    status: 422,
    message: 'Đơn vị tính không hợp lệ cho hàng hóa này',
  },
  PHIEU_NHAP_DATE_INVALID: {
    status: 422,
    message: 'Ngày nhận hàng không hợp lệ',
  },
  PHIEU_NHAP_CANNOT_REVERSE: {
    status: 409,
    message:
      'Không thể hủy vì hàng đã được xuất, chuyển đi hoặc phiếu đã có thanh toán',
  },

  PHIEU_THANH_TOAN_NOT_FOUND: {
    status: 404,
    message: 'Không tìm thấy phiếu thanh toán',
  },
  PHIEU_THANH_TOAN_RECEIPT_INVALID_STATE: {
    status: 409,
    message: 'Chỉ thanh toán được cho phiếu nhập đã nhập kho',
  },
  PHIEU_THANH_TOAN_EXCEEDS_DEBT: {
    status: 422,
    message: (p) =>
      `Số tiền thanh toán vượt quá số còn nợ (${Number(p.conNo ?? 0).toFixed(2)})`,
  },
  PHIEU_THANH_TOAN_DATE_INVALID: {
    status: 422,
    message: 'Ngày thanh toán không hợp lệ',
  },
  PHIEU_THANH_TOAN_ALREADY_VOID: {
    status: 409,
    message: 'Phiếu thanh toán đã được hủy trước đó',
  },

  PHIEU_XUAT_NOT_FOUND: {
    status: 404,
    message: 'Không tìm thấy phiếu xuất hàng',
  },
  PHIEU_XUAT_INVALID_STATE: {
    status: 409,
    message: 'Phiếu xuất không ở trạng thái cho phép thực hiện thao tác này',
  },
  PHIEU_XUAT_EMPTY: {
    status: 422,
    message: 'Phiếu xuất chưa có mặt hàng nào',
  },
  PHIEU_XUAT_DUPLICATE_LINE: {
    status: 422,
    message: 'Phiếu có hai dòng trùng lô và vị trí, hãy gộp lại',
  },
  PHIEU_XUAT_UNIT_INVALID: {
    status: 422,
    message: 'Đơn vị tính không hợp lệ cho hàng hóa này',
  },
  PHIEU_XUAT_PRICE_BELOW_MIN: {
    status: 422,
    message: 'Đơn giá thấp hơn mức tối thiểu cho phép',
  },
  PHIEU_XUAT_LOT_NOT_AT_LOCATION: {
    status: 422,
    message: 'Lô này không có hàng tại vị trí đã chọn',
  },
  PHIEU_XUAT_CANNOT_REVERSE: {
    status: 409,
    message: 'Không thể hủy vì phiếu đã có thu tiền, hãy hủy phiếu thu trước',
  },

  PHIEU_THU_NOT_FOUND: {
    status: 404,
    message: 'Không tìm thấy phiếu thu công nợ',
  },
  PHIEU_THU_ORDER_INVALID_STATE: {
    status: 409,
    message: 'Chỉ thu tiền được cho phiếu xuất đã xuất kho',
  },
  PHIEU_THU_EXCEEDS_DEBT: {
    status: 422,
    message: (p) =>
      `Số tiền thu vượt quá số còn nợ (${Number(p.conNo ?? 0).toFixed(2)})`,
  },
  PHIEU_THU_DATE_INVALID: {
    status: 422,
    message: 'Ngày thu tiền không hợp lệ',
  },
  PHIEU_THU_ALREADY_VOID: {
    status: 409,
    message: 'Phiếu thu đã được hủy trước đó',
  },

  TEP_NOT_FOUND: { status: 404, message: 'Không tìm thấy tệp đính kèm' },
  TEP_NO_FILE: { status: 400, message: 'Chưa chọn tệp để tải lên' },
  TEP_TYPE_NOT_ALLOWED: {
    status: 422,
    message: 'Định dạng tệp không được hỗ trợ (chỉ PDF, JPEG, PNG, WebP)',
  },
  TEP_TARGET_INVALID: {
    status: 422,
    message: 'Đối tượng đính kèm không hợp lệ hoặc đã đủ số tệp tối đa',
  },
  TEP_STORAGE_FAILED: {
    status: 500,
    message: 'Không thể lưu hoặc đọc tệp, vui lòng thử lại',
  },

  NHAN_VIEN_KD_NOT_FOUND: {
    status: 404,
    message: 'Không tìm thấy nhân viên kinh doanh',
  },
  NHAN_VIEN_KD_INACTIVE: {
    status: 422,
    message: 'Nhân viên kinh doanh đã ngừng hoạt động',
  },
  NHAN_VIEN_KD_USER_TAKEN: {
    status: 409,
    message: 'Tài khoản người dùng này đã được gắn cho nhân viên khác',
  },
  NHAN_VIEN_KD_IN_USE: {
    status: 409,
    message: 'Nhân viên đã phát sinh dữ liệu nên không thể xóa',
  },
  DIEU_KHOAN_NOT_FOUND: {
    status: 404,
    message: 'Không tìm thấy điều khoản thanh toán',
  },
  DIEU_KHOAN_CODE_TAKEN: {
    status: 409,
    message: 'Mã điều khoản thanh toán đã tồn tại',
  },
  DIEU_KHOAN_IN_USE: {
    status: 409,
    message: 'Điều khoản thanh toán đang được sử dụng nên không thể xóa',
  },
  NHOM_DOI_TAC_NOT_FOUND: {
    status: 404,
    message: 'Không tìm thấy nhóm khách hàng / nhà cung cấp',
  },
  NHOM_DOI_TAC_CODE_TAKEN: {
    status: 409,
    message: 'Mã nhóm đã tồn tại',
  },
  NHOM_DOI_TAC_IN_USE: {
    status: 409,
    message: 'Nhóm đang được sử dụng nên không thể xóa',
  },
  BAO_GIA_NOT_FOUND: { status: 404, message: 'Không tìm thấy báo giá' },
  KHACH_HANG_CREDIT_EXCEEDED: {
    status: 422,
    message: (p) =>
      `Công nợ vượt hạn mức của khách hàng (hạn mức ${Number(p.hanMuc ?? 0).toFixed(2)}, sau phiếu này ${Number(p.sauPhieu ?? 0).toFixed(2)})`,
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
