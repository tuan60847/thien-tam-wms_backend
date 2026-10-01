# Module: so-lo

## 1. Mục đích
- Quản lý **lô sản xuất** của từng hàng hóa: số lô, ngày sản xuất, hạn sử dụng; là đơn vị truy vết xuyên suốt nhập – lưu kho – xuất. Cung cấp các kiểm tra hạn dùng cho phiếu nhập/xuất.
- Actors: `ADMIN`, `QUAN_LY_KHO` (sửa); `NHAN_VIEN_KHO` (tạo, đọc); `KE_TOAN` (đọc).

## 2. Scope
### In scope
- Tạo lô độc lập; tìm kiếm/lọc theo hàng, hạn, trạng thái, còn tồn; sửa thông tin lô (có kiểm soát); xóa lô chưa phát sinh.
- Trạng thái lô suy ra từ hạn (`con_han` / `can_date` / `het_han`); job cập nhật cột lưu đệm.
- Kiểm tra hạn dùng cho nhập/xuất (`assertReceivable`, `assertIssuable`).
- Lấy-hoặc-tạo lô theo `(hangHoaId, tenLo)` khi nhập hàng (dùng trong transaction của phiếu nhập).
### Out of scope (phase 2)
- Lô tự động sinh số lô, mã vạch/QR cho lô, phiếu kiểm nghiệm đính kèm (qua [file-upload.md](../03-cross-cutting/file-upload.md)), lô thu hồi/biệt trữ (quarantine) với trạng thái riêng, nhà sản xuất của lô.

## 3. Dependencies
- Cần có trước: [hang-hoa.md](hang-hoa.md); `ClockService`; `audit`.
- Được dùng bởi: [ton-kho.md](ton-kho.md), [phieu-nhap-hang.md](phieu-nhap-hang.md), [phieu-xuat-hang.md](phieu-xuat-hang.md), `bao-cao`, job `expiry-scan` ([background-jobs.md](../03-cross-cutting/background-jobs.md)).
- Thư viện ngoài: `@nestjs/schedule` (cho job; cài ở M4).

## 4. Data model
- Model: `SoLo` (quan hệ `hangHoa`, `tonKhos`, `chiTietPhieuNhapHangs`, `chiTietPhieuXuatHangs`).
- Quy tắc trường:
  - `tenLo` 1–50 ký tự (trim, giữ nguyên hoa/thường nhưng so trùng không phân biệt hoa/thường); unique theo `(hangHoaId, tenLo)` (P-04).
  - `ngaySX` tùy chọn; `hanSuDung` bắt buộc; cả hai `@db.Date` (P-06); `hanSuDung > ngaySX` nếu có `ngaySX`.
  - `trangThai`: **bản lưu đệm** (`con_han | can_date | het_han`, P-01), mặc định `con_han`; giá trị đúng luôn tính lại từ `hanSuDung` khi đọc.
  - `hangHoaId` không đổi sau khi tạo.
- Đề xuất: P-01, P-02 (`createdById`, `updatedById`), P-04, P-05 (index `(hanSuDung)`, `(hangHoaId, hanSuDung)`), P-06.
- Cấu hình: `EXPIRY_WARNING_DAYS` (mặc định 90), `MIN_SHELF_LIFE_DAYS_RECEIVE` (mặc định 0 = tắt), `MIN_SHELF_LIFE_DAYS_ISSUE` (mặc định 0 = tắt).

## 5. API endpoints
| Method | Path | Auth | Roles | Mô tả ngắn | DTO request | DTO response |
|---|---|---|---|---|---|---|
| GET | `/api/v1/so-lo` | JWT | mọi role | Danh sách lô | `QuerySoLoDto` | `PagedResponse<SoLoResponseDto>` |
| GET | `/api/v1/so-lo/:id` | JWT | mọi role | Chi tiết lô (kèm tổng tồn) | — | `SoLoDetailDto` |
| POST | `/api/v1/so-lo` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Tạo lô | `CreateSoLoDto` | `SoLoResponseDto` (201) |
| PATCH | `/api/v1/so-lo/:id` | JWT | ADMIN, QUAN_LY_KHO | Sửa tên/ngày/hạn lô | `UpdateSoLoDto` | `SoLoResponseDto` |
| DELETE | `/api/v1/so-lo/:id` | JWT | ADMIN | Xóa lô chưa phát sinh | — | 204 |

Tồn theo vị trí của một lô: `GET /ton-kho?soLoId=` ([ton-kho.md](ton-kho.md)).

