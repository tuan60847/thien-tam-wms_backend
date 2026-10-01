# Xử lý lỗi

## 1. Body lỗi chuẩn

Mọi lỗi (kể cả lỗi của `ValidationPipe`, guard, `NotFoundException` của Nest, lỗi không lường trước) đi qua `HttpExceptionFilter` global và trả cùng một hình dạng:

```json
{
  "statusCode": 422,
  "code": "SO_LO_EXPIRED",
  "message": "Lô thuốc đã hết hạn sử dụng, không thể xuất kho",
  "details": null,
  "path": "/api/v1/phieu-xuat-hang/6f1c…/xuat-kho",
  "timestamp": "2026-10-01T03:12:45.120Z",
  "requestId": "b3b0c5de-…"
}
```

| Trường | Ý nghĩa |
|---|---|
| `statusCode` | HTTP status |
| `code` | Mã máy đọc, ổn định, UPPER_SNAKE — **client dựa vào `code`, không dựa vào `message`** |
| `message` | Tiếng Việt, hiển thị được cho người dùng cuối |
| `details` | `null` hoặc mảng chi tiết (validation: `[{ field, messages[] }]`; nghiệp vụ: các object bổ sung như `{ soLoId, conLai }`) |
| `path`, `timestamp`, `requestId` | Phục vụ hỗ trợ/truy log |

Tương thích ngược với Auth hiện tại: Auth trả `{ message, error, statusCode }`; thay bằng body chuẩn nhưng **giữ nguyên `message` và `statusCode`**, nên test e2e của Auth chỉ cần thêm kiểm `code` (xem §4).

## 2. Mã lỗi

### 2.1 Định dạng

`<DOMAIN>_<REASON>`, UPPER_SNAKE.
- `DOMAIN`: tên nghiệp vụ theo module (`SO_LO`, `TON_KHO`, `PHIEU_XUAT`…). Lỗi dùng chung dùng domain `COMMON` hoặc không tiền tố (xem bảng).
- `REASON`: tiếng Anh, mô tả nguyên nhân: `NOT_FOUND`, `IN_USE`, `INVALID_STATE`, `INSUFFICIENT`, `EXPIRED`, `NAME_TAKEN`…

Quy ước `REASON` thống nhất:

| REASON | Ý nghĩa | HTTP |
|---|---|---|
| `NOT_FOUND` | không tìm thấy bản ghi | 404 |
| `*_TAKEN` | trùng giá trị unique (`NAME_TAKEN`, `CODE_TAKEN`, `USERNAME_TAKEN`…) | 409 |
| `IN_USE` | không xóa/đổi được vì có tham chiếu | 409 |
| `INVALID_STATE` | trạng thái hiện tại không cho phép thao tác | 409 |
| `INSUFFICIENT` | không đủ số lượng | 409 |
| `EXPIRED` / `INACTIVE` / `NOT_VERIFIED` / vi phạm quy tắc cụ thể | dữ liệu hợp lệ về cú pháp nhưng vi phạm quy tắc nghiệp vụ | 422 |

### 2.2 Quy ước HTTP

| Status | Dùng khi |
|---|---|
| 400 | DTO sai (cú pháp, thiếu field, field thừa) — `VALIDATION_FAILED` |
| 401 | chưa đăng nhập / token sai hoặc hết hạn / tài khoản bị khóa |
| 403 | đăng nhập rồi nhưng không đủ quyền |
| 404 | không tìm thấy resource |
| 409 | xung đột với **trạng thái hiện tại**: trùng unique, đang được tham chiếu, sai trạng thái phiếu, không đủ tồn |
| 422 | dữ liệu hợp lệ nhưng vi phạm **quy tắc nghiệp vụ**: lô hết hạn, giá dưới mức tối thiểu, khách hết hạn giấy phép, vượt công nợ |
| 429 | rate limit |
| 500 | lỗi không lường trước (body: `INTERNAL_ERROR`, không lộ chi tiết) |

