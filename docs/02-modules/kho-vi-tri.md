# Module: kho-vi-tri

Gộp hai tài nguyên `Kho` và `ViTri` vào một module (`src/kho-vi-tri/`) vì ViTri không có nghĩa độc lập và luôn thuộc một Kho.

## 1. Mục đích
- Mô hình hóa cấu trúc kho vật lý: kho → vị trí lưu trữ (kệ, ô, phòng lạnh). Vị trí đánh dấu được loại cấp đông/bảo quản lạnh để kiểm soát chuỗi lạnh.
- Actors: `ADMIN`, `QUAN_LY_KHO` (quản lý); mọi role đọc.

## 2. Scope
### In scope
- CRUD `Kho` và `ViTri`; vô hiệu hóa; cờ `isCapDong`; chỉ số "có tồn" để UI cảnh báo.
### Out of scope (phase 2)
- Sơ đồ kho 2D/3D, sức chứa tối đa của vị trí, điều kiện nhiệt độ/độ ẩm theo vị trí, lịch sử nhiệt độ cảm biến, phân vùng (zone) nhiều tầng.

## 3. Dependencies
- Cần có trước: `auth`, `prisma`, `audit`.
- Được dùng bởi: [ton-kho.md](ton-kho.md), [phieu-nhap-hang.md](phieu-nhap-hang.md), [phieu-xuat-hang.md](phieu-xuat-hang.md).
- Thư viện ngoài: không thêm.

## 4. Data model
- Model: `Kho` (`tenKho`, `diaChi`), `ViTri` (`tenViTri`, `isCapDong`, `ghiChu`, `khoId`).
- Quy tắc trường:
  - `Kho.tenKho` 1–100 ký tự, unique không phân biệt hoa/thường (P-04); `diaChi` ≤ 255.
  - `ViTri.tenViTri` 1–50 ký tự, unique **trong cùng kho** (P-04); `ghiChu` ≤ 255; `isCapDong` mặc định `false`.
  - `trangThai` cho cả hai (P-03), mặc định `true`.
- Đề xuất: P-02, P-03, P-04; index `ViTri(khoId)` (đã có nhờ FK).

## 5. API endpoints
| Method | Path | Auth | Roles | Mô tả ngắn | DTO request | DTO response |
|---|---|---|---|---|---|---|
| GET | `/api/v1/kho` | JWT | mọi role | Danh sách kho | `QueryKhoDto` | `PagedResponse<KhoResponseDto>` |
| GET | `/api/v1/kho/:id` | JWT | mọi role | Chi tiết kho | — | `KhoResponseDto` |
| POST | `/api/v1/kho` | JWT | ADMIN, QUAN_LY_KHO | Tạo kho | `CreateKhoDto` | `KhoResponseDto` (201) |
| PATCH | `/api/v1/kho/:id` | JWT | ADMIN, QUAN_LY_KHO | Sửa / vô hiệu hóa kho | `UpdateKhoDto` | `KhoResponseDto` |
| DELETE | `/api/v1/kho/:id` | JWT | ADMIN | Xóa kho rỗng | — | 204 |
| GET | `/api/v1/vi-tri` | JWT | mọi role | Danh sách vị trí | `QueryViTriDto` | `PagedResponse<ViTriResponseDto>` |
| GET | `/api/v1/vi-tri/:id` | JWT | mọi role | Chi tiết vị trí | — | `ViTriResponseDto` |
| POST | `/api/v1/vi-tri` | JWT | ADMIN, QUAN_LY_KHO | Tạo vị trí trong kho | `CreateViTriDto` | `ViTriResponseDto` (201) |
| PATCH | `/api/v1/vi-tri/:id` | JWT | ADMIN, QUAN_LY_KHO | Sửa / vô hiệu hóa vị trí | `UpdateViTriDto` | `ViTriResponseDto` |
| DELETE | `/api/v1/vi-tri/:id` | JWT | ADMIN | Xóa vị trí chưa từng phát sinh | — | 204 |

## 6. DTOs
### Request
- `CreateKhoDto { tenKho: string; diaChi?: string | null }`; `UpdateKhoDto = PartialType(CreateKhoDto) + { trangThai?: boolean }`.
- `CreateViTriDto { khoId: string; tenViTri: string; isCapDong?: boolean; ghiChu?: string | null }`; `UpdateViTriDto = PartialType(OmitType(CreateViTriDto, ['khoId'])) + { trangThai?: boolean }` (không chuyển vị trí sang kho khác).
### Response
- `KhoResponseDto { id; tenKho; diaChi; trangThai; soViTri: number; coTon: boolean; createdAt; updatedAt }`.
- `ViTriResponseDto { id; tenViTri; isCapDong; ghiChu; trangThai; kho: { id; tenKho }; coTon: boolean; createdAt; updatedAt }` (`coTon` = có dòng `TonKho.soLuong > 0`).
### Query
- `QueryKhoDto extends PaginationQueryDto { trangThai?: boolean }`; `q` trên `tenKho`, `diaChi`; sort `tenKho`, `createdAt`; mặc định `tenKho:asc`.
- `QueryViTriDto extends PaginationQueryDto { khoId?: uuid; isCapDong?: boolean; trangThai?: boolean }`; `q` trên `tenViTri`, `ghiChu`; sort `tenViTri`, `createdAt`; mặc định `tenViTri:asc`.