## 6. DTOs
### Request
- `CreateSoLoDto { hangHoaId: string; tenLo: string; ngaySX?: string | null; hanSuDung: string }` — `hangHoaId` `@IsUUID`; `tenLo` `@IsNotEmpty @MaxLength(50)` trim; ngày `@IsDateOnly`.
- `UpdateSoLoDto { tenLo?: string; ngaySX?: string | null; hanSuDung?: string; lyDo?: string }` — `lyDo` (`@MaxLength(255)`) **bắt buộc** nếu đổi `hanSuDung` hoặc `ngaySX` của lô đã có biến động tồn.
### Response
- `SoLoResponseDto { id; tenLo; ngaySX: string | null; hanSuDung: string; trangThai: 'con_han'|'can_date'|'het_han'; soNgayConLai: number; hangHoa: { id; maSP; tenSP }; createdAt; updatedAt }` — `soNgayConLai` âm khi quá hạn.
- `SoLoDetailDto` = `SoLoResponseDto` + `{ tongTon: number; soViTri: number; daPhatSinhChungTu: boolean }` (`tongTon` theo đơn vị cơ bản).
### Query
- `QuerySoLoDto extends PaginationQueryDto { hangHoaId?: uuid; trangThai?: 'con_han'|'can_date'|'het_han'; conTon?: boolean; hanSuDungFrom?: date; hanSuDungTo?: date }`; `q` trên `tenLo`, `hangHoa.tenSP`, `hangHoa.maSP`; sort `hanSuDung`, `tenLo`, `createdAt`; mặc định `hanSuDung:asc`.
- `trangThai` được lọc **bằng điều kiện ngày** (không dựa cột lưu đệm): `het_han ⇔ hanSuDung < hôm nay`; `can_date ⇔ hôm nay ≤ hanSuDung ≤ hôm nay + EXPIRY_WARNING_DAYS`; `con_han ⇔ hanSuDung > hôm nay + EXPIRY_WARNING_DAYS`.

## 7. Business rules
- BR-01: `(hangHoaId, tenLo)` duy nhất (không phân biệt hoa/thường).
- BR-02: `hanSuDung > ngaySX` (nếu có `ngaySX`); `ngaySX ≤ hôm nay`.
- BR-03: Tạo lô mới yêu cầu `hanSuDung ≥ hôm nay` (không đăng ký lô đã hết hạn): ngược lại `SO_LO_EXPIRED`. Hạn dùng còn **đúng hôm nay** vẫn hợp lệ.
- BR-04: Trạng thái tính khi đọc: `het_han` nếu `hanSuDung < hôm nay`; `can_date` nếu còn `0 … EXPIRY_WARNING_DAYS` ngày; ngược lại `con_han`. Một lô có `hanSuDung = hôm nay` là `can_date`, **vẫn xuất/nhập được** trong hôm nay.
- BR-05: **Xuất kho** (`assertIssuable`): lô `het_han` bị chặn (`SO_LO_EXPIRED`); nếu `MIN_SHELF_LIFE_DAYS_ISSUE > 0`, lô còn ít hơn số ngày đó bị chặn (`SO_LO_NEAR_EXPIRY`). Kiểm dựa vào `hanSuDung`, không dựa vào cột `trangThai`.
- BR-06: **Nhập kho** (`assertReceivable`): lô `het_han` bị chặn; nếu `MIN_SHELF_LIFE_DAYS_RECEIVE > 0`, lô còn ít hơn bị chặn (`SO_LO_NEAR_EXPIRY`).
- BR-07: Sửa `hanSuDung`/`ngaySX`: chỉ `QUAN_LY_KHO`/`ADMIN`; nếu lô đã có biến động tồn thì bắt buộc `lyDo` và ghi `NhatKyHeThong` `so_lo.expiry_change`; nếu lô **đã từng xuất kho** (có dòng phiếu xuất đã xác nhận) thì **khóa**, không đổi hạn (`SO_LO_EXPIRY_LOCKED`).
- BR-08: Đổi `tenLo` chỉ khi lô chưa có chứng từ đã xác nhận (nhập/xuất); ngược lại `SO_LO_IN_USE`. (Hạn sử dụng có cơ chế khóa riêng ở BR-07.)
- BR-09: Xóa lô chỉ khi không có `TonKho`, `BienDongTonKho` hay dòng chứng từ nào (`SO_LO_IN_USE`).
- BR-10: Lấy-hoặc-tạo lô khi nhập (`resolveOrCreate`): nếu `(hangHoaId, tenLo)` đã có thì dùng lô đó; nếu `hanSuDung` hoặc `ngaySX` gửi lên khác lô đã có ⇒ `SO_LO_DATE_INVALID` (không âm thầm đổi hạn).
- BR-11: Job `expiry-scan` cập nhật cột `trangThai` hằng ngày; lỡ job không ảnh hưởng đúng/sai nghiệp vụ (BR-04/05/06).

