# Module: nha-cung-cap

## 1. Mục đích
- Danh mục nhà cung cấp thuốc, kèm hồ sơ pháp lý (GPKD, GCN đủ điều kiện kinh doanh dược) và quy trình **xác minh** trước khi được phép nhập hàng.
- Actors: `ADMIN`, `QUAN_LY_KHO`, `KE_TOAN` (tạo/sửa); `ADMIN`, `QUAN_LY_KHO` (xác minh); mọi role đọc. Xem công nợ phải trả: `ADMIN`, `QUAN_LY_KHO`, `KE_TOAN` (endpoint ở [phieu-thanh-toan.md](phieu-thanh-toan.md)).

## 2. Scope
### In scope
- CRUD NCC; luồng xác minh (`chua_xac_minh → da_xac_minh | tu_choi`); theo dõi hạn giấy phép; vô hiệu hóa NCC.
- Hàm `assertCanSupply` dùng khi lập/xác nhận phiếu nhập.
### Out of scope (phase 2)
- Đánh giá/chấm điểm NCC, hợp đồng và điều khoản thanh toán chi tiết, nhiều liên hệ mỗi NCC, danh mục sản phẩm NCC cung cấp, đính kèm hồ sơ pháp lý (qua [file-upload.md](../03-cross-cutting/file-upload.md) ở M7).

## 3. Dependencies
- Cần có trước: `auth`, `prisma`, `audit`, `CodeGeneratorService`.
- Được dùng bởi: [phieu-nhap-hang.md](phieu-nhap-hang.md), [phieu-thanh-toan.md](phieu-thanh-toan.md), [bao-cao.md](bao-cao.md).
- Thư viện ngoài: không thêm.

## 4. Data model
- Model: `NhaCungCap` (quan hệ `phieuNhapHangs`).
- Quy tắc trường:
  - `maNCC` (**mới**, P-11): sinh `NCC` + 4 số, unique, không sửa.
  - `tenNCC` 1–200; `SDT` `@IsVnPhone`; `diaChi` ≤ 255; `tenNguoiPhuTrach` ≤ 100; `sdtNguoiPT` `@IsVnPhone`; `ghiChu` ≤ 500.
  - `trangThaiXacMinh`: `chua_xac_minh | da_xac_minh | tu_choi` (P-01), mặc định `chua_xac_minh`.
  - Giấy phép: `soGiayPhepKinhDoanh`, `ngayCapGPKD`, `noiCapGPKD`, `ngayHetHanGPKD` (**mới**); `soGCNDuDieuKienKinhDoanhDuoc`, `ngayCapGCNDuoc`, `noiCapGCNDuoc`, `ngayHetHanGCNDuoc` (**mới**). Ngày hết hạn ≥ ngày cấp.
  - `trangThai` (**mới**, P-03) boolean hoạt động; `xacMinhAt`, `xacMinhById` (**mới**, P-11).
- Đề xuất: P-01, P-02, P-03, P-06, P-11.

## 5. API endpoints
| Method | Path | Auth | Roles | Mô tả ngắn | DTO request | DTO response |
|---|---|---|---|---|---|---|
| GET | `/api/v1/nha-cung-cap` | JWT | mọi role | Danh sách NCC | `QueryNhaCungCapDto` | `PagedResponse<NhaCungCapResponseDto>` |
| GET | `/api/v1/nha-cung-cap/:id` | JWT | mọi role | Chi tiết NCC | — | `NhaCungCapResponseDto` |
| POST | `/api/v1/nha-cung-cap` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Tạo NCC (mặc định chưa xác minh) | `CreateNhaCungCapDto` | `NhaCungCapResponseDto` (201) |
| PATCH | `/api/v1/nha-cung-cap/:id` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Sửa thông tin / ngừng hoạt động | `UpdateNhaCungCapDto` | `NhaCungCapResponseDto` |
| POST | `/api/v1/nha-cung-cap/:id/xac-minh` | JWT | ADMIN, QUAN_LY_KHO | Xác minh hoặc từ chối NCC | `XacMinhNhaCungCapDto` | `NhaCungCapResponseDto` |
| DELETE | `/api/v1/nha-cung-cap/:id` | JWT | ADMIN | Xóa nếu chưa có phiếu nhập | — | 204 |

