# Quy ước API

## 1. URL

- Prefix toàn cục: **`/api/v1`** (`app.setGlobalPrefix('api/v1')`). Mọi path trong tài liệu này viết đầy đủ kèm prefix khi cần, hoặc ngắn gọn trong module doc (không prefix).
- Versioning theo URL. Chỉ tăng `v2` khi có thay đổi phá vỡ không tránh được; `v1` giữ tương thích ngược (thêm field được, đổi/xóa field không).
- Resource: kebab-case, danh từ nghiệp vụ tiếng Việt không dấu, **số ít**, không thêm "s": `/hang-hoa`, `/so-lo`, `/phieu-nhap-hang`. Ngoại lệ do tên module: `/users`, `/roles`.
- Quan hệ cha–con khi con không có ý nghĩa độc lập: `/hang-hoa/:hangHoaId/ty-le-quy-doi`. Tránh lồng quá 2 cấp.
- Hành động nghiệp vụ không phải CRUD: `POST /<resource>/:id/<hành-động>` với hành động kebab-case tiếng Việt không dấu: `/xac-nhan`, `/huy`, `/xuat-kho`, `/giao-hang`, `/xac-minh`.
- Truy vấn tổng hợp: `GET /<resource>/<danh-từ>` (`/ton-kho/tong-hop`, `/ton-kho/goi-y-xuat`, `/bao-cao/doanh-thu`).
- `:id` luôn UUID, kiểm bằng `ParseUUIDPipe` (sai → `400 COMMON_INVALID_ID`).

**Thay đổi so với Auth hiện tại:** các route Auth đang là `/auth/*`; ở M0 chuyển thành `/api/v1/auth/*` (cập nhật `docs/auth/README.md`, test e2e và client).

## 2. Ngữ nghĩa HTTP method

| Method | Dùng cho | Idempotent |
|---|---|---|
| `GET` | đọc, không đổi trạng thái | có |
| `POST` | tạo mới; hành động nghiệp vụ (`/xac-nhan`…) | không |
| `PATCH` | cập nhật một phần (body chỉ chứa field cần đổi) | nên có |
| `PUT` | **không dùng** (luôn cập nhật một phần) | — |
| `DELETE` | xóa cứng khi cho phép (xem [conventions.md](../00-overview/conventions.md) §8) | có |

## 3. Status code

| Tình huống | Status |
|---|---|
| Đọc / hành động thành công trả dữ liệu | `200 OK` |
| Tạo mới (`POST` tạo resource) | `201 Created` + resource vừa tạo (header `Location` không bắt buộc) |
| Hành động nghiệp vụ trả trạng thái mới (`/xac-nhan`) | `200 OK` + resource đã cập nhật |
| Xóa thành công, đăng xuất | `204 No Content`, không body |
| Lỗi | xem [error-handling.md](../03-cross-cutting/error-handling.md) (400/401/403/404/409/422/429/500) |

Ghi chú: Auth hiện trả `200` cho login/refresh (đã có `@HttpCode(200)`) — giữ nguyên, đây là ngoại lệ do login không "tạo resource".

## 4. Dạng response

- **Thành công, một resource:** trả thẳng đối tượng (không bọc `data`). Ví dụ `GET /hang-hoa/:id` → `{ "id": "…", "tenSP": "…" }`.
- **Danh sách:** `{ "items": […], "meta": { "page", "pageSize", "total", "totalPages" } }` — xem [pagination-filtering.md](../03-cross-cutting/pagination-filtering.md).
- **Tổng hợp/báo cáo:** đối tượng riêng của báo cáo, luôn có `generatedAt` (ISO) và tham số kỳ đã dùng.
- **Lỗi:** body chuẩn `{ statusCode, code, message, details, path, timestamp, requestId }`.
- **Không bọc envelope** `{ data, message, success }`: client dựa vào status code và `code`, giảm boilerplate, khớp Auth hiện có.

## 5. Kiểu dữ liệu trong JSON

| Kiểu nghiệp vụ | JSON |
|---|---|
| ID | chuỗi UUID |
| Tiền | **chuỗi** `"125000.00"` (2 chữ số thập phân); request chấp nhận chuỗi khớp `^\d{1,13}(\.\d{1,2})?$`, không chấp nhận số |
| Số lượng | số nguyên |
| Ngày (chỉ ngày) | chuỗi `"2027-03-31"` |
| Thời điểm | chuỗi ISO 8601 UTC `"2026-10-01T03:00:00.000Z"` |
| Boolean | `true`/`false` |
| Trạng thái, enum | chuỗi snake_case `"da_nhap_kho"` |
| Trường rỗng | `null` (luôn có mặt trong response, không bỏ khỏi object) |
| Mảng rỗng | `[]` |

Tên field: camelCase đúng như tên trường Prisma (`hanSuDung`, `tenSP`, `SDT`…), kể cả tên có chữ in hoa lẫn như `maKH`, `SDTNDD`, `tenSP` — **giữ nguyên** để khớp schema (không đổi tên ở tầng API).

## 6. Header

| Header | Chiều | Ghi chú |
|---|---|---|
| `Authorization: Bearer <accessToken>` | request | mọi route trừ public |
| `Content-Type: application/json` | request | trừ upload (`multipart/form-data`) |
| `X-Request-Id` | request (tùy chọn) / response (luôn có) | truy vết |
| `Accept-Language` | — | **không dùng**; message luôn tiếng Việt |

## 7. Bảo mật mức API

- `helmet` bật; CORS chỉ cho origin trong `CORS_ORIGINS` (danh sách phân tách phẩy); không dùng `*` ở production.
- Rate limit: `/auth/login` 5 lần/phút/IP (đề xuất, `@nestjs/throttler`); các route còn lại giới hạn nới (ví dụ 300/phút/user) hoặc chưa bật — câu hỏi mở.
- Giới hạn kích thước body JSON: 1 MB (upload dùng giới hạn riêng).
- Không có route nào trả `password`, `tokenHash`; response luôn đi qua mapper tường minh.

## 8. Idempotency và đồng thời

- Hành động đổi trạng thái (`/xac-nhan`, `/xuat-kho`, `/huy`…) an toàn khi gọi lặp: lần hai trả `409 *_INVALID_STATE` (không áp dụng hai lần).
- `POST` tạo chứng từ **chưa** hỗ trợ `Idempotency-Key` ở phase 1 (mạng lỗi khiến client gửi lại có thể tạo phiếu nháp trùng). Câu hỏi mở: có cần header `Idempotency-Key` cho tạo phiếu không.
- Tránh ghi đè mù: `PATCH` phiếu nháp nhận `updatedAt` hiện có của client làm `expectedUpdatedAt` (đề xuất, tùy chọn); lệch → `409 COMMON_CONCURRENT_UPDATE`. Câu hỏi mở.

## 9. Ghi chú danh sách đặc thù

- Mọi list có whitelist sort riêng, ghi trong module doc.
- List chứng từ trả bản rút gọn (không kèm `chiTiet`, có `tongTien`, `soDong`); `GET /:id` trả đầy đủ dòng.
- Tìm kiếm `q` nêu rõ cột tìm trong module doc.
