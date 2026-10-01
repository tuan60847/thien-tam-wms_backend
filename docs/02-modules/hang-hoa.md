# Module: hang-hoa

## 1. Mục đích
- Danh mục thuốc/hàng hóa kinh doanh: thông tin định danh, quy cách, giá, thuộc tính pháp lý (kê đơn, kiểm soát đặc biệt), yêu cầu bảo quản lạnh.
- Actors: `ADMIN`, `QUAN_LY_KHO` (quản lý); `NHAN_VIEN_KHO`, `KE_TOAN` (đọc; `NHAN_VIEN_KHO` không thấy giá nhập/giá tối thiểu).

## 2. Scope
### In scope
- CRUD hàng hóa; tạo kèm đơn vị cơ bản và các đơn vị quy đổi khác trong một lần gọi.
- Tìm kiếm/lọc theo loại, kê đơn, giữ lạnh, loại kiểm soát, trạng thái.
- Ngừng kinh doanh (`trangThai`), ghi nhật ký khi đổi giá.
- Chọn `donViTinhGia` (đơn vị mà ba mức giá tính theo).
### Out of scope (phase 2)
- Hoạt chất, nhà sản xuất, nước sản xuất, mã vạch (chờ Q-HH-3), ảnh sản phẩm (qua [file-upload.md](../03-cross-cutting/file-upload.md)), lịch sử giá có hiệu lực theo ngày, nhiều bảng giá theo nhóm khách.
- Import danh mục từ Excel.

## 3. Dependencies
- Cần có trước: [loai-hang.md](loai-hang.md); `CodeGeneratorService` (sinh `maSP`); `audit`.
- Đi cùng: [ty-le-quy-doi.md](ty-le-quy-doi.md) (cùng milestone M2, tạo chung khi tạo hàng).
- Được dùng bởi: `so-lo`, `ton-kho`, `phieu-nhap-hang`, `phieu-xuat-hang`, `bao-cao`.
- Thư viện ngoài: không thêm.

## 4. Data model
- Model: `HangHoa` (quan hệ `loaiHang`, `tyLeQuyDois`, `soLos`).
- Quy tắc trường:
  - `maSP` (**mới**, P-17): sinh `SP` + 5 số, unique, không sửa.
  - `tenSP`: 1–200 ký tự (trim); không unique (nhiều hàng cùng tên khác quy cách) — xem Q-HH-2.
  - `quyCach`: ≤ 200 (mô tả đóng gói, ví dụ "Hộp 10 vỉ × 10 viên").
  - `giaNhap`, `giaHienThi`, `giaToiThieu`: `Decimal(15,2)` ≥ 0, mặc định `0`; **tính theo `donViTinhGia`**.
  - `donViTinhGia` (**mới**, P-07): tên một đơn vị trong `TyLeQuyDoi` của hàng; mặc định = đơn vị cơ bản.
  - `isKeDon`, `isCanGiuLanh`: boolean, mặc định `false`.
  - `loaiKiemSoat`: enum `thuong | ke_don | kiem_soat_dac_biet` (P-01), mặc định `thuong` khi null.
  - `soDangKy`: ≤ 50; bắt buộc nếu `isKeDon` hoặc `loaiKiemSoat ≠ thuong` (xem Q-HH-4).
  - `trangThai` (**mới**, P-03): `true` = đang kinh doanh.
- Đề xuất schema: P-01, P-02, P-03, P-07, P-17, index `(loaiHangId)`, fulltext `tenSP` (cân nhắc).