(Công nợ: `GET /api/v1/nha-cung-cap/:id/cong-no` — xem [phieu-thanh-toan.md](phieu-thanh-toan.md).)

## 6. DTOs
### Request
- `CreateNhaCungCapDto`: `tenNCC` (`@IsNotEmpty @MaxLength(200)`), `SDT?`, `diaChi?`, `tenNguoiPhuTrach?`, `sdtNguoiPT?`, `ghiChu?`, `soGiayPhepKinhDoanh?`, `ngayCapGPKD?`, `noiCapGPKD?`, `ngayHetHanGPKD?`, `soGCNDuDieuKienKinhDoanhDuoc?`, `ngayCapGCNDuoc?`, `noiCapGCNDuoc?`, `ngayHetHanGCNDuoc?` (ngày `@IsDateOnly`).
- `UpdateNhaCungCapDto = PartialType(CreateNhaCungCapDto) + { trangThai?: boolean }`. Không có `maNCC`, `trangThaiXacMinh` (chỉ đổi qua `/xac-minh`).
- `XacMinhNhaCungCapDto { ketQua: 'da_xac_minh' | 'tu_choi'; ghiChu?: string }` — `ghiChu` bắt buộc khi `tu_choi`.
### Response
- `NhaCungCapResponseDto { id; maNCC; tenNCC; SDT; diaChi; tenNguoiPhuTrach; sdtNguoiPT; ghiChu; trangThai; trangThaiXacMinh; xacMinhAt; xacMinhBoi: { id; maNV; hoTen } | null; giayPhep: { gpkd: 'con_han'|'sap_het_han'|'het_han'|'chua_khai_bao'; gcn: (cùng tập) }; soGiayPhepKinhDoanh; ngayCapGPKD; noiCapGPKD; ngayHetHanGPKD; soGCNDuDieuKienKinhDoanhDuoc; ngayCapGCNDuoc; noiCapGCNDuoc; ngayHetHanGCNDuoc; createdAt; updatedAt }`.
### Query
- `QueryNhaCungCapDto extends PaginationQueryDto { trangThai?: boolean; trangThaiXacMinh?: enum }`; `q` trên `maNCC`, `tenNCC`, `SDT`, `tenNguoiPhuTrach`; sort `maNCC`, `tenNCC`, `createdAt`; mặc định `tenNCC:asc`.

## 7. Business rules
- BR-01: `maNCC` sinh tự động, không đổi.
- BR-02: NCC mới luôn `chua_xac_minh`.
- BR-03: **Xác minh thành công** (`da_xac_minh`) đòi hỏi đủ cả hai bộ hồ sơ: `soGiayPhepKinhDoanh`, `ngayCapGPKD`, `ngayHetHanGPKD`, `soGCNDuDieuKienKinhDoanhDuoc`, `ngayCapGCNDuoc`, `ngayHetHanGCNDuoc` (thiếu → `NHA_CUNG_CAP_LICENSE_INCOMPLETE`) và **cả hai chưa hết hạn** (`NHA_CUNG_CAP_LICENSE_EXPIRED`).
- BR-04: Sửa bất kỳ trường giấy phép (số, ngày cấp, nơi cấp, ngày hết hạn) của NCC đã `da_xac_minh` ⇒ tự quay về `chua_xac_minh` (phải xác minh lại), ghi nhật ký.
- BR-05: **Điều kiện được cung cấp** (`assertCanSupply`): `trangThai = true`, `trangThaiXacMinh = da_xac_minh`, và cả GPKD lẫn GCN còn hiệu lực hôm nay. Kiểm khi **lập** và khi **xác nhận nhập kho** phiếu nhập (giấy phép có thể hết hạn giữa hai thời điểm).
- BR-06: `tu_choi` có thể xác minh lại sau khi sửa hồ sơ (`chua_xac_minh` tự đặt lại khi hồ sơ đổi, hoặc gọi lại `/xac-minh`).
- BR-07: Chỉ xóa được NCC chưa có phiếu nhập (`NHA_CUNG_CAP_IN_USE`).
- BR-08: Mọi lần xác minh/từ chối ghi `xacMinhAt`, `xacMinhById` và `NhatKyHeThong` (`nha_cung_cap.verify` / `nha_cung_cap.reject`).
- BR-09: NCC đã ngừng hoạt động không nhận phiếu nhập mới nhưng vẫn thanh toán được cho phiếu cũ.