## 7. Business rules
- BR-01: Tên kho duy nhất; tên vị trí duy nhất trong kho (không phân biệt hoa/thường, sau trim).
- BR-02: Vị trí phải thuộc kho đang hoạt động khi tạo.
- BR-03: Không xóa kho còn vị trí (`KHO_HAS_VI_TRI`); không xóa vị trí đã từng có dòng `TonKho`, `BienDongTonKho` hoặc dòng chứng từ (`VI_TRI_IN_USE`) — chỉ vô hiệu hóa.
- BR-04: Vô hiệu hóa vị trí khi còn tồn (`soLuong > 0`) bị chặn (`VI_TRI_HAS_STOCK`): phải chuyển/xuất hết hàng trước. Vô hiệu hóa kho khi còn vị trí đang có tồn bị chặn (`KHO_IN_USE`).
- BR-05: Vị trí vô hiệu hóa **không nhận hàng mới** (nhập, chuyển đến; `VI_TRI_INACTIVE`) nhưng vẫn xuất được tồn còn lại.
- BR-06: Đổi `isCapDong` từ `true` sang `false` bị chặn khi vị trí đang chứa hàng `isCanGiuLanh` có tồn (`VI_TRI_COLD_CONFLICT`). Đổi `false → true` luôn được.
- BR-07: Tên kho đổi được tự do; không có mã kho nên không ảnh hưởng chứng từ (chứng từ tham chiếu bằng id).
- BR-08: `ViTri` không chuyển sang kho khác (nếu cần: tạo vị trí mới và chuyển hàng).

## 8. Error cases
| Mã lỗi | HTTP | Khi nào | Message (VN) |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | DTO sai | Dữ liệu gửi lên không hợp lệ |
| `KHO_NOT_FOUND` | 404 | kho không tồn tại | Không tìm thấy kho |
| `KHO_NAME_TAKEN` | 409 | trùng tên kho | Tên kho đã tồn tại |
| `KHO_HAS_VI_TRI` | 409 | xóa kho còn vị trí | Kho còn vị trí lưu trữ, hãy xóa hoặc chuyển các vị trí trước |
| `KHO_IN_USE` | 409 | vô hiệu hóa kho còn tồn | Kho đang còn hàng tồn nên không thể vô hiệu hóa |
| `VI_TRI_NOT_FOUND` | 404 | vị trí không tồn tại | Không tìm thấy vị trí |
| `VI_TRI_NAME_TAKEN` | 409 | trùng tên trong kho | Tên vị trí đã tồn tại trong kho này |
| `VI_TRI_HAS_STOCK` | 409 | vô hiệu hóa vị trí còn tồn | Vị trí còn hàng tồn, hãy chuyển hoặc xuất hết hàng trước |
| `VI_TRI_COLD_CONFLICT` | 409 | bỏ cờ cấp đông khi còn hàng cần giữ lạnh | Vị trí đang chứa hàng cần bảo quản lạnh nên không thể bỏ thuộc tính cấp đông |
| `VI_TRI_INACTIVE` | 422 | dùng vị trí đã vô hiệu hóa để nhận hàng | Vị trí đã ngừng sử dụng |
| `VI_TRI_IN_USE` | 409 | xóa vị trí đã phát sinh | Vị trí đã phát sinh dữ liệu nên không thể xóa, hãy vô hiệu hóa |
| `AUTH_FORBIDDEN` | 403 | thiếu quyền | Bạn không có quyền truy cập |

## 9. Service layer design
`KhoService`:
- `findAll(query: QueryKhoDto)`, `findOne(id)`, `create(dto, actor)`, `update(id, dto, actor)`, `remove(id)`.
`ViTriService`:
- `findAll(query: QueryViTriDto)`, `findOne(id)`, `create(dto, actor)`, `update(id, dto, actor)`, `remove(id)`.
- `assertReceivable(viTriId: string, tx?): Promise<ViTri & { kho: Kho }>` — vị trí tồn tại, `trangThai` hoạt động, kho hoạt động; ném `VI_TRI_NOT_FOUND`/`VI_TRI_INACTIVE`. Dùng bởi `ton-kho` và phiếu nhập.
- `findByIdOrThrow(id: string, tx?): Promise<ViTri>` — cho phiếu xuất/chuyển.