## 5. API endpoints
| Method | Path | Auth | Roles | Mô tả ngắn | DTO request | DTO response |
|---|---|---|---|---|---|---|
| GET | `/api/v1/hang-hoa` | JWT | mọi role | Danh sách hàng hóa | `QueryHangHoaDto` | `PagedResponse<HangHoaListItemDto>` |
| GET | `/api/v1/hang-hoa/:id` | JWT | mọi role | Chi tiết kèm đơn vị quy đổi | — | `HangHoaResponseDto` |
| POST | `/api/v1/hang-hoa` | JWT | ADMIN, QUAN_LY_KHO | Tạo hàng hóa (kèm đơn vị) | `CreateHangHoaDto` | `HangHoaResponseDto` (201) |
| PATCH | `/api/v1/hang-hoa/:id` | JWT | ADMIN, QUAN_LY_KHO | Sửa thông tin / giá / ngừng KD | `UpdateHangHoaDto` | `HangHoaResponseDto` |
| DELETE | `/api/v1/hang-hoa/:id` | JWT | ADMIN | Xóa nếu chưa phát sinh | — | 204 |

Đơn vị quy đổi quản lý ở [ty-le-quy-doi.md](ty-le-quy-doi.md) (`/hang-hoa/:hangHoaId/ty-le-quy-doi`).

## 6. DTOs
### Request
- `CreateHangHoaDto`:
  - `tenSP: string` (`@IsNotEmpty @MaxLength(200)`, trim)
  - `loaiHangId: string` (`@IsUUID`)
  - `quyCach?: string | null` (`@MaxLength(200)`)
  - `donViCoBan: string` (`@IsNotEmpty @MaxLength(30)`, trim) — tạo `TyLeQuyDoi { donViTinh, soLuongQuyDoi: 1 }`
  - `cacDonViKhac?: { donViTinh: string; soLuongQuyDoi: number }[]` (`@ValidateNested`, tối đa 10; `soLuongQuyDoi` `@IsInt @Min(2)`; không trùng tên; không trùng tên đơn vị cơ bản)
  - `donViTinhGia?: string` (mặc định = `donViCoBan`; phải thuộc `{donViCoBan} ∪ cacDonViKhac`)
  - `giaNhap?`, `giaHienThi?`, `giaToiThieu?: string` (`@IsMoney`, mặc định `"0.00"`)
  - `isKeDon?`, `isCanGiuLanh?: boolean`
  - `loaiKiemSoat?: 'thuong' | 'ke_don' | 'kiem_soat_dac_biet'`
  - `soDangKy?: string | null` (`@MaxLength(50)`), `ghiChu?: string | null` (`@MaxLength(500)`)
- `UpdateHangHoaDto` = `PartialType(OmitType(CreateHangHoaDto, ['donViCoBan', 'cacDonViKhac']))` + `trangThai?: boolean`. Không có `maSP`.
### Response
- `HangHoaListItemDto { id; maSP; tenSP; quyCach; loaiHang: { id; tenLoaiHang }; donViCoBan: string; donViTinhGia: string; giaHienThi; giaNhap?; giaToiThieu?; isKeDon; isCanGiuLanh; loaiKiemSoat; trangThai }`.
- `HangHoaResponseDto` = list item + `{ soDangKy; ghiChu; tyLeQuyDoi: { id; donViTinh; soLuongQuyDoi }[]; createdAt; updatedAt }`.
- `giaNhap`, `giaToiThieu` **bị bỏ khỏi response** (không phải `null`) khi người xem là `NHAN_VIEN_KHO` (mapper theo role). Tiền là chuỗi.
### Query
- `QueryHangHoaDto extends PaginationQueryDto { loaiHangId?: uuid; isKeDon?: boolean; isCanGiuLanh?: boolean; loaiKiemSoat?: enum; trangThai?: boolean }`; `q` tìm trên `tenSP`, `maSP`, `soDangKy`; sort whitelist: `tenSP`, `maSP`, `giaHienThi`, `createdAt`; mặc định `tenSP:asc`.