## 8. Error cases
| Mã lỗi | HTTP | Khi nào | Message (VN) |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | DTO sai | Dữ liệu gửi lên không hợp lệ |
| `NHA_CUNG_CAP_NOT_FOUND` | 404 | id không tồn tại | Không tìm thấy nhà cung cấp |
| `NHA_CUNG_CAP_CODE_TAKEN` | 409 | trùng `maNCC` (an toàn khi import) | Mã nhà cung cấp đã tồn tại |
| `NHA_CUNG_CAP_LICENSE_INCOMPLETE` | 422 | xác minh khi thiếu hồ sơ | Hồ sơ giấy phép chưa đầy đủ để xác minh |
| `NHA_CUNG_CAP_LICENSE_EXPIRED` | 422 | xác minh/nhập hàng khi giấy phép hết hạn | Giấy phép của nhà cung cấp đã hết hạn |
| `NHA_CUNG_CAP_NOT_VERIFIED` | 422 | lập phiếu nhập với NCC chưa xác minh | Nhà cung cấp chưa được xác minh |
| `NHA_CUNG_CAP_INACTIVE` | 422 | lập phiếu nhập với NCC ngừng hoạt động | Nhà cung cấp đã ngừng hoạt động |
| `NHA_CUNG_CAP_IN_USE` | 409 | xóa khi đã có phiếu nhập | Nhà cung cấp đã phát sinh phiếu nhập nên không thể xóa, hãy chuyển sang ngừng hoạt động |
| `AUTH_FORBIDDEN` | 403 | thiếu quyền | Bạn không có quyền truy cập |

## 9. Service layer design
`NhaCungCapService`:
- `findAll(query: QueryNhaCungCapDto): Promise<PagedResponse<NhaCungCapResponseDto>>`
- `findOne(id: string): Promise<NhaCungCapResponseDto>`
- `create(dto: CreateNhaCungCapDto, actor: AuthenticatedUser): Promise<NhaCungCapResponseDto>`
- `update(id: string, dto: UpdateNhaCungCapDto, actor: AuthenticatedUser): Promise<NhaCungCapResponseDto>` — BR-04 (reset xác minh khi đổi giấy phép).
- `verify(id: string, dto: XacMinhNhaCungCapDto, actor: AuthenticatedUser): Promise<NhaCungCapResponseDto>`
- `remove(id: string): Promise<void>`
- `assertCanSupply(ncc: NhaCungCap, today: Date): void` — hàm thuần: ném `NHA_CUNG_CAP_INACTIVE` / `NOT_VERIFIED` / `LICENSE_EXPIRED`.
- `findByIdOrThrow(id: string, tx?: Prisma.TransactionClient): Promise<NhaCungCap>`

Transaction: `create` (sinh mã); `update` khi reset xác minh; `verify` (kiểm hồ sơ + cập nhật + nhật ký). Side effects: `CodeGeneratorService('NCC')`, `AuditService`.

## 10. Controller layer
- 1–1 với service. Guards: `GET` mọi role; `POST/PATCH` `@Roles(ADMIN, QUAN_LY_KHO, KE_TOAN)`; `POST :id/xac-minh` `@Roles(ADMIN, QUAN_LY_KHO)`; `DELETE` `@Roles(ADMIN)`.

## 11. File layout
```
src/nha-cung-cap/
  nha-cung-cap.module.ts
  nha-cung-cap.controller.ts
  nha-cung-cap.service.ts
  nha-cung-cap.service.spec.ts
  nha-cung-cap.controller.spec.ts
  nha-cung-cap.mapper.ts
  nha-cung-cap.rules.ts          # assertCanSupply, assertVerifiable, computeLicenseStatus
  nha-cung-cap.rules.spec.ts
  dto/
    create-nha-cung-cap.dto.ts
    update-nha-cung-cap.dto.ts
    query-nha-cung-cap.dto.ts
    xac-minh-nha-cung-cap.dto.ts
    nha-cung-cap-response.dto.ts
```

