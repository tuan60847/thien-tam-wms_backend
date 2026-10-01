# Module: loai-hang

## 1. Mục đích
- Danh mục phân loại hàng hóa (kháng sinh, giảm đau – hạ sốt, vitamin…) để nhóm, lọc và báo cáo.
- Actors: `ADMIN`, `QUAN_LY_KHO` (quản lý); mọi role đọc.

## 2. Scope
### In scope
- CRUD loại hàng; ngừng sử dụng (`trangThai`); đếm số hàng hóa thuộc loại.
### Out of scope (phase 2)
- Phân cấp loại (loại cha – con), thứ tự hiển thị tùy biến, gắn thuế suất theo loại.

## 3. Dependencies
- Cần có trước: `auth`, `prisma`, `audit`.
- Được dùng bởi: [hang-hoa.md](hang-hoa.md).
- Thư viện ngoài: không thêm.

## 4. Data model
- Model: `LoaiHang` (quan hệ `hangHoas`).
- Quy tắc trường: `tenLoaiHang` 1–100 ký tự, **unique không phân biệt hoa/thường** (P-04); `ghiChu` ≤ 500; `trangThai` (thêm theo P-03) mặc định `true`.
- Đề xuất: P-03 (`trangThai Boolean @default(true)`), P-04 (`@unique tenLoaiHang`), P-02 (`createdById`, `updatedById` — không bắt buộc cho bảng này; chỉ `createdAt/updatedAt` đã có).

## 5. API endpoints
| Method | Path | Auth | Roles | Mô tả ngắn | DTO request | DTO response |
|---|---|---|---|---|---|---|
| GET | `/api/v1/loai-hang` | JWT | mọi role | Danh sách loại hàng | `QueryLoaiHangDto` | `PagedResponse<LoaiHangResponseDto>` |
| GET | `/api/v1/loai-hang/:id` | JWT | mọi role | Chi tiết | — | `LoaiHangResponseDto` |
| POST | `/api/v1/loai-hang` | JWT | ADMIN, QUAN_LY_KHO | Tạo loại hàng | `CreateLoaiHangDto` | `LoaiHangResponseDto` (201) |
| PATCH | `/api/v1/loai-hang/:id` | JWT | ADMIN, QUAN_LY_KHO | Sửa / ngừng sử dụng | `UpdateLoaiHangDto` | `LoaiHangResponseDto` |
| DELETE | `/api/v1/loai-hang/:id` | JWT | ADMIN | Xóa nếu chưa có hàng hóa | — | 204 |

## 6. DTOs
### Request
- `CreateLoaiHangDto { tenLoaiHang: string; ghiChu?: string | null }` — `tenLoaiHang` `@IsNotEmpty @MaxLength(100)`, trim; `ghiChu` `@MaxLength(500)`.
- `UpdateLoaiHangDto` = `PartialType(CreateLoaiHangDto)` + `trangThai?: boolean`.
### Response
- `LoaiHangResponseDto { id; tenLoaiHang; ghiChu: string | null; trangThai: boolean; soHangHoa: number; createdAt; updatedAt }`.
### Query
- `QueryLoaiHangDto extends PaginationQueryDto { trangThai?: boolean }`; `q` tìm trên `tenLoaiHang`, `ghiChu`; sort whitelist: `tenLoaiHang`, `createdAt`; mặc định `tenLoaiHang:asc`.

## 7. Business rules
- BR-01: Tên loại hàng duy nhất, so sánh không phân biệt hoa/thường và sau khi trim.
- BR-02: Chỉ xóa được loại hàng **không có** hàng hóa nào (kể cả hàng ngừng sử dụng); ngược lại `LOAI_HANG_IN_USE`.
- BR-03: Loại hàng `trangThai = false` không được chọn khi tạo/đổi loại của hàng hóa mới (`HangHoa` tham chiếu); hàng hóa cũ thuộc loại đó vẫn hoạt động bình thường.
- BR-04: Đặt lại `trangThai = true` luôn được phép.

## 8. Error cases
| Mã lỗi | HTTP | Khi nào | Message (VN) |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | DTO sai | Dữ liệu gửi lên không hợp lệ |
| `LOAI_HANG_NOT_FOUND` | 404 | id không tồn tại | Không tìm thấy loại hàng |
| `LOAI_HANG_NAME_TAKEN` | 409 | trùng tên | Tên loại hàng đã tồn tại |
| `LOAI_HANG_IN_USE` | 409 | xóa khi còn hàng hóa | Không thể xóa loại hàng đang có hàng hóa |
| `AUTH_FORBIDDEN` | 403 | thiếu quyền | Bạn không có quyền truy cập |