## 8. Error cases
| Mã lỗi | HTTP | Khi nào | Message (VN) |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | DTO sai; sửa hạn thiếu `lyDo` | Dữ liệu gửi lên không hợp lệ |
| `SO_LO_NOT_FOUND` | 404 | id không tồn tại | Không tìm thấy số lô |
| `HANG_HOA_NOT_FOUND` | 404 | hàng không tồn tại | Không tìm thấy hàng hóa |
| `SO_LO_NAME_TAKEN` | 409 | trùng `(hàng, tên lô)` | Số lô này đã tồn tại cho hàng hóa |
| `SO_LO_DATE_INVALID` | 422 | hạn ≤ ngày SX; hạn/ngày SX lệch với lô đã có | Ngày sản xuất hoặc hạn sử dụng không hợp lệ hoặc không khớp với lô đã có |
| `SO_LO_EXPIRED` | 422 | tạo/nhập/xuất lô đã hết hạn | Lô đã hết hạn sử dụng |
| `SO_LO_NEAR_EXPIRY` | 422 | lô còn ít ngày hơn ngưỡng tối thiểu | Lô sắp hết hạn, không đạt thời hạn sử dụng tối thiểu để nhập/xuất |
| `SO_LO_EXPIRY_LOCKED` | 409 | sửa hạn lô đã xuất kho | Lô đã được xuất kho nên không thể thay đổi hạn sử dụng |
| `SO_LO_IN_USE` | 409 | xóa/đổi tên lô đã phát sinh | Lô đã phát sinh dữ liệu nên không thể xóa hoặc đổi tên |
| `AUTH_FORBIDDEN` | 403 | thiếu quyền | Bạn không có quyền truy cập |

## 9. Service layer design
`SoLoService`:
- `findAll(query: QuerySoLoDto): Promise<PagedResponse<SoLoResponseDto>>`
- `findOne(id: string): Promise<SoLoDetailDto>`
- `create(dto: CreateSoLoDto, actor: AuthenticatedUser): Promise<SoLoResponseDto>`
- `update(id: string, dto: UpdateSoLoDto, actor: AuthenticatedUser): Promise<SoLoResponseDto>`
- `remove(id: string): Promise<void>`
- `resolveOrCreate(input: { hangHoaId: string; tenLo: string; ngaySX?: Date | null; hanSuDung: Date }, actor: AuthenticatedUser, tx: Prisma.TransactionClient): Promise<SoLo>` — BR-10, dùng bởi phiếu nhập.
- `assertReceivable(soLo: SoLo, today: Date): void`, `assertIssuable(soLo: SoLo, today: Date): void` — hàm thuần (BR-05/06).
- `computeStatus(hanSuDung: Date, today: Date, warningDays: number): 'con_han' | 'can_date' | 'het_han'` — hàm thuần.
- `refreshExpiryStatuses(today: Date): Promise<{ canDate: number; hetHan: number }>` — cho job.
- `findByIdOrThrow(id: string, tx?): Promise<SoLo>`, `findManyByIds(ids: string[], tx?): Promise<SoLo[]>`.

Transaction: `update` (kiểm + cập nhật + nhật ký), `remove` (đếm tham chiếu + xóa), `resolveOrCreate` (chạy trong transaction của phiếu). Side effects: `AuditService`, `ClockService`.

## 10. Controller layer
- 1–1 với service (`refreshExpiryStatuses` chỉ cho job, không có endpoint). Guards: `GET` mọi role; `POST` `@Roles(ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO)`; `PATCH` `@Roles(ADMIN, QUAN_LY_KHO)`; `DELETE` `@Roles(ADMIN)`.

## 11. File layout
```
src/so-lo/
  so-lo.module.ts
  so-lo.controller.ts
  so-lo.service.ts
  so-lo.service.spec.ts
  so-lo.controller.spec.ts
  so-lo.rules.ts                 # computeStatus, assertReceivable, assertIssuable (hàm thuần)
  so-lo.rules.spec.ts
  so-lo.mapper.ts
  dto/
    create-so-lo.dto.ts
    update-so-lo.dto.ts
    query-so-lo.dto.ts
    so-lo-response.dto.ts
```
Job nằm ở `src/ton-kho/jobs/expiry-scan.job.ts` (xem [background-jobs.md](../03-cross-cutting/background-jobs.md)).

