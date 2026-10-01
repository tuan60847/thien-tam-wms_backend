# Module: ty-le-quy-doi

## 1. Mục đích
- Quản lý các đơn vị tính của một hàng hóa và hệ số quy đổi về đơn vị cơ bản (ví dụ viên = 1, vỉ = 10, hộp = 100) để nhập/xuất theo hộp/vỉ nhưng tồn kho luôn tính theo đơn vị cơ bản.
- Actors: `ADMIN`, `QUAN_LY_KHO` (quản lý); mọi role đọc.

## 2. Scope
### In scope
- Liệt kê, thêm, sửa, xóa đơn vị của một hàng (route lồng dưới hàng hóa).
- Hàm quy đổi dùng chung: `toBaseQuantity`, `resolveUnit` cho phiếu nhập/xuất.
### Out of scope (phase 2)
- Đơn vị mặc định cho nhập / cho xuất riêng, quy đổi nhiều tầng tự động (hộp → thùng), đơn vị dùng chung giữa các hàng (danh mục đơn vị toàn cục).

## 3. Dependencies
- Cần có trước: [hang-hoa.md](hang-hoa.md). Đơn vị cơ bản được tạo cùng lúc tạo hàng.
- Được dùng bởi: [phieu-nhap-hang.md](phieu-nhap-hang.md), [phieu-xuat-hang.md](phieu-xuat-hang.md), [ton-kho.md](ton-kho.md).
- Thư viện ngoài: không thêm.

## 4. Data model
- Model: `TyLeQuyDoi` (`donViTinh`, `soLuongQuyDoi`, `hangHoaId`).
- Quy tắc trường: `donViTinh` 1–30 ký tự (trim), unique trong một hàng (không phân biệt hoa/thường); `soLuongQuyDoi` `Int ≥ 1`; đúng một dòng `soLuongQuyDoi = 1` mỗi hàng (đơn vị cơ bản).
- Đề xuất: P-04 (`@@unique([hangHoaId, donViTinh])`), P-02 (`createdAt/updatedAt`), P-18 (`CHECK so_luong_quy_doi >= 1`).
- Khái niệm "bị khóa": hàng hóa **đã có số lô** (`SoLo`) ⇒ không được đổi `donViTinh` hay `soLuongQuyDoi`.

## 5. API endpoints
| Method | Path | Auth | Roles | Mô tả ngắn | DTO request | DTO response |
|---|---|---|---|---|---|---|
| GET | `/api/v1/hang-hoa/:hangHoaId/ty-le-quy-doi` | JWT | mọi role | Danh sách đơn vị của hàng | `QueryTyLeQuyDoiDto` | `PagedResponse<TyLeQuyDoiResponseDto>` |
| GET | `/api/v1/hang-hoa/:hangHoaId/ty-le-quy-doi/:id` | JWT | mọi role | Chi tiết một đơn vị | — | `TyLeQuyDoiResponseDto` |
| POST | `/api/v1/hang-hoa/:hangHoaId/ty-le-quy-doi` | JWT | ADMIN, QUAN_LY_KHO | Thêm đơn vị quy đổi | `CreateTyLeQuyDoiDto` | `TyLeQuyDoiResponseDto` (201) |
| PATCH | `/api/v1/hang-hoa/:hangHoaId/ty-le-quy-doi/:id` | JWT | ADMIN, QUAN_LY_KHO | Sửa tên/hệ số | `UpdateTyLeQuyDoiDto` | `TyLeQuyDoiResponseDto` |
| DELETE | `/api/v1/hang-hoa/:hangHoaId/ty-le-quy-doi/:id` | JWT | ADMIN | Xóa đơn vị (không phải cơ bản) | — | 204 |

## 6. DTOs
### Request
- `CreateTyLeQuyDoiDto { donViTinh: string; soLuongQuyDoi: number }` — `donViTinh` `@IsNotEmpty @MaxLength(30)` trim; `soLuongQuyDoi` `@IsInt @Min(2) @Max(1000000)` (đơn vị cơ bản chỉ được tạo cùng hàng).
- `UpdateTyLeQuyDoiDto = PartialType(CreateTyLeQuyDoiDto)`.
### Response
- `TyLeQuyDoiResponseDto { id; hangHoaId; donViTinh; soLuongQuyDoi; laDonViCoBan: boolean; laDonViTinhGia: boolean }`.
### Query
- `QueryTyLeQuyDoiDto extends PaginationQueryDto` (không lọc thêm); mặc định `pageSize = 50`; sort whitelist `soLuongQuyDoi`, `donViTinh`; mặc định `soLuongQuyDoi:asc`.