Phân biệt 409 / 422: 409 = "việc bạn làm đụng vào trạng thái hệ thống hiện tại, thử lại sau khi trạng thái đổi có thể được"; 422 = "dữ liệu bạn gửi vi phạm luật, sửa dữ liệu mới được".

## 3. Mã lỗi dùng chung (không thuộc module)

| Mã | HTTP | Message (VN) |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Dữ liệu gửi lên không hợp lệ |
| `AUTH_UNAUTHORIZED` | 401 | Vui lòng đăng nhập để tiếp tục |
| `AUTH_INVALID_CREDENTIALS` | 401 | Sai tài khoản hoặc mật khẩu |
| `AUTH_ACCOUNT_LOCKED` | 401 | Tài khoản đã bị khóa |
| `AUTH_SESSION_INVALID` | 401 | Phiên đăng nhập không hợp lệ |
| `AUTH_FORBIDDEN` | 403 | Bạn không có quyền truy cập |
| `COMMON_NOT_FOUND` | 404 | Không tìm thấy tài nguyên yêu cầu (route không tồn tại) |
| `COMMON_TOO_MANY_REQUESTS` | 429 | Bạn thao tác quá nhanh, vui lòng thử lại sau |
| `INTERNAL_ERROR` | 500 | Hệ thống đang gặp sự cố, vui lòng thử lại sau |
| `COMMON_INVALID_ID` | 400 | Mã định danh không hợp lệ (UUID sai định dạng) |

Các message `AUTH_*` khớp với message Auth đã có ("Sai tài khoản hoặc mật khẩu", "Tài khoản đã bị khóa", "Phiên đăng nhập không hợp lệ", "Bạn không có quyền truy cập"). "Vui lòng đăng nhập để tiếp tục" thay thế thông báo mặc định của Nest cho thiếu token.

## 4. Cơ chế kỹ thuật

- `AppException extends HttpException` (đặt ở `src/common/errors/`): `new AppException(ERROR.SO_LO_EXPIRED, { details })`. `ERROR` là bảng hằng số `error-codes.ts`: mỗi mã → `{ status, message }`. Message có thể là hàm nhận tham số (`(p) => \`Vượt quá công nợ còn lại ${p.conLai}\``).
- `HttpExceptionFilter` xử lý theo thứ tự: `AppException` → dùng thẳng; `HttpException` khác (ví dụ `UnauthorizedException`, `ForbiddenException` của Auth/guard) → map sang mã `AUTH_*`/`COMMON_*` theo status; lỗi `ValidationPipe` → `VALIDATION_FAILED` + `details`; `PrismaClientKnownRequestError` (xem dưới) → map; còn lại → `INTERNAL_ERROR` và log `error` kèm stack.
- Retrofit Auth: thay `throw new UnauthorizedException('…')` bằng `AppException` (hoặc để filter tự map theo message) — làm ở M0; test Auth cập nhật kiểm thêm `code`.
- **Mapping lỗi Prisma** (lưới an toàn; service vẫn nên kiểm tra tường minh để có mã đúng):

| Prisma | Map |
|---|---|
| `P2002` unique violation | `409`, `code` = mã `*_TAKEN` của module nếu service gắn sẵn; không thì `COMMON_CONFLICT` |
| `P2003` foreign key violation | `409 *_IN_USE` (xóa) hoặc `404 <X>_NOT_FOUND` (tham chiếu tới id không tồn tại) |
| `P2025` record not found | `404 *_NOT_FOUND` |
| `P2034` transaction conflict/deadlock | thử lại tối đa 2 lần trong helper transaction, sau đó `409 COMMON_CONCURRENT_UPDATE` ("Dữ liệu vừa được người khác thay đổi, vui lòng tải lại và thử lại") |

