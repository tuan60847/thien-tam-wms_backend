# Module: phuong-tien-van-chuyen

## 1. Mục đích
- Danh mục phương tiện vận chuyển (xe) dùng để chở hàng nhập (và giao hàng, nếu chốt gắn vào phiếu xuất), đặc biệt phân biệt xe lạnh cho hàng cần bảo quản lạnh.
- Actors: `ADMIN`, `QUAN_LY_KHO`, `NHAN_VIEN_KHO` (tạo/sửa); mọi role đọc.

## 2. Scope
### In scope
- CRUD phương tiện; chuẩn hóa biển số; cờ xe lạnh; vô hiệu hóa.
### Out of scope (phase 2)
- Tài xế, lịch trình/định tuyến, theo dõi GPS, bảo dưỡng/đăng kiểm, chi phí vận chuyển, nhà vận chuyển bên thứ ba có hợp đồng.

## 3. Dependencies
- Cần có trước: `auth`, `prisma`, `audit` (nhẹ).
- Được dùng bởi: [phieu-nhap-hang.md](phieu-nhap-hang.md) (`phuongTienVanChuyenId` đã có), [phieu-xuat-hang.md](phieu-xuat-hang.md) (nếu chốt P-09).
- Thư viện ngoài: không thêm.

## 4. Data model
- Model: `PhuongTienVanChuyen` (`bienSo`, `loaiPhuongTien`).
- Quy tắc trường: `bienSo` đã chuẩn hóa (bỏ khoảng trắng, `.`, `-`, in hoa), unique, khớp `^\d{2}[A-Z]{1,2}\d{4,6}$`; `loaiPhuongTien` ≤ 50 (ví dụ "Xe tải 1.5 tấn"); `isXeLanh` (**mới**, P-21) mặc định `false`; `trangThai` (**mới**, P-03) mặc định `true`.
- Đề xuất: P-02, P-03, **P-21** (`isXeLanh Boolean @default(false)`); liên quan P-09 (gắn xe vào phiếu xuất).

## 5. API endpoints
| Method | Path | Auth | Roles | Mô tả ngắn | DTO request | DTO response |
|---|---|---|---|---|---|---|
| GET | `/api/v1/phuong-tien-van-chuyen` | JWT | mọi role | Danh sách phương tiện | `QueryPhuongTienDto` | `PagedResponse<PhuongTienResponseDto>` |
| GET | `/api/v1/phuong-tien-van-chuyen/:id` | JWT | mọi role | Chi tiết | — | `PhuongTienResponseDto` |
| POST | `/api/v1/phuong-tien-van-chuyen` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Thêm phương tiện | `CreatePhuongTienDto` | `PhuongTienResponseDto` (201) |
| PATCH | `/api/v1/phuong-tien-van-chuyen/:id` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Sửa / vô hiệu hóa | `UpdatePhuongTienDto` | `PhuongTienResponseDto` |
| DELETE | `/api/v1/phuong-tien-van-chuyen/:id` | JWT | ADMIN | Xóa nếu chưa dùng | — | 204 |

## 6. DTOs
### Request
- `CreatePhuongTienDto { bienSo: string; loaiPhuongTien?: string | null; isXeLanh?: boolean }` — `bienSo` `@IsVehiclePlate` (chuẩn hóa trước khi kiểm).
- `UpdatePhuongTienDto = PartialType(CreatePhuongTienDto) + { trangThai?: boolean }`.
### Response
- `PhuongTienResponseDto { id; bienSo; loaiPhuongTien; isXeLanh; trangThai; createdAt; updatedAt }`.
### Query
- `QueryPhuongTienDto extends PaginationQueryDto { isXeLanh?: boolean; trangThai?: boolean }`; `q` trên `bienSo`, `loaiPhuongTien`; sort `bienSo`, `createdAt`; mặc định `bienSo:asc`.

## 7. Business rules
- BR-01: Biển số lưu dạng chuẩn hóa (ví dụ nhập `51C-123.45` → `51C12345`); hiển thị lại theo dạng lưu.
- BR-02: Biển số duy nhất sau chuẩn hóa.
- BR-03: Phương tiện ngừng sử dụng không chọn được cho phiếu mới (`PHUONG_TIEN_INACTIVE`) nhưng giữ nguyên trên phiếu cũ.
- BR-04: Phiếu nhập có dòng hàng `isCanGiuLanh` mà chọn phương tiện không phải xe lạnh ⇒ `PHUONG_TIEN_NOT_COLD`. Phiếu **không** chọn phương tiện thì không bị ràng buộc (phương tiện tùy chọn).
- BR-05: Chỉ xóa được phương tiện chưa gắn với phiếu nào (`PHUONG_TIEN_IN_USE`).
- BR-06: Bỏ cờ `isXeLanh` không ảnh hưởng phiếu đã xác nhận.