## 7. Business rules
- BR-01: Mỗi hàng có **đúng một** đơn vị cơ bản (hệ số 1). Các đơn vị khác có hệ số ≥ 2.
- BR-02: Tên đơn vị duy nhất trong một hàng (không phân biệt hoa/thường, sau trim).
- BR-03: Đơn vị cơ bản không xóa, không đổi hệ số (`TY_LE_QUY_DOI_BASE_IMMUTABLE`); đổi tên đơn vị cơ bản chỉ khi hàng chưa bị khóa.
- BR-04: **Khóa theo lô:** khi hàng đã có `SoLo`, không đổi `donViTinh`/`soLuongQuyDoi` của bất kỳ đơn vị nào (`TY_LE_QUY_DOI_LOCKED`). Lý do: dòng phiếu lưu snapshot nhưng bản nháp tham chiếu tên đơn vị hiện tại; đổi sẽ làm bản nháp mơ hồ.
- BR-05: Xóa đơn vị khác cơ bản: không được xóa nếu là `donViTinhGia` của hàng hoặc đang được dòng chi tiết phiếu **nháp** tham chiếu (`TY_LE_QUY_DOI_IN_USE`). Đơn vị chỉ xuất hiện trong phiếu đã xác nhận (snapshot) thì xóa được.
- BR-06: Quy đổi: `soLuongCoBan = soLuong × soLuongQuyDoi` (số nguyên); tràn `Int` (> 2.147.483.647) → `VALIDATION_FAILED`.
- BR-07: Đổi hệ số trước khi hàng bị khóa **không** ảnh hưởng chứng từ vì chưa có chứng từ; sau khi khóa không thể đổi.
- BR-08: Ghi `NhatKyHeThong` khi sửa/xóa đơn vị (`ty_le_quy_doi.update/delete`).

## 8. Error cases
| Mã lỗi | HTTP | Khi nào | Message (VN) |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | DTO sai | Dữ liệu gửi lên không hợp lệ |
| `HANG_HOA_NOT_FOUND` | 404 | hàng không tồn tại | Không tìm thấy hàng hóa |
| `TY_LE_QUY_DOI_NOT_FOUND` | 404 | đơn vị không tồn tại hoặc không thuộc hàng | Không tìm thấy đơn vị tính |
| `TY_LE_QUY_DOI_UNIT_TAKEN` | 409 | trùng tên đơn vị | Đơn vị tính đã tồn tại cho hàng hóa này |
| `TY_LE_QUY_DOI_BASE_REQUIRED` | 422 | tạo/sửa thành đơn vị có hệ số 1 khi đã có đơn vị cơ bản | Mỗi hàng hóa chỉ có một đơn vị cơ bản, các đơn vị khác phải có hệ số quy đổi lớn hơn 1 |
| `TY_LE_QUY_DOI_BASE_IMMUTABLE` | 409 | xóa / đổi hệ số đơn vị cơ bản | Không thể xóa hoặc thay đổi hệ số của đơn vị cơ bản |
| `TY_LE_QUY_DOI_LOCKED` | 409 | hàng đã có số lô mà đổi tên/hệ số | Hàng hóa đã phát sinh lô nên không thể đổi tên hoặc hệ số đơn vị |
| `TY_LE_QUY_DOI_IN_USE` | 409 | xóa đơn vị đang là đơn vị tính giá hoặc đang nằm trong phiếu nháp | Đơn vị tính đang được sử dụng nên không thể xóa |
| `AUTH_FORBIDDEN` | 403 | thiếu quyền | Bạn không có quyền truy cập |

## 9. Service layer design
`TyLeQuyDoiService`:
- `findAll(hangHoaId: string, query: QueryTyLeQuyDoiDto): Promise<PagedResponse<TyLeQuyDoiResponseDto>>`
- `findOne(hangHoaId: string, id: string): Promise<TyLeQuyDoiResponseDto>`
- `create(hangHoaId: string, dto: CreateTyLeQuyDoiDto, actor: AuthenticatedUser): Promise<TyLeQuyDoiResponseDto>`
- `update(hangHoaId: string, id: string, dto: UpdateTyLeQuyDoiDto, actor: AuthenticatedUser): Promise<TyLeQuyDoiResponseDto>`
- `remove(hangHoaId: string, id: string, actor: AuthenticatedUser): Promise<void>`
- `createBaseAndOthers(hangHoaId: string, base: string, others: UnitInput[], tx: Prisma.TransactionClient): Promise<TyLeQuyDoi[]>` — dùng bởi `hang-hoa.create`.
- `resolveUnit(hangHoaId: string, donViTinh: string, tx?): Promise<{ donViTinh: string; heSoQuyDoi: number }>` — tra đơn vị theo tên không phân biệt hoa/thường, ném `PHIEU_*_UNIT_INVALID` do nơi gọi bắt; dùng bởi phiếu nhập/xuất.
- `toBaseQuantity(soLuong: number, heSoQuyDoi: number): number` — hàm thuần, kiểm tràn.
- `isLocked(hangHoaId: string, tx?): Promise<boolean>` — hàng đã có `SoLo`.