- Không bao giờ trả `error.message` gốc của Prisma/MySQL ra client. Chi tiết kỹ thuật chỉ vào log.
- `requestId`: lấy từ header `x-request-id` nếu client gửi hợp lệ (≤ 64 ký tự an toàn), không thì sinh UUID; trả lại trong header `x-request-id` mọi response.

## 5. Quy tắc viết message

1. Tiếng Việt có dấu, câu hoàn chỉnh, nói **cái gì sai và làm gì tiếp** khi có thể.
2. Không lộ tên bảng, tên cột, id nội bộ, stack trace.
3. Có thể chèn giá trị nghiệp vụ người dùng hiểu (tên lô, tên hàng, số lượng còn lại); không chèn UUID.
4. Giữ giọng trung tính, không đổ lỗi người dùng.

## 6. Danh mục mã lỗi theo module

Bảng tổng hợp mã lỗi (mã, HTTP, mô tả ngắn) của toàn bộ module — nguồn chi tiết là mục 8 của từng module doc; bảng này để tra cứu và để kiểm tra không trùng mã:

| Module | Mã lỗi |
|---|---|
| users | `USER_NOT_FOUND` 404, `USER_USERNAME_TAKEN` 409, `USER_EMAIL_TAKEN` 409, `USER_ROLE_INVALID` 422, `USER_CANNOT_MODIFY_SELF` 409, `USER_LAST_ADMIN` 409, `USER_OLD_PASSWORD_WRONG` 422 |
| roles | `ROLE_NOT_FOUND` 404, `ROLE_SYSTEM_PROTECTED` 409, `ROLE_HAS_ACTIVE_USERS` 409 |
| loai-hang | `LOAI_HANG_NOT_FOUND` 404, `LOAI_HANG_NAME_TAKEN` 409, `LOAI_HANG_IN_USE` 409 |
| hang-hoa | `HANG_HOA_NOT_FOUND` 404, `HANG_HOA_CODE_TAKEN` 409, `HANG_HOA_PRICE_INVALID` 422, `HANG_HOA_CONTROL_TYPE_INVALID` 422, `HANG_HOA_PRICE_UNIT_INVALID` 422, `HANG_HOA_INACTIVE` 422, `HANG_HOA_IN_USE` 409 |
| ty-le-quy-doi | `TY_LE_QUY_DOI_NOT_FOUND` 404, `TY_LE_QUY_DOI_UNIT_TAKEN` 409, `TY_LE_QUY_DOI_BASE_REQUIRED` 422, `TY_LE_QUY_DOI_BASE_IMMUTABLE` 409, `TY_LE_QUY_DOI_LOCKED` 409, `TY_LE_QUY_DOI_IN_USE` 409 |
| kho-vi-tri | `KHO_NOT_FOUND` 404, `KHO_NAME_TAKEN` 409, `KHO_HAS_VI_TRI` 409, `KHO_IN_USE` 409, `VI_TRI_NOT_FOUND` 404, `VI_TRI_NAME_TAKEN` 409, `VI_TRI_HAS_STOCK` 409, `VI_TRI_COLD_CONFLICT` 409, `VI_TRI_INACTIVE` 422, `VI_TRI_IN_USE` 409 |
| khach-hang | `KHACH_HANG_NOT_FOUND` 404, `KHACH_HANG_TAX_CODE_TAKEN` 409, `KHACH_HANG_INACTIVE` 422, `KHACH_HANG_LICENSE_EXPIRED` 422, `KHACH_HANG_CREDIT_EXCEEDED` 422, `KHACH_HANG_IN_USE` 409 |
| nha-cung-cap | `NHA_CUNG_CAP_NOT_FOUND` 404, `NHA_CUNG_CAP_CODE_TAKEN` 409, `NHA_CUNG_CAP_NOT_VERIFIED` 422, `NHA_CUNG_CAP_LICENSE_INCOMPLETE` 422, `NHA_CUNG_CAP_LICENSE_EXPIRED` 422, `NHA_CUNG_CAP_INACTIVE` 422, `NHA_CUNG_CAP_IN_USE` 409 |
| phuong-tien-van-chuyen | `PHUONG_TIEN_NOT_FOUND` 404, `PHUONG_TIEN_PLATE_TAKEN` 409, `PHUONG_TIEN_NOT_COLD` 422, `PHUONG_TIEN_INACTIVE` 422, `PHUONG_TIEN_IN_USE` 409 |
| so-lo | `SO_LO_NOT_FOUND` 404, `SO_LO_NAME_TAKEN` 409, `SO_LO_DATE_INVALID` 422, `SO_LO_EXPIRED` 422, `SO_LO_NEAR_EXPIRY` 422, `SO_LO_IN_USE` 409, `SO_LO_EXPIRY_LOCKED` 409 |
| ton-kho | `TON_KHO_NOT_FOUND` 404, `TON_KHO_INSUFFICIENT` 409, `TON_KHO_COLD_CHAIN_VIOLATION` 422, `TON_KHO_SAME_LOCATION` 422, `TON_KHO_ADJUST_NO_CHANGE` 422 |
| phieu-nhap-hang | `PHIEU_NHAP_NOT_FOUND` 404, `PHIEU_NHAP_INVALID_STATE` 409, `PHIEU_NHAP_EMPTY` 422, `PHIEU_NHAP_DUPLICATE_LINE` 422, `PHIEU_NHAP_UNIT_INVALID` 422, `PHIEU_NHAP_CANNOT_REVERSE` 409, `PHIEU_NHAP_DATE_INVALID` 422 |
| phieu-xuat-hang | `PHIEU_XUAT_NOT_FOUND` 404, `PHIEU_XUAT_INVALID_STATE` 409, `PHIEU_XUAT_EMPTY` 422, `PHIEU_XUAT_DUPLICATE_LINE` 422, `PHIEU_XUAT_UNIT_INVALID` 422, `PHIEU_XUAT_PRICE_BELOW_MIN` 422, `PHIEU_XUAT_CANNOT_REVERSE` 409, `PHIEU_XUAT_LOT_NOT_AT_LOCATION` 422 |
| phieu-thu-cong-no | `PHIEU_THU_NOT_FOUND` 404, `PHIEU_THU_ORDER_INVALID_STATE` 409, `PHIEU_THU_EXCEEDS_DEBT` 422, `PHIEU_THU_DATE_INVALID` 422, `PHIEU_THU_ALREADY_VOID` 409 |
| phieu-thanh-toan | `PHIEU_THANH_TOAN_NOT_FOUND` 404, `PHIEU_THANH_TOAN_RECEIPT_INVALID_STATE` 409, `PHIEU_THANH_TOAN_EXCEEDS_DEBT` 422, `PHIEU_THANH_TOAN_DATE_INVALID` 422, `PHIEU_THANH_TOAN_ALREADY_VOID` 409 |
| bao-cao | `BAO_CAO_RANGE_INVALID` 422, `BAO_CAO_RANGE_TOO_LARGE` 422 |
| tep-dinh-kem | `TEP_NOT_FOUND` 404, `TEP_TOO_LARGE` 422, `TEP_TYPE_NOT_ALLOWED` 422, `TEP_UPLOAD_FAILED` 502, `TEP_TARGET_INVALID` 422 |
| chung | `COMMON_CONFLICT` 409, `COMMON_CONCURRENT_UPDATE` 409 |

(Mã trong bảng chỉ liệt kê tên; message VN đầy đủ nằm trong mục 8 của từng module.)

## 7. Kiểm thử

- Unit test filter: mỗi loại exception đầu vào → body đúng hình dạng; không lộ message Prisma.
- Test bảng `ERROR`: mọi mã có status + message không rỗng; không có hai mã trùng tên; mọi mã trong module doc xuất hiện trong bảng.
- e2e: mỗi module kiểm `code` (không chỉ `message`) cho ít nhất lỗi 404, 409/422 đặc trưng và 400.