## 8. Error cases
| Mã lỗi | HTTP | Khi nào | Message (VN) |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | biển số sai định dạng | Dữ liệu gửi lên không hợp lệ |
| `PHUONG_TIEN_NOT_FOUND` | 404 | id không tồn tại | Không tìm thấy phương tiện |
| `PHUONG_TIEN_PLATE_TAKEN` | 409 | trùng biển số | Biển số đã tồn tại |
| `PHUONG_TIEN_NOT_COLD` | 422 | hàng lạnh trên xe thường | Phương tiện không phải xe lạnh nên không thể chở hàng cần bảo quản lạnh |
| `PHUONG_TIEN_INACTIVE` | 422 | chọn phương tiện đã ngừng | Phương tiện đã ngừng sử dụng |
| `PHUONG_TIEN_IN_USE` | 409 | xóa phương tiện đã gắn phiếu | Phương tiện đã được sử dụng nên không thể xóa, hãy chuyển sang ngừng sử dụng |
| `AUTH_FORBIDDEN` | 403 | thiếu quyền | Bạn không có quyền truy cập |

## 9. Service layer design
`PhuongTienService`:
- `findAll(query: QueryPhuongTienDto)`, `findOne(id)`, `create(dto, actor)`, `update(id, dto, actor)`, `remove(id)`.
- `normalizePlate(input: string): string` — hàm thuần (export để DTO validator dùng chung).
- `assertUsable(id: string, options: { requireCold: boolean }, tx?): Promise<PhuongTienVanChuyen>` — tồn tại, hoạt động, và nếu `requireCold` thì phải `isXeLanh`. Dùng bởi phiếu nhập/xuất.

Transaction: không cần (một bảng). Side effects: không.

## 10. Controller layer
- 1–1 với service. Guards: `GET` mọi role; `POST/PATCH` `@Roles(ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO)`; `DELETE` `@Roles(ADMIN)`.

## 11. File layout
```
src/phuong-tien-van-chuyen/
  phuong-tien-van-chuyen.module.ts
  phuong-tien-van-chuyen.controller.ts
  phuong-tien-van-chuyen.service.ts
  phuong-tien-van-chuyen.service.spec.ts
  phuong-tien-van-chuyen.controller.spec.ts
  plate.ts                       # normalizePlate + spec
  dto/
    create-phuong-tien.dto.ts
    update-phuong-tien.dto.ts
    query-phuong-tien.dto.ts
    phuong-tien-response.dto.ts
```

## 12. Test plan
### Unit tests
- `normalizePlate() — "51c-123.45" → "51C12345"; có khoảng trắng; chuỗi rỗng → lỗi`
- `create() — biển số hợp lệ → lưu dạng chuẩn hóa, isXeLanh mặc định false`
- `create() — "51C-123.45" và "51c 12345" cùng biển → PHUONG_TIEN_PLATE_TAKEN ở lần hai`
- `create() — biển số sai định dạng → VALIDATION_FAILED`
- `update() — đổi biển số sang biển đã có → PHUONG_TIEN_PLATE_TAKEN`
- `update() — bật isXeLanh / tắt trangThai → OK`
- `findAll() — lọc isXeLanh, trangThai, q`
- `findOne() — không tồn tại → PHUONG_TIEN_NOT_FOUND`
- `remove() — chưa gắn phiếu → xóa; đã gắn → PHUONG_TIEN_IN_USE`
- `assertUsable() — xe thường, requireCold=false → OK`
- `assertUsable() — xe thường, requireCold=true → PHUONG_TIEN_NOT_COLD`
- `assertUsable() — xe lạnh, requireCold=true → OK`
- `assertUsable() — ngừng sử dụng → PHUONG_TIEN_INACTIVE`
### E2E tests
- Tạo xe thường và xe lạnh; lọc `isXeLanh=true`.
- Biển số trùng sau chuẩn hóa → 409.
- Lập phiếu nhập hàng lạnh với xe thường → 422 `PHUONG_TIEN_NOT_COLD` (kiểm ở e2e phiếu nhập).
- Xóa xe đã gắn phiếu → 409.
- Ma trận role: `KE_TOAN` `POST` → 403; `NHAN_VIEN_KHO` `POST` → 201, `DELETE` → 403.

## 13. Permissions
| Action | ADMIN | QUAN_LY_KHO | NHAN_VIEN_KHO | KE_TOAN |
|---|---|---|---|---|
| list / read | ✓ | ✓ | ✓ | ✓ |
| create / update | ✓ | ✓ | ✓ | ✗ |
| delete | ✓ | ✗ | ✗ | ✗ |

## 14. Open questions
- **Q-PT-1**: Phương tiện vận chuyển của công ty hay của nhà cung cấp/đơn vị vận chuyển thuê ngoài? (ảnh hưởng việc lưu tài xế, chủ xe).
- **Q-PT-2**: Giao hàng cho khách có dùng xe của công ty và cần ghi nhận xe/tài xế trên phiếu xuất không (P-09)?
- **Q-PT-3**: Định dạng biển số thực tế (xe máy, biển tạm, biển nước ngoài) có ngoài mẫu `\d{2}[A-Z]{1,2}\d{4,6}` không?
- **Q-PT-4**: Có cần theo dõi nhiệt độ khi vận chuyển hàng lạnh (nhập tay nhiệt độ lúc nhận hàng)?