Transaction: `update` khi đổi `isCapDong`/`trangThai` (đếm tồn + cập nhật cùng transaction); `remove`. Side effects: `AuditService` cho vô hiệu hóa và đổi `isCapDong` (`vi_tri.update`).

## 10. Controller layer
- Hai controller `KhoController`, `ViTriController` trong cùng module.
- Guards: `GET` mọi role; `POST/PATCH` `@Roles(ADMIN, QUAN_LY_KHO)`; `DELETE` `@Roles(ADMIN)`.

## 11. File layout
```
src/kho-vi-tri/
  kho-vi-tri.module.ts
  kho.controller.ts
  kho.service.ts
  kho.service.spec.ts
  vi-tri.controller.ts
  vi-tri.service.ts
  vi-tri.service.spec.ts
  kho-vi-tri.mapper.ts
  dto/
    create-kho.dto.ts
    update-kho.dto.ts
    query-kho.dto.ts
    kho-response.dto.ts
    create-vi-tri.dto.ts
    update-vi-tri.dto.ts
    query-vi-tri.dto.ts
    vi-tri-response.dto.ts
```

## 12. Test plan
### Unit tests
- `KhoService.create() — tên mới → tạo; tên trùng khác hoa/thường → KHO_NAME_TAKEN`
- `KhoService.findOne() — kèm soViTri và coTon đúng`
- `KhoService.update() — đổi tên/địa chỉ → OK`
- `KhoService.update() — vô hiệu hóa kho không có tồn → OK`
- `KhoService.update() — vô hiệu hóa kho còn tồn → KHO_IN_USE`
- `KhoService.remove() — kho rỗng → xóa; còn vị trí → KHO_HAS_VI_TRI`
- `KhoService.findAll() — lọc trangThai, q, phân trang`
- `ViTriService.create() — kho hoạt động → tạo; kho không tồn tại → KHO_NOT_FOUND`
- `ViTriService.create() — kho bị vô hiệu hóa → VI_TRI_INACTIVE`
- `ViTriService.create() — trùng tên trong cùng kho → VI_TRI_NAME_TAKEN; trùng tên ở kho khác → OK`
- `ViTriService.update() — đổi isCapDong false→true → OK`
- `ViTriService.update() — isCapDong true→false khi có hàng cần giữ lạnh → VI_TRI_COLD_CONFLICT`
- `ViTriService.update() — isCapDong true→false khi chỉ có hàng thường → OK`
- `ViTriService.update() — vô hiệu hóa khi còn tồn → VI_TRI_HAS_STOCK`
- `ViTriService.update() — gửi khoId → bị từ chối`
- `ViTriService.remove() — chưa từng phát sinh → xóa; đã có TonKho/biến động/dòng phiếu → VI_TRI_IN_USE`
- `ViTriService.assertReceivable() — hoạt động → trả vị trí; bị tắt hoặc kho bị tắt → VI_TRI_INACTIVE; không tồn tại → VI_TRI_NOT_FOUND`
- `ViTriService.findAll() — lọc khoId, isCapDong, trangThai, q`
- `mapper — coTon true khi có TonKho.soLuong > 0, false khi chỉ có dòng 0`
### E2E tests
- Tạo kho → thêm 3 vị trí (1 cấp đông) → `GET /vi-tri?khoId=` đúng 3 và lọc `isCapDong=true` ra 1.
- Trùng tên kho / tên vị trí trong kho → 409; cùng tên ở kho khác → 201.
- Có tồn ở vị trí (dựng bằng nhập hàng) → vô hiệu hóa 409; bỏ cờ cấp đông khi có hàng lạnh → 409.
- Xóa kho còn vị trí → 409; xóa vị trí chưa phát sinh → 204; đã phát sinh → 409.
- Ma trận role: `NHAN_VIEN_KHO`/`KE_TOAN` `POST/PATCH` → 403, `QUAN_LY_KHO` `DELETE` → 403.

## 13. Permissions
| Action | ADMIN | QUAN_LY_KHO | NHAN_VIEN_KHO | KE_TOAN |
|---|---|---|---|---|
| list / read (kho, vị trí) | ✓ | ✓ | ✓ | ✓ |
| create / update | ✓ | ✓ | ✗ | ✗ |
| delete | ✓ | ✗ | ✗ | ✗ |

## 14. Open questions
- **Q-KHO-1**: Hiện có mấy kho, mỗi kho có bao nhiêu vị trí và quy ước đặt tên vị trí (ví dụ `A-01-03` = dãy–kệ–ô)? Có cần thêm cấp "khu/dãy" giữa kho và vị trí?
- **Q-KHO-2**: Có cần mã kho (ví dụ `K01`) để in phiếu không?
- **Q-KHO-3**: Có cần kho "hàng hủy / biệt trữ / chờ kiểm" (quarantine, hàng trả về) tách riêng khỏi kho bán hàng không?
- **Q-KHO-4**: Có cần giới hạn sức chứa vị trí và cảnh báo vượt?