## 9. Service layer design
`LoaiHangService`:
- `findAll(query: QueryLoaiHangDto): Promise<PagedResponse<LoaiHangResponseDto>>`
- `findOne(id: string): Promise<LoaiHangResponseDto>`
- `create(dto: CreateLoaiHangDto): Promise<LoaiHangResponseDto>` — kiểm trùng tên (không phân biệt hoa/thường).
- `update(id: string, dto: UpdateLoaiHangDto): Promise<LoaiHangResponseDto>`
- `remove(id: string): Promise<void>` — đếm `hangHoa` rồi xóa.
- `assertUsable(id: string): Promise<LoaiHang>` — loại hàng phải tồn tại và `trangThai = true`; nếu không thì ném `LOAI_HANG_NOT_FOUND` (loại hàng bị tắt được coi như không còn chọn được, thông điệp với người dùng giống nhau). Dùng bởi `hang-hoa`.

Transaction: `remove` (đếm + xóa trong một transaction để không xóa khi vừa có hàng hóa mới). Side effects: không.

## 10. Controller layer
- Map 1–1 với service. Guards: `JwtAuthGuard` global; `GET` không `@Roles`; `POST/PATCH` `@Roles(ADMIN, QUAN_LY_KHO)`; `DELETE` `@Roles(ADMIN)`.
- Interceptors: không.

## 11. File layout
```
src/loai-hang/
  loai-hang.module.ts
  loai-hang.controller.ts
  loai-hang.service.ts
  loai-hang.service.spec.ts
  loai-hang.controller.spec.ts
  loai-hang.mapper.ts
  dto/
    create-loai-hang.dto.ts
    update-loai-hang.dto.ts
    query-loai-hang.dto.ts
    loai-hang-response.dto.ts
```

## 12. Test plan
### Unit tests
- `create() — tên hợp lệ → tạo và trả soHangHoa = 0`
- `create() — tên trùng khác hoa/thường ("Kháng sinh" vs "kháng sinh") → LOAI_HANG_NAME_TAKEN`
- `create() — tên chỉ khoảng trắng → VALIDATION_FAILED`
- `findAll() — q lọc theo tên, trangThai lọc đúng, phân trang đúng`
- `findAll() — sort field ngoài whitelist → VALIDATION_FAILED`
- `findOne() — không tồn tại → LOAI_HANG_NOT_FOUND`
- `update() — đổi tên sang tên đã tồn tại → LOAI_HANG_NAME_TAKEN`
- `update() — đổi tên giữ nguyên (cùng bản ghi) → thành công`
- `update() — ngừng sử dụng → trangThai = false`
- `remove() — không có hàng hóa → xóa`
- `remove() — còn hàng hóa → LOAI_HANG_IN_USE`
- `remove() — không tồn tại → LOAI_HANG_NOT_FOUND`
- `assertUsable() — loại bị tắt → ném lỗi; loại hoạt động → trả bản ghi`
- `CreateLoaiHangDto — thiếu tên / tên > 100 ký tự → lỗi`
### E2E tests
- Quản lý tạo → 201; list thấy; `GET :id` đúng `soHangHoa`.
- Tạo trùng tên → 409 `LOAI_HANG_NAME_TAKEN`.
- Có hàng hóa thuộc loại → `DELETE` bởi ADMIN → 409; xóa hết hàng hóa → 204.
- Ma trận role: `NHAN_VIEN_KHO`/`KE_TOAN` `GET` → 200, `POST/PATCH` → 403; `QUAN_LY_KHO` `DELETE` → 403, ADMIN → 204; không token → 401.

## 13. Permissions
| Action | ADMIN | QUAN_LY_KHO | NHAN_VIEN_KHO | KE_TOAN |
|---|---|---|---|---|
| list / read | ✓ | ✓ | ✓ | ✓ |
| create / update | ✓ | ✓ | ✗ | ✗ |
| delete | ✓ | ✗ | ✗ | ✗ |

## 14. Open questions
- **Q-LOAI-1**: Danh sách loại hàng ban đầu có sẵn chưa (để làm dữ liệu import), có phân cấp (ví dụ Thuốc → Kháng sinh → Penicillin) không?
- **Q-LOAI-2**: Loại hàng có cần mã (ví dụ `KS`, `GD`) để in phiếu không?
