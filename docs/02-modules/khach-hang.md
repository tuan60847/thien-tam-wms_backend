# Module: khach-hang

## 1. Mục đích
- Danh mục khách hàng (nhà thuốc mua sỉ): thông tin liên hệ, người đại diện, giấy phép kinh doanh, trạng thái hoạt động; là điều kiện để lập phiếu xuất và tính công nợ phải thu.
- Actors: `ADMIN`, `QUAN_LY_KHO`, `KE_TOAN` (tạo/sửa); `NHAN_VIEN_KHO` (đọc); xem công nợ khách: `ADMIN`, `QUAN_LY_KHO`, `KE_TOAN` (endpoint ở [phieu-thu-cong-no.md](phieu-thu-cong-no.md)).

## 2. Scope
### In scope
- CRUD khách hàng; ngừng hoạt động; theo dõi hạn giấy phép (GPKD) và cảnh báo sắp hết hạn; hạn mức công nợ (nếu chốt Q-KH-1).
- Hàm `assertCanBuy` dùng khi lập/xuất phiếu xuất.
### Out of scope (phase 2)
- Nhiều địa chỉ giao hàng / nhiều người liên hệ mỗi khách; nhóm khách và bảng giá theo nhóm; chiết khấu theo khách; lịch sử liên hệ/CRM; cổng khách tự xem công nợ.
- Đính kèm bản scan giấy phép → [file-upload.md](../03-cross-cutting/file-upload.md) (M7).

## 3. Dependencies
- Cần có trước: `auth`, `prisma`, `audit`, `CodeGeneratorService`.
- Được dùng bởi: [phieu-xuat-hang.md](phieu-xuat-hang.md), [phieu-thu-cong-no.md](phieu-thu-cong-no.md), [bao-cao.md](bao-cao.md).
- Thư viện ngoài: không thêm.

## 4. Data model
- Model: `KhachHang` (quan hệ `phieuXuatHangs`).
- Quy tắc trường:
  - `maKH`: sinh tự động `KH` + 5 số, unique, không sửa.
  - `tenKH` 1–200; `diaChi` ≤ 255 (mặc định điền vào `diaChiGiaoHang` của phiếu xuất).
  - `maSoThue`: `^\d{10}(-\d{3})?$`, unique nếu có (P-04).
  - `email` ≤ 150, hợp lệ; `SDT`, `SDTNDD`: `@IsVnPhone`; `nguoiDaiDien` ≤ 100.
  - `trangThai`: `hoat_dong | ngung_hoat_dong` (P-01), mặc định `hoat_dong`.
  - `soGiayPhepKinhDoanh` ≤ 50, `ngayCapGPKD`, `ngayHetHanGPKD` (`@db.Date`, P-06), `ngayHetHanGPKD ≥ ngayCapGPKD`.
  - `hanMucCongNo Decimal(15,2)?`, `soNgayNoToiDa Int?` (P-12, chỉ nếu chốt).
- Đề xuất: P-01, P-02 (hiện chưa có `createdAt/updatedAt`), P-04, P-06, P-12.

## 5. API endpoints
| Method | Path | Auth | Roles | Mô tả ngắn | DTO request | DTO response |
|---|---|---|---|---|---|---|
| GET | `/api/v1/khach-hang` | JWT | mọi role | Danh sách khách hàng | `QueryKhachHangDto` | `PagedResponse<KhachHangResponseDto>` |
| GET | `/api/v1/khach-hang/:id` | JWT | mọi role | Chi tiết khách hàng | — | `KhachHangResponseDto` |
| POST | `/api/v1/khach-hang` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Tạo khách hàng | `CreateKhachHangDto` | `KhachHangResponseDto` (201) |
| PATCH | `/api/v1/khach-hang/:id` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Sửa / ngừng hoạt động | `UpdateKhachHangDto` | `KhachHangResponseDto` |
| DELETE | `/api/v1/khach-hang/:id` | JWT | ADMIN | Xóa nếu chưa có phiếu xuất | — | 204 |

(Công nợ: `GET /api/v1/khach-hang/:id/cong-no` — xem [phieu-thu-cong-no.md](phieu-thu-cong-no.md).)