Transaction: `create/update/remove` kiểm tra khóa + thay đổi + nhật ký trong một `$transaction`. Side effects: `AuditService`.

## 10. Controller layer
- 1–1 với service. Guards: `GET` mọi role; `POST/PATCH` `@Roles(ADMIN, QUAN_LY_KHO)`; `DELETE` `@Roles(ADMIN)`.
- `hangHoaId` và `id` đều `ParseUUIDPipe`; service kiểm `id` thuộc `hangHoaId`.

## 11. File layout
```
src/ty-le-quy-doi/
  ty-le-quy-doi.module.ts
  ty-le-quy-doi.controller.ts
  ty-le-quy-doi.service.ts
  ty-le-quy-doi.service.spec.ts
  ty-le-quy-doi.controller.spec.ts
  ty-le-quy-doi.mapper.ts
  unit-conversion.ts               # toBaseQuantity (hàm thuần) + spec
  dto/
    create-ty-le-quy-doi.dto.ts
    update-ty-le-quy-doi.dto.ts
    query-ty-le-quy-doi.dto.ts
    ty-le-quy-doi-response.dto.ts
```

## 12. Test plan
### Unit tests
- `findAll() — trả đơn vị sắp theo hệ số tăng, đánh dấu laDonViCoBan và laDonViTinhGia`
- `findOne() — id không thuộc hàng → TY_LE_QUY_DOI_NOT_FOUND`
- `create() — hộp = 100 cho hàng chưa khóa → tạo`
- `create() — trùng tên (khác hoa/thường) → TY_LE_QUY_DOI_UNIT_TAKEN`
- `create() — hệ số 1 khi đã có đơn vị cơ bản → TY_LE_QUY_DOI_BASE_REQUIRED`
- `create() — hệ số 0, âm, thập phân → VALIDATION_FAILED`
- `create() — hàng không tồn tại → HANG_HOA_NOT_FOUND`
- `create() — hàng đã có lô → vẫn thêm được đơn vị mới (thêm không phá dữ liệu cũ)`
- `update() — hàng chưa khóa, đổi hệ số → OK, ghi nhật ký`
- `update() — hàng đã khóa, đổi hệ số hoặc tên → TY_LE_QUY_DOI_LOCKED`
- `update() — đổi hệ số đơn vị cơ bản → TY_LE_QUY_DOI_BASE_IMMUTABLE`
- `update() — đổi tên sang tên đã tồn tại → TY_LE_QUY_DOI_UNIT_TAKEN`
- `remove() — đơn vị thường, không dùng → xóa`
- `remove() — đơn vị cơ bản → TY_LE_QUY_DOI_BASE_IMMUTABLE`
- `remove() — là donViTinhGia → TY_LE_QUY_DOI_IN_USE`
- `remove() — nằm trong dòng phiếu nháp → TY_LE_QUY_DOI_IN_USE`
- `remove() — chỉ xuất hiện trong phiếu đã xác nhận → xóa được`
- `createBaseAndOthers() — tạo đúng một đơn vị hệ số 1 và các đơn vị còn lại`
- `resolveUnit() — tên không phân biệt hoa/thường → trả hệ số; tên lạ → null/ném lỗi`
- `toBaseQuantity() — 3 hộp × 100 = 300; tràn Int → lỗi; số lượng 0/âm → lỗi`
- `isLocked() — có SoLo → true; không → false`
### E2E tests
- Tạo hàng (viên) → thêm vỉ=10, hộp=100 → `GET` danh sách đúng thứ tự.
- Thêm trùng tên → 409; thêm hệ số 1 → 422.
- Tạo lô cho hàng → sửa hệ số → 409 `TY_LE_QUY_DOI_LOCKED`; xóa đơn vị cơ bản → 409.
- Xóa `donViTinhGia` → 409; xóa đơn vị phụ không dùng → 204.
- Ma trận role: `NHAN_VIEN_KHO` `POST` → 403; `QUAN_LY_KHO` `DELETE` → 403.

## 13. Permissions
| Action | ADMIN | QUAN_LY_KHO | NHAN_VIEN_KHO | KE_TOAN |
|---|---|---|---|---|
| list / read | ✓ | ✓ | ✓ | ✓ |
| create / update | ✓ | ✓ | ✗ | ✗ |
| delete | ✓ | ✗ | ✗ | ✗ |

## 14. Open questions
- **Q-TLQD-1**: Có hàng nào có đơn vị không chia hết (ví dụ vỉ = 10, hộp = 25 viên)? Đề xuất không bắt buộc chia hết giữa các đơn vị.
- **Q-TLQD-2**: Có cần cho phép bán lẻ theo đơn vị cơ bản (lẻ viên) hay chỉ nguyên hộp/vỉ? (ảnh hưởng đến việc có xuất thiếu nguyên đơn vị lớn hay không).
- **Q-TLQD-3**: Có cần đơn vị mặc định riêng cho nhập và cho xuất của từng hàng không?