## 7. Business rules
- BR-01: `giaToiThieu ≤ giaHienThi` (cả hai tính theo `donViTinhGia`). `giaNhap` không bị ràng buộc thứ tự nhưng cảnh báo nếu `giaNhap > giaToiThieu` ở báo cáo (không chặn).
- BR-02: `isKeDon = true ⇒ loaiKiemSoat ∈ {ke_don, kiem_soat_dac_biet}`. Ngược lại `loaiKiemSoat ≠ thuong ⇒ isKeDon` không bắt buộc (kiểm soát đặc biệt có thể quy định riêng).
- BR-03: `isKeDon` hoặc `loaiKiemSoat ≠ thuong` ⇒ `soDangKy` bắt buộc.
- BR-04: Mỗi hàng có **đúng một** đơn vị cơ bản (hệ số 1); tạo hàng tạo luôn đơn vị này trong cùng transaction.
- BR-05: `donViTinhGia` phải là một đơn vị của hàng. Khi đổi `donViTinhGia`, giá **không** tự quy đổi (người dùng nhập lại giá theo đơn vị mới); service chỉ kiểm tra đơn vị hợp lệ.
- BR-06: Loại hàng được chọn phải tồn tại và đang hoạt động (`LoaiHangService.assertUsable`).
- BR-07: Hàng `trangThai = false` (ngừng kinh doanh): không thêm được vào phiếu nhập mới (`HANG_HOA_INACTIVE`); vẫn xuất được lượng tồn còn lại (Q-HH-5); vẫn hiển thị ở tra cứu/báo cáo.
- BR-08: Đổi bất kỳ mức giá ⇒ ghi `NhatKyHeThong` `hang_hoa.price_change` (trước/sau); không ảnh hưởng chứng từ cũ (chứng từ đã lưu `donGia` riêng).
- BR-09: Chỉ xóa được hàng chưa từng phát sinh số lô (`SoLo`) nào; xóa kèm xóa các `TyLeQuyDoi` của hàng. Ngược lại `HANG_HOA_IN_USE` — khuyên ngừng kinh doanh.
- BR-10: `maSP` sinh tự động, không đổi.
- BR-11: `giaNhap` và `giaToiThieu` chỉ hiển thị cho `ADMIN`, `QUAN_LY_KHO`, `KE_TOAN`.

## 8. Error cases
| Mã lỗi | HTTP | Khi nào | Message (VN) |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | DTO sai | Dữ liệu gửi lên không hợp lệ |
| `HANG_HOA_NOT_FOUND` | 404 | id không tồn tại | Không tìm thấy hàng hóa |
| `LOAI_HANG_NOT_FOUND` | 404 | loại hàng không tồn tại / bị tắt | Không tìm thấy loại hàng |
| `HANG_HOA_CODE_TAKEN` | 409 | trùng `maSP` (hiếm; an toàn khi import) | Mã hàng hóa đã tồn tại |
| `HANG_HOA_PRICE_INVALID` | 422 | `giaToiThieu > giaHienThi` | Giá tối thiểu không được lớn hơn giá hiển thị |
| `HANG_HOA_CONTROL_TYPE_INVALID` | 422 | kê đơn nhưng loại kiểm soát "thường"; thiếu số đăng ký | Thuốc kê đơn/kiểm soát đặc biệt cần khai báo loại kiểm soát và số đăng ký |
| `HANG_HOA_PRICE_UNIT_INVALID` | 422 | `donViTinhGia` không thuộc đơn vị của hàng | Đơn vị tính giá không thuộc các đơn vị của hàng hóa |
| `HANG_HOA_INACTIVE` | 422 | dùng hàng ngừng kinh doanh vào phiếu nhập mới | Hàng hóa đã ngừng kinh doanh |
| `HANG_HOA_IN_USE` | 409 | xóa khi đã có số lô | Không thể xóa hàng hóa đã phát sinh lô, hãy chuyển sang ngừng kinh doanh |
| `TY_LE_QUY_DOI_UNIT_TAKEN` | 409 | trùng tên đơn vị khi tạo | Đơn vị tính đã tồn tại cho hàng hóa này |
| `AUTH_FORBIDDEN` | 403 | thiếu quyền | Bạn không có quyền truy cập |