## 6. DTOs
### Request
- `CreateKhachHangDto`: `tenKH` (`@IsNotEmpty @MaxLength(200)`), `diaChi?`, `maSoThue?` (`@IsVnTaxCode`), `email?` (`@IsEmail`), `SDT?`, `nguoiDaiDien?`, `SDTNDD?` (`@IsVnPhone`), `soGiayPhepKinhDoanh?`, `ngayCapGPKD?`, `ngayHetHanGPKD?` (`@IsDateOnly`), `hanMucCongNo?` (`@IsMoney`), `soNgayNoToiDa?` (`@IsInt @Min(0) @Max(365)`).
- `UpdateKhachHangDto = PartialType(CreateKhachHangDto) + { trangThai?: 'hoat_dong' | 'ngung_hoat_dong' }`. Không có `maKH`.
### Response
- `KhachHangResponseDto { id; maKH; tenKH; diaChi; maSoThue; email; SDT; nguoiDaiDien; SDTNDD; trangThai; soGiayPhepKinhDoanh; ngayCapGPKD; ngayHetHanGPKD; giayPhep: 'con_han' | 'sap_het_han' | 'het_han' | 'chua_khai_bao'; hanMucCongNo; soNgayNoToiDa; createdAt; updatedAt }` — `giayPhep` tính khi đọc: `het_han` nếu `ngayHetHanGPKD < hôm nay`; `sap_het_han` nếu còn ≤ 30 ngày; `chua_khai_bao` nếu thiếu ngày.
### Query
- `QueryKhachHangDto extends PaginationQueryDto { trangThai?: enum; giayPhep?: enum }`; `q` trên `maKH`, `tenKH`, `maSoThue`, `SDT`, `nguoiDaiDien`; sort `maKH`, `tenKH`, `createdAt`, `ngayHetHanGPKD`; mặc định `tenKH:asc`.

## 7. Business rules
- BR-01: `maKH` sinh tự động, tăng dần, không đổi.
- BR-02: `maSoThue` duy nhất (khi có); `ngayHetHanGPKD ≥ ngayCapGPKD`.
- BR-03: **Điều kiện được mua** (`assertCanBuy`): `trangThai = hoat_dong` **và** `ngayHetHanGPKD` còn hiệu lực (≥ hôm nay). Thiếu `ngayHetHanGPKD` ⇒ coi là chưa khai báo ⇒ không đủ điều kiện (Q-KH-2: có cho qua với khách chưa khai báo không?). Kiểm tra khi **lập** và khi **xuất kho** phiếu xuất.
- BR-04: Ngừng hoạt động không xóa công nợ; vẫn thu tiền được cho phiếu đã xuất.
- BR-05: Chỉ xóa được khách **chưa có** phiếu xuất (`KHACH_HANG_IN_USE`).
- BR-06: Đổi `trangThai` ghi `NhatKyHeThong` `khach_hang.status_change`.
- BR-07: Nếu chốt hạn mức: phiếu xuất mới bị chặn khi `công nợ hiện tại + tổng phiếu mới > hanMucCongNo` (`KHACH_HANG_CREDIT_EXCEEDED`); `QUAN_LY_KHO`/`ADMIN` có thể ghi đè kèm lý do (Q-KH-1).
- BR-08: Giấy phép sắp hết hạn (≤ 30 ngày) hiển thị trong danh sách lọc `giayPhep=sap_het_han` để nhắc cập nhật.

## 8. Error cases
| Mã lỗi | HTTP | Khi nào | Message (VN) |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | DTO sai (MST, SĐT, ngày) | Dữ liệu gửi lên không hợp lệ |
| `KHACH_HANG_NOT_FOUND` | 404 | id không tồn tại | Không tìm thấy khách hàng |
| `KHACH_HANG_TAX_CODE_TAKEN` | 409 | trùng MST | Mã số thuế đã được sử dụng cho khách hàng khác |
| `KHACH_HANG_INACTIVE` | 422 | lập phiếu cho khách ngừng hoạt động | Khách hàng đã ngừng hoạt động |
| `KHACH_HANG_LICENSE_EXPIRED` | 422 | giấy phép hết hạn / chưa khai báo | Giấy phép kinh doanh của khách hàng đã hết hạn hoặc chưa được khai báo |
| `KHACH_HANG_CREDIT_EXCEEDED` | 422 | vượt hạn mức công nợ (nếu bật) | Phiếu xuất làm vượt hạn mức công nợ của khách hàng |
| `KHACH_HANG_IN_USE` | 409 | xóa khi đã có phiếu xuất | Khách hàng đã phát sinh phiếu xuất nên không thể xóa, hãy chuyển sang ngừng hoạt động |
| `AUTH_FORBIDDEN` | 403 | thiếu quyền | Bạn không có quyền truy cập |

## 9. Service layer design
`KhachHangService`:
- `findAll(query: QueryKhachHangDto): Promise<PagedResponse<KhachHangResponseDto>>`
- `findOne(id: string): Promise<KhachHangResponseDto>`
- `create(dto: CreateKhachHangDto, actor: AuthenticatedUser): Promise<KhachHangResponseDto>`
- `update(id: string, dto: UpdateKhachHangDto, actor: AuthenticatedUser): Promise<KhachHangResponseDto>`
- `remove(id: string): Promise<void>`
- `assertCanBuy(khachHang: KhachHang, today: Date): void` — ném `KHACH_HANG_INACTIVE` / `KHACH_HANG_LICENSE_EXPIRED`.
- `findByIdOrThrow(id: string, tx?: Prisma.TransactionClient): Promise<KhachHang>` — cho phiếu xuất.
- `computeLicenseStatus(ngayHetHan: Date | null, today: Date): 'con_han' | 'sap_het_han' | 'het_han' | 'chua_khai_bao'` — hàm thuần.