## 12. Test plan
### Unit tests
- `create() — dữ liệu hợp lệ → sinh maNCC NCC0001, trangThaiXacMinh chua_xac_minh, trangThai true`
- `create() — SĐT/ngày sai → VALIDATION_FAILED`
- `create() — ngày hết hạn trước ngày cấp → VALIDATION_FAILED`
- `findAll() — lọc trangThaiXacMinh, trangThai, q`
- `findOne() — trạng thái giấy phép tính đúng theo ngày (ClockService giả)`
- `update() — sửa SĐT → giữ nguyên trạng thái xác minh`
- `update() — sửa số GPKD của NCC đã xác minh → tự về chua_xac_minh và ghi nhật ký`
- `update() — sửa ngayHetHanGCNDuoc của NCC đã xác minh → về chua_xac_minh`
- `update() — gửi trangThaiXacMinh/maNCC → bị từ chối`
- `verify() — hồ sơ đủ, chưa hết hạn, da_xac_minh → ghi xacMinhAt/By, nhật ký nha_cung_cap.verify`
- `verify() — thiếu một trong sáu trường hồ sơ → NHA_CUNG_CAP_LICENSE_INCOMPLETE`
- `verify() — GPKD hết hạn → NHA_CUNG_CAP_LICENSE_EXPIRED`
- `verify() — GCN hết hạn → NHA_CUNG_CAP_LICENSE_EXPIRED`
- `verify() — tu_choi không có ghiChu → VALIDATION_FAILED`
- `verify() — tu_choi có ghiChu → trangThaiXacMinh tu_choi, nhật ký nha_cung_cap.reject`
- `verify() — đã da_xac_minh, xác minh lại → vẫn thành công (cập nhật xacMinhAt)`
- `remove() — chưa có phiếu nhập → xóa; có → NHA_CUNG_CAP_IN_USE`
- `assertCanSupply() — bảng chân trị (hoạt động × xác minh × GPKD × GCN hết hạn hôm qua / hôm nay)`
- `mapper — không lộ trường nội bộ`
### E2E tests
- Tạo NCC → chưa xác minh → lập phiếu nhập (e2e phiếu nhập) bị 422 `NHA_CUNG_CAP_NOT_VERIFIED`.
- Bổ sung hồ sơ rồi `/xac-minh` → 200; lập phiếu nhập được.
- Sửa số GPKD NCC đã xác minh → `trangThaiXacMinh` về `chua_xac_minh`.
- Xác minh thiếu hồ sơ → 422; từ chối thiếu ghi chú → 400.
- Xóa NCC đã có phiếu nhập → 409.
- Ma trận role: `NHAN_VIEN_KHO` `POST` → 403; `KE_TOAN` `POST` → 201 nhưng `/xac-minh` → 403; `QUAN_LY_KHO` `/xac-minh` → 200.

## 13. Permissions
| Action | ADMIN | QUAN_LY_KHO | NHAN_VIEN_KHO | KE_TOAN |
|---|---|---|---|---|
| list / read | ✓ | ✓ | ✓ | ✓ |
| create / update | ✓ | ✓ | ✗ | ✓ |
| xác minh / từ chối | ✓ | ✓ | ✗ | ✗ |
| delete | ✓ | ✗ | ✗ | ✗ |

## 14. Open questions
- **Q-NCC-1**: Hồ sơ pháp lý bắt buộc để "xác minh" gồm những loại nào chính xác (GPKD + GCN đủ điều kiện kinh doanh dược; còn GDP/GMP, chứng chỉ hành nghề)? Hiện đề xuất hai loại có sẵn trong schema.
- **Q-NCC-2**: Giấy phép hết hạn sau khi đã xác minh: tự hạ trạng thái xác minh bằng job, hay chỉ chặn nhập hàng khi kiểm tra (đề xuất hiện tại: chặn khi nhập, không tự hạ)?
- **Q-NCC-3**: NCC đã có mã riêng cần giữ khi import (thay vì `NCC0001`)?
- **Q-NCC-4**: Có cần điều khoản thanh toán (số ngày nợ) theo NCC để tính hạn trả và aging phải trả?
- **Q-NCC-5**: NCC "tu_choi" có được xác minh lại sau khi bổ sung hồ sơ không (đề xuất: có)?
