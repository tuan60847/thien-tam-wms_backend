# OpenAPI / Swagger

## 1. Mục tiêu

Tài liệu API sống, sinh từ chính DTO và decorator, để dev frontend/QA thử endpoint mà không cần đọc code. Là bổ sung, **không thay thế** [endpoints-catalog.md](endpoints-catalog.md) (catalog là nguồn sự thật về quyền; Swagger là nguồn sự thật về hình dạng dữ liệu).

## 2. Cài đặt (M0)

- Gói: `@nestjs/swagger` (kiểm tra bản tương thích NestJS 12 khi cài).
- Bootstrap ở `main.ts` thông qua hàm `setupSwagger(app)` đặt tại `src/common/swagger/setup-swagger.ts`.
- Đường dẫn UI: `/api/docs`; JSON: `/api/docs-json`.
- **Bật theo môi trường:** chỉ khi `SWAGGER_ENABLED=true` (mặc định `true` ở dev/staging, `false` ở production). Nếu cần bật ở production: bảo vệ bằng basic-auth (`SWAGGER_USER`/`SWAGGER_PASSWORD`).
- Metadata: tiêu đề "ThienTamWMS API", version từ `package.json`, mô tả tiếng Việt ngắn, server `/api/v1`.

## 3. Xác thực trong Swagger

`DocumentBuilder().addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')`. Mọi controller (trừ route `@Public`) gắn `@ApiBearerAuth('access-token')` — làm tự động bằng cách áp ở mức document (`security`) rồi bỏ cho route public. Có nút **Authorize** để dán access token; để lấy token gọi `POST /auth/login` ngay trong UI.

## 4. Nhóm (tags)

Một tag mỗi module, đặt tên tiếng Việt có dấu để dev dễ tìm; thứ tự theo roadmap:

`Auth` · `Người dùng` · `Vai trò` · `Loại hàng` · `Hàng hóa` · `Tỷ lệ quy đổi` · `Kho` · `Vị trí` · `Khách hàng` · `Nhà cung cấp` · `Phương tiện vận chuyển` · `Số lô` · `Tồn kho` · `Phiếu nhập hàng` · `Phiếu thanh toán` · `Phiếu xuất hàng` · `Phiếu thu công nợ` · `Báo cáo` · `Tệp đính kèm` · `Nhật ký` · `Hệ thống`

Controller khai báo `@ApiTags('…')`.

## 5. Quy ước chú thích

Mỗi endpoint có:
- `@ApiOperation({ summary })` — một dòng tiếng Việt, khớp cột "Mô tả ngắn" trong module doc.
- `@ApiOkResponse` / `@ApiCreatedResponse` với kiểu response DTO (`{ type: HangHoaResponseDto }`; list dùng `PagedResponseDto(HangHoaResponseDto)` — helper tạo schema generic).
- `@ApiResponse` cho các lỗi đặc thù (409/422) kèm `ApiErrorResponse` (schema body lỗi chuẩn) và mô tả `code` có thể gặp.
- DTO field: `@ApiProperty({ description, example })`, `@ApiPropertyOptional` cho optional; ví dụ thực tế (`example: '2027-03-31'`, `example: '125000.00'`).
- Enum: `enum` + `enumName`.
- Quyền: `@ApiOperation({ description })` ghi "Quyền: ADMIN, QUAN_LY_KHO" (sinh tự động từ metadata `@Roles` bằng decorator tổng hợp `@Auth(...roles)` — đề xuất).

Decorator tổng hợp `@Auth(...roles)` = `@Roles(...roles)` + `@ApiBearerAuth` + `@ApiForbiddenResponse` + `@ApiUnauthorizedResponse`: một nơi duy nhất vừa gắn quyền vừa tài liệu hóa → không lệch nhau.

## 6. Schema dùng chung

| Schema | Dùng cho |
|---|---|
| `ApiErrorResponse` | body lỗi chuẩn |
| `PageMeta` | `meta` của danh sách |
| `PagedResponse<T>` | list (sinh theo kiểu `T`) |
| `Money` | chuỗi tiền (`type: string`, `pattern`, `example`) |
| `DateOnly` | chuỗi `YYYY-MM-DD` |

## 7. Ví dụ schema cần có sẵn

- `LoginDto` / kết quả login (đã có ở Auth, bổ sung `@ApiProperty` khi retrofit M0).
- Ví dụ request tạo `PhieuNhapHang` với 2 dòng (một lô có sẵn, một lô tạo mới) và `PhieuXuatHang` với dòng FEFO — đặt làm `examples` trong `@ApiBody`.
- Ví dụ response lỗi 422 `SO_LO_EXPIRED` có `details`.

## 8. Plugin Nest CLI

Bật `@nestjs/swagger` plugin trong `nest-cli.json` (`"plugins": ["@nestjs/swagger"]`, `introspectComments: true`) để tự suy ra schema từ DTO và comment JSDoc, giảm `@ApiProperty` thủ công. Lưu ý plugin phải tương thích với cách build ESM/SWC hiện dùng — kiểm tra lúc cài (rủi ro đã biết, ghi ở câu hỏi mở nếu phát sinh).

## 9. Kiểm thử

- e2e: `GET /api/docs-json` (khi bật) trả 200 và là OpenAPI hợp lệ (kiểm `openapi` field, có `paths`).
- Test đối chiếu: mọi route trong document (trừ `@Public`) có `security` và có mô tả; số route khớp [endpoints-catalog.md](endpoints-catalog.md) (script đếm). Tránh endpoint "mồ côi" chưa tài liệu hóa.
- Production: kiểm `SWAGGER_ENABLED=false` ⇒ `/api/docs` trả 404.