Transaction: `create` (sinh mã + tạo); `update` khi đổi trạng thái (cập nhật + nhật ký). Side effects: `CodeGeneratorService('KH')`, `AuditService`.

## 10. Controller layer
- 1–1 với service. Guards: `GET` mọi role; `POST/PATCH` `@Roles(ADMIN, QUAN_LY_KHO, KE_TOAN)`; `DELETE` `@Roles(ADMIN)`.

## 11. File layout
```
src/khach-hang/
  khach-hang.module.ts
  khach-hang.controller.ts
  khach-hang.service.ts
  khach-hang.service.spec.ts
  khach-hang.controller.spec.ts
  khach-hang.mapper.ts
  khach-hang.rules.ts            # computeLicenseStatus, assertCanBuy (hàm thuần)
  khach-hang.rules.spec.ts
  dto/
    create-khach-hang.dto.ts
    update-khach-hang.dto.ts
    query-khach-hang.dto.ts
    khach-hang-response.dto.ts
```

## 12. Test plan
### Unit tests
- `create() — dữ liệu hợp lệ → sinh maKH KH00001, trangThai hoat_dong`
- `create() — hai khách liên tiếp → maKH tăng dần`
- `create() — maSoThue trùng → KHACH_HANG_TAX_CODE_TAKEN`
- `create() — hai khách đều không có maSoThue → cho phép`
- `create() — maSoThue sai định dạng, SĐT sai, email sai → VALIDATION_FAILED`
- `create() — ngayHetHanGPKD < ngayCapGPKD → VALIDATION_FAILED`
- `findAll() — lọc trangThai, giayPhep=het_han/sap_het_han, q theo MST/SĐT/tên`
- `findAll() — sort theo ngayHetHanGPKD`
- `findOne() — giayPhep tính đúng theo ngày hiện tại (ClockService giả)`
- `update() — đổi thông tin → OK; đổi MST sang MST của khách khác → KHACH_HANG_TAX_CODE_TAKEN`
- `update() — ngừng hoạt động → ghi nhật ký khach_hang.status_change`
- `update() — gửi maKH → bị từ chối`
- `remove() — chưa có phiếu xuất → xóa; đã có → KHACH_HANG_IN_USE`
- `assertCanBuy() — hoạt động + GPKD còn hạn → OK`
- `assertCanBuy() — GPKD hết hạn hôm qua → KHACH_HANG_LICENSE_EXPIRED`
- `assertCanBuy() — GPKD hết hạn đúng hôm nay → OK (còn dùng hết ngày)`
- `assertCanBuy() — chưa khai báo ngày hết hạn → KHACH_HANG_LICENSE_EXPIRED`
- `assertCanBuy() — ngưng hoạt động → KHACH_HANG_INACTIVE`
- `computeLicenseStatus() — bảng chân trị (null / quá khứ / hôm nay / +30 / +31)`
- `mapper — không lộ trường nội bộ; tiền (hanMucCongNo) là chuỗi`
### E2E tests
- Tạo khách → `GET` thấy `maKH` và `giayPhep`; trùng MST → 409.
- Lọc `giayPhep=sap_het_han` trả khách có hạn trong 30 ngày.
- Ngừng hoạt động → lập phiếu xuất cho khách đó bị 422 (kiểm ở e2e phiếu xuất).
- Xóa khách đã có phiếu xuất → 409; chưa có → 204.
- Ma trận role: `NHAN_VIEN_KHO` `POST/PATCH` → 403; `KE_TOAN` `POST/PATCH` → 2xx; `QUAN_LY_KHO` `DELETE` → 403.

## 13. Permissions
| Action | ADMIN | QUAN_LY_KHO | NHAN_VIEN_KHO | KE_TOAN |
|---|---|---|---|---|
| list / read | ✓ | ✓ | ✓ | ✓ |
| create / update | ✓ | ✓ | ✗ | ✓ |
| delete | ✓ | ✗ | ✗ | ✗ |

## 14. Open questions
- **Q-KH-1**: Có kiểm soát **hạn mức công nợ** và/hoặc **số ngày nợ tối đa** theo khách không? (nếu có: thêm P-12, chặn khi vượt, ai được ghi đè?)
- **Q-KH-2**: Khách chưa khai báo ngày hết hạn GPKD có được mua không? (đề xuất hiện tại: không; có thể đổi thành cảnh báo mềm).
- **Q-KH-3**: Khách hàng đã có mã riêng cần giữ khi import (thay vì `KH00001`)?
- **Q-KH-4**: Một nhà thuốc có nhiều chi nhánh/địa chỉ giao khác nhau không (cần bảng địa chỉ giao)?
- **Q-KH-5**: Có cần lưu thêm Chứng chỉ hành nghề dược sĩ / GCN đạt GPP của nhà thuốc (ngoài GPKD) và kiểm tra hạn của chúng?