## 9. Service layer design
`HangHoaService`:
- `findAll(query: QueryHangHoaDto, viewer: AuthenticatedUser): Promise<PagedResponse<HangHoaListItemDto>>`
- `findOne(id: string, viewer: AuthenticatedUser): Promise<HangHoaResponseDto>`
- `create(dto: CreateHangHoaDto, actor: AuthenticatedUser): Promise<HangHoaResponseDto>` — sinh `maSP`, tạo hàng + đơn vị cơ bản + đơn vị khác.
- `update(id: string, dto: UpdateHangHoaDto, actor: AuthenticatedUser): Promise<HangHoaResponseDto>` — kiểm quy tắc, ghi nhật ký nếu đổi giá.
- `remove(id: string, actor: AuthenticatedUser): Promise<void>`
- `findByIdOrThrow(id: string, tx?: Prisma.TransactionClient): Promise<HangHoaWithUnits>` — dùng bởi `so-lo`, phiếu.
- `assertSellable/assertReceivable(hangHoa: HangHoa): void` — chặn nhập hàng ngừng KD.

Transaction: `create` (mã + hàng + đơn vị), `update` khi đổi giá (cập nhật + nhật ký), `remove` (đếm lô + xóa đơn vị + xóa hàng). Side effects: `AuditService`, `CodeGeneratorService('SP')`.

## 10. Controller layer
- 1–1 với service; `@CurrentUser()` truyền `viewer/actor`.
- Guards: `GET` mọi role; `POST/PATCH` `@Roles(ADMIN, QUAN_LY_KHO)`; `DELETE` `@Roles(ADMIN)`.
- Mapper nhận `viewer.role` để lọc `giaNhap`/`giaToiThieu`.

## 11. File layout
```
src/hang-hoa/
  hang-hoa.module.ts
  hang-hoa.controller.ts
  hang-hoa.service.ts
  hang-hoa.service.spec.ts
  hang-hoa.controller.spec.ts
  hang-hoa.mapper.ts
  hang-hoa.rules.ts                  # hàm thuần: assertPriceOrder, assertControlType…
  hang-hoa.rules.spec.ts
  hang-hoa.constants.ts
  dto/
    create-hang-hoa.dto.ts
    update-hang-hoa.dto.ts
    query-hang-hoa.dto.ts
    hang-hoa-response.dto.ts
```