## 12. Test plan
### Unit tests
- `computeStatus() — bảng biên: hôm qua → het_han; hôm nay → can_date; +90 ngày → can_date; +91 ngày → con_han (EXPIRY_WARNING_DAYS=90)`
- `create() — dữ liệu hợp lệ → tạo lô, trangThai tính đúng`
- `create() — hanSuDung quá khứ → SO_LO_EXPIRED`
- `create() — hanSuDung = hôm nay → tạo được`
- `create() — hanSuDung ≤ ngaySX → SO_LO_DATE_INVALID`
- `create() — ngaySX trong tương lai → VALIDATION_FAILED`
- `create() — trùng (hangHoaId, tenLo) khác hoa/thường → SO_LO_NAME_TAKEN; cùng tên khác hàng → OK`
- `create() — hàng không tồn tại → HANG_HOA_NOT_FOUND`
- `findAll() — lọc trangThai=can_date theo điều kiện ngày chứ không theo cột lưu đệm (cột lệch vẫn lọc đúng)`
- `findAll() — conTon=true chỉ lô có TonKho.soLuong > 0`
- `findAll() — hanSuDungFrom/To, hangHoaId, q; sort mặc định hanSuDung tăng`
- `findOne() — tongTon cộng các vị trí; daPhatSinhChungTu đúng`
- `update() — đổi hạn lô chưa có biến động → OK, không cần lyDo`
- `update() — đổi hạn lô đã có biến động không có lyDo → VALIDATION_FAILED`
- `update() — đổi hạn lô đã có biến động có lyDo → OK, ghi nhật ký so_lo.expiry_change`
- `update() — đổi hạn lô đã xuất kho → SO_LO_EXPIRY_LOCKED`
- `update() — đổi tên lô đã có chứng từ → SO_LO_IN_USE`
- `update() — đổi tên trùng lô khác của cùng hàng → SO_LO_NAME_TAKEN`
- `update() — gửi hangHoaId → bị từ chối`
- `remove() — lô chưa phát sinh → xóa; có TonKho/biến động/dòng phiếu → SO_LO_IN_USE`
- `resolveOrCreate() — chưa có → tạo; đã có cùng hạn → dùng lại; đã có khác hạn → SO_LO_DATE_INVALID`
- `assertReceivable()/assertIssuable() — lô hết hạn → SO_LO_EXPIRED; còn dưới ngưỡng tối thiểu → SO_LO_NEAR_EXPIRY; ngưỡng 0 → tắt`
- `refreshExpiryStatuses() — đổi đúng số dòng; chạy lại lần hai đổi 0 dòng`
- `mapper — soNgayConLai âm khi quá hạn; ngày dạng YYYY-MM-DD`
### E2E tests
- Tạo hàng → tạo lô → `GET /so-lo?hangHoaId=` thấy lô, `trangThai` đúng.
- Dựng các lô quá hạn / cận date / còn hạn → lọc `trangThai` đúng; `conTon` đúng sau khi nhập hàng.
- Trùng tên lô cùng hàng → 409.
- Sửa hạn lô có tồn: thiếu `lyDo` → 400; đủ → 200 và có nhật ký; lô đã xuất → 409.
- Xóa lô có tồn → 409; lô trống → 204.
- Chạy job `expiry-scan` rồi kiểm cột `trangThai` trong DB.
- Ma trận role: `KE_TOAN` `POST` → 403; `NHAN_VIEN_KHO` `PATCH` → 403; `QUAN_LY_KHO` `DELETE` → 403.

## 13. Permissions
| Action | ADMIN | QUAN_LY_KHO | NHAN_VIEN_KHO | KE_TOAN |
|---|---|---|---|---|
| list / read | ✓ | ✓ | ✓ | ✓ |
| create | ✓ | ✓ | ✓ | ✗ |
| update (kể cả sửa hạn) | ✓ | ✓ | ✗ | ✗ |
| delete | ✓ | ✗ | ✗ | ✗ |

## 14. Open questions
- **Q-LO-1**: Ngưỡng "cận date" bao nhiêu ngày (đề xuất 90)? Có ngưỡng khác theo loại hàng (ví dụ vắc-xin 30 ngày) không?
- **Q-LO-2**: Có quy định **thời hạn còn lại tối thiểu** khi nhập (ví dụ ≥ 6 tháng hoặc ≥ 2/3 hạn) và khi xuất cho nhà thuốc (ví dụ ≥ 90 ngày)? (`MIN_SHELF_LIFE_DAYS_*`)
- **Q-LO-3**: Cùng một số lô có thể trùng giữa hai nhà sản xuất khác nhau của cùng một hàng? (hiện unique theo hàng + tên lô).
- **Q-LO-4**: Lô hết hạn còn tồn xử lý thế nào — chỉ điều chỉnh tồn về 0 (hủy thuốc) hay cần quy trình/biên bản hủy riêng?
- **Q-LO-5**: Có cho đăng ký lô đã hết hạn trong trường hợp import dữ liệu cũ không?