## 12. Test plan
### Unit tests
- `create() — dữ liệu đủ → sinh maSP SP00001, tạo đơn vị cơ bản (hệ số 1) và các đơn vị khác`
- `create() — hai lần liên tiếp → maSP tăng dần`
- `create() — donViTinhGia không truyền → mặc định đơn vị cơ bản`
- `create() — donViTinhGia ngoài các đơn vị → HANG_HOA_PRICE_UNIT_INVALID`
- `create() — cacDonViKhac trùng tên → TY_LE_QUY_DOI_UNIT_TAKEN`
- `create() — cacDonViKhac có hệ số < 2 → VALIDATION_FAILED`
- `create() — giaToiThieu > giaHienThi → HANG_HOA_PRICE_INVALID`
- `create() — isKeDon + loaiKiemSoat thuong → HANG_HOA_CONTROL_TYPE_INVALID`
- `create() — kê đơn thiếu soDangKy → HANG_HOA_CONTROL_TYPE_INVALID`
- `create() — loaiHangId không tồn tại hoặc bị tắt → LOAI_HANG_NOT_FOUND`
- `create() — lỗi giữa chừng khi tạo đơn vị → không còn hàng mồ côi (rollback)`
- `findAll() — lọc isCanGiuLanh, isKeDon, loaiHangId, trangThai, q (tenSP/maSP/soDangKy)`
- `findAll() — viewer NHAN_VIEN_KHO → item không có giaNhap, giaToiThieu`
- `findAll() — viewer KE_TOAN/QUAN_LY_KHO → có đủ giá`
- `findOne() — không tồn tại → HANG_HOA_NOT_FOUND`
- `findOne() — kèm danh sách đơn vị sắp theo hệ số tăng`
- `update() — đổi giá → ghi nhật ký price_change với trước/sau`
- `update() — không đổi giá → không ghi nhật ký`
- `update() — chỉ đổi giaToiThieu vượt giaHienThi hiện tại → HANG_HOA_PRICE_INVALID`
- `update() — đổi donViTinhGia sang đơn vị hợp lệ → OK; sang đơn vị lạ → HANG_HOA_PRICE_UNIT_INVALID`
- `update() — tắt trangThai → trangThai=false`
- `update() — gửi maSP → bị từ chối`
- `remove() — chưa có lô → xóa hàng và đơn vị`
- `remove() — đã có lô → HANG_HOA_IN_USE`
- `assertReceivable() — hàng ngừng KD → HANG_HOA_INACTIVE`
- `rules.assertPriceOrder() — bằng nhau → OK; lớn hơn → lỗi`
- `rules.assertControlType() — bảng chân trị (isKeDon × loaiKiemSoat × soDangKy)`
- `mapper — NHAN_VIEN_KHO bỏ giaNhap/giaToiThieu; tiền luôn là chuỗi 2 chữ số`
### E2E tests
- Quản lý tạo hàng với đơn vị viên/vỉ/hộp → 201; `GET :id` có 3 đơn vị, `donViCoBan = viên`.
- Tạo kê đơn thiếu số đăng ký → 422.
- `NHAN_VIEN_KHO` `GET /hang-hoa/:id` → không có `giaNhap`; `KE_TOAN` có.
- Đổi giá → `GET /audit` (admin) có dòng `hang_hoa.price_change`.
- Lọc `isCanGiuLanh=true` + `q`; phân trang.
- Hàng đã có số lô → `DELETE` 409; hàng chưa có → 204.
- Ma trận role cho `POST/PATCH/DELETE`; không token 401; sai UUID 400.

## 13. Permissions
| Action | ADMIN | QUAN_LY_KHO | NHAN_VIEN_KHO | KE_TOAN |
|---|---|---|---|---|
| list / read | ✓ | ✓ | ✓ (không giá nhập/tối thiểu) | ✓ |
| create / update | ✓ | ✓ | ✗ | ✗ |
| delete | ✓ | ✗ | ✗ | ✗ |

## 14. Open questions
- **Q-HH-1**: Ba mức giá hiện tại (`giaNhap`, `giaHienThi`, `giaToiThieu`) tính theo đơn vị nào — hộp, hay đơn vị cơ bản? Đề xuất `donViTinhGia` (P-07). Xem thêm [schema-notes.md](../01-data/schema-notes.md) §6.
- **Q-HH-2**: `tenSP` có cần duy nhất (theo `tenSP + quyCach`)? Đề xuất không bắt buộc duy nhất, chỉ cảnh báo khi trùng cả `tenSP` và `quyCach`.
- **Q-HH-3**: Cần thêm các trường dược: hoạt chất, hàm lượng, dạng bào chế, nhà sản xuất, nước sản xuất, mã vạch/GTIN, thuế VAT?
- **Q-HH-4**: `soDangKy` bắt buộc cho mọi thuốc hay chỉ thuốc kê đơn/kiểm soát (đề xuất hiện tại)? Có cần kiểm tra định dạng số đăng ký (ví dụ `VD-xxxxx-xx`)?
- **Q-HH-5**: Hàng "ngừng kinh doanh" có được xuất nốt tồn còn lại không (đề xuất: được)?
- **Q-HH-6**: `NHAN_VIEN_KHO` không được thấy `giaNhap`/`giaToiThieu` — đúng ý bạn không?
- **Q-HH-7**: Có tồn kho tối thiểu / định mức cần cảnh báo hết hàng (cần thêm `tonToiThieu`)?
