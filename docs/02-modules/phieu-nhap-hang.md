# Module: phieu-nhap-hang

## 1. Mục đích
- Ghi nhận việc nhập thuốc từ nhà cung cấp: lập phiếu nháp → xác nhận nhập kho (hàng lên kệ, tăng tồn theo lô và vị trí) → thanh toán dần cho NCC. Là nguồn tạo ra lô hàng và công nợ phải trả.
- Actors: `NHAN_VIEN_KHO`, `QUAN_LY_KHO`, `ADMIN` (lập, xác nhận, hủy nháp); `QUAN_LY_KHO`, `ADMIN` (hủy phiếu đã nhập kho); `KE_TOAN` (xem).

## 2. Scope
### In scope
- Tạo/sửa/xóa phiếu nháp kèm dòng chi tiết; tạo lô mới ngay trong phiếu; xác nhận nhập kho; hủy (nháp và đã nhập); tra cứu, lọc, in dữ liệu (JSON, chưa PDF).
- Tổng tiền, đã thanh toán, còn nợ, trạng thái thanh toán (tính khi đọc).
### Out of scope (phase 2)
- Đơn đặt hàng (PO) trước khi nhập và đối chiếu PO – phiếu nhập, nhập một phần theo PO; kiểm tra chất lượng khi nhận (QC) và biệt trữ; VAT/chiết khấu/chi phí vận chuyển phân bổ; trả hàng NCC; in phiếu PDF; đính kèm hóa đơn/COA ([file-upload.md](../03-cross-cutting/file-upload.md), M7); duyệt nhiều cấp.

## 3. Dependencies
- Cần có trước: [nha-cung-cap.md](nha-cung-cap.md), [so-lo.md](so-lo.md), [ton-kho.md](ton-kho.md), [kho-vi-tri.md](kho-vi-tri.md), [ty-le-quy-doi.md](ty-le-quy-doi.md), [hang-hoa.md](hang-hoa.md), [phuong-tien-van-chuyen.md](phuong-tien-van-chuyen.md); `CodeGeneratorService`, `AuditService`, `ClockService`.
- Được dùng bởi: [phieu-thanh-toan.md](phieu-thanh-toan.md), [bao-cao.md](bao-cao.md).
- Thư viện ngoài: không thêm.

## 4. Data model
- Model: `PhieuNhapHang`, `ChiTietPhieuNhapHang` (+ liên quan `SoLo`, `TonKho`, `BienDongTonKho`, `PhieuThanhToan`).
- Trường `PhieuNhapHang`: `maPhieuNhapHang` (sinh `PN` + `yyMMdd` + 4 số), `ngayNhanHang`, `trangThai` (`cho_xac_nhan | da_nhap_kho | da_huy`), `nhaCungCapId`, `phuongTienVanChuyenId?`, `createdById`.
- Trường `ChiTietPhieuNhapHang`: `maChiTietPhieuNhapHang` (`<maPhieu>-<nn>`), `soLuong`, `donGia`, `soLoId`.
- **Đề xuất schema (bắt buộc cho module):**
  - P-07: `donViTinh`, `heSoQuyDoi`, `soLuongCoBan` trên dòng.
  - P-08: `viTriId` (FK `ViTri`) trên dòng.
  - P-09: `ghiChu`, `xacNhanAt`, `xacNhanById`, `huyAt`, `huyById`, `lyDoHuy` trên phiếu.
  - P-02: `createdAt` (đổi tên từ `createAt`, P-20), `updatedAt`, `updatedById`.
  - P-05: index `(trangThai, createdAt)`, `(nhaCungCapId)`.
  - P-18: CHECK `soLuong > 0`, `donGia >= 0`.
- Giá trị dẫn xuất (không lưu): `thanhTien = soLuong × donGia`; `tongTien = Σ thanhTien`; `daThanhToan = Σ phiếu thanh toán chưa hủy`; `conNo = tongTien − daThanhToan` (chỉ khi `da_nhap_kho`); `trangThaiThanhToan`.

## 5. API endpoints
| Method | Path | Auth | Roles | Mô tả ngắn | DTO request | DTO response |
|---|---|---|---|---|---|---|
| GET | `/api/v1/phieu-nhap-hang` | JWT | mọi role | Danh sách phiếu nhập | `QueryPhieuNhapDto` | `PagedResponse<PhieuNhapListItemDto>` |
| GET | `/api/v1/phieu-nhap-hang/:id` | JWT | mọi role | Chi tiết phiếu + dòng + thanh toán | — | `PhieuNhapResponseDto` |
| POST | `/api/v1/phieu-nhap-hang` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Lập phiếu nhập (nháp) | `CreatePhieuNhapDto` | `PhieuNhapResponseDto` (201) |
| PATCH | `/api/v1/phieu-nhap-hang/:id` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Sửa phiếu nháp (thay toàn bộ dòng nếu gửi `chiTiet`) | `UpdatePhieuNhapDto` | `PhieuNhapResponseDto` |
| DELETE | `/api/v1/phieu-nhap-hang/:id` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Xóa phiếu nháp | — | 204 |
| POST | `/api/v1/phieu-nhap-hang/:id/xac-nhan` | JWT | ADMIN, QUAN_LY_KHO | Xác nhận nhập kho, tăng tồn | `XacNhanNhapDto` | `PhieuNhapResponseDto` |
| POST | `/api/v1/phieu-nhap-hang/:id/huy` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO* | Hủy phiếu | `HuyPhieuDto` | `PhieuNhapResponseDto` |

\* `NHAN_VIEN_KHO` chỉ hủy phiếu **nháp**; hủy phiếu đã nhập kho chỉ `ADMIN`, `QUAN_LY_KHO` (kiểm trong service).

## 6. DTOs
### Request
- `CreatePhieuNhapDto`:
  - `nhaCungCapId: string` (`@IsUUID`)
  - `phuongTienVanChuyenId?: string | null`
  - `ngayNhanHang?: string | null` (`@IsDateOnly`, dự kiến; thực tế gán lúc xác nhận)
  - `ghiChu?: string | null` (`@MaxLength(500)`)
  - `chiTiet?: ChiTietNhapDto[]` (0…200 dòng; mặc định rỗng)
- `ChiTietNhapDto`:
  - `soLoId?: string` (`@IsUUID`) **hoặc** `soLo?: { hangHoaId: string; tenLo: string; ngaySX?: string | null; hanSuDung: string }` — đúng một trong hai
  - `viTriId: string` (`@IsUUID`)
  - `donViTinh: string` (`@IsNotEmpty`, thuộc đơn vị của hàng)
  - `soLuong: number` (`@IsQuantity`)
  - `donGia: string` (`@IsMoney`, theo `donViTinh` của dòng)
- `UpdatePhieuNhapDto` = `PartialType(CreatePhieuNhapDto)`; nếu gửi `chiTiet` thì **thay toàn bộ** dòng.
- `XacNhanNhapDto { ngayNhanHang?: string; ghiChu?: string }` — `ngayNhanHang` mặc định hôm nay, không ở tương lai.
- `HuyPhieuDto { lyDo: string }` — `@IsNotEmpty @MaxLength(255)`.
### Response
- `PhieuNhapListItemDto { id; maPhieuNhapHang; nhaCungCap: { id; maNCC; tenNCC }; trangThai; ngayNhanHang; soDong: number; tongTien; daThanhToan; conNo; trangThaiThanhToan: 'chua_thanh_toan'|'thanh_toan_mot_phan'|'da_thanh_toan'|null; createdBy: { id; maNV; hoTen } | null; createdAt }`.
- `PhieuNhapResponseDto` = list item + `{ phuongTienVanChuyen: { id; bienSo; isXeLanh } | null; ghiChu; xacNhanAt; xacNhanBoi; huyAt; huyBoi; lyDoHuy; chiTiet: ChiTietNhapResponseDto[]; thanhToan: { id; maPhieuThanhToan; soTien; ngayThanhToan; daHuy: boolean }[]; updatedAt }`.
- `ChiTietNhapResponseDto { id; maChiTietPhieuNhapHang; soLo: { id; tenLo; ngaySX; hanSuDung; trangThai; hangHoa: { id; maSP; tenSP } }; viTri: { id; tenViTri; kho: { id; tenKho } }; donViTinh; heSoQuyDoi; soLuong; soLuongCoBan; donGia; thanhTien }`. Tiền là chuỗi.
### Query
- `QueryPhieuNhapDto extends PaginationQueryDto { nhaCungCapId?; trangThai?: enum | enum[]; trangThaiThanhToan?: enum; createdById?; createdAtFrom?; createdAtTo?; ngayNhanHangFrom?; ngayNhanHangTo?; hangHoaId?: uuid }`; `q` trên `maPhieuNhapHang`, `nhaCungCap.tenNCC`, `nhaCungCap.maNCC`; sort `createdAt`, `ngayNhanHang`, `maPhieuNhapHang`; mặc định `createdAt:desc`.

## 7. Business rules
- BR-01: **Vòng đời:** `cho_xac_nhan → da_nhap_kho` (xác nhận) ; `cho_xac_nhan → da_huy` ; `da_nhap_kho → da_huy` (chỉ khi hoàn tác được, BR-09). `da_huy` là trạng thái cuối. Mọi chuyển trạng thái dùng `updateMany` có điều kiện trạng thái cũ; sai trạng thái ⇒ `PHIEU_NHAP_INVALID_STATE`.
- BR-02: Chỉ phiếu `cho_xac_nhan` mới sửa/xóa được; phiếu đã xác nhận/hủy là bất biến.
- BR-03: **NCC hợp lệ** (`NhaCungCapService.assertCanSupply`): hoạt động, `da_xac_minh`, GPKD & GCN còn hạn — kiểm lúc **lập** và lúc **xác nhận**.
- BR-04: Mỗi dòng: lô tồn tại (hoặc tạo mới qua `resolveOrCreate`), hàng của lô đang kinh doanh (`HANG_HOA_INACTIVE`), lô chưa hết hạn / đạt hạn tối thiểu (`SoLoService.assertReceivable`) — kiểm lúc lập và lúc xác nhận.
- BR-05: Vị trí của dòng phải nhận hàng được (`ViTriService.assertReceivable`); hàng `isCanGiuLanh` phải vào vị trí `isCapDong` (`TON_KHO_COLD_CHAIN_VIOLATION`).
- BR-06: Nếu chọn phương tiện: phải hoạt động; nếu có dòng hàng lạnh thì phải xe lạnh (`PhuongTienService.assertUsable({ requireCold })`).
- BR-07: **Đơn vị & số lượng:** `donViTinh` phải thuộc đơn vị của hàng; `heSoQuyDoi` snapshot; `soLuongCoBan = soLuong × heSoQuyDoi` (kiểm tràn Int); `donGia` theo `donViTinh`; `thanhTien = soLuong × donGia` (chính xác 2 chữ số).
- BR-08: Không trùng cặp `(soLoId, viTriId)` trong cùng phiếu (`PHIEU_NHAP_DUPLICATE_LINE`); nếu hai dòng đều dùng `soLo{…}` cùng `(hangHoaId, tenLo)` và cùng `viTriId` cũng coi là trùng.
- BR-09: **Xác nhận** (một `$transaction`): chuyển trạng thái có điều kiện; kiểm lại BR-03…06; với mỗi dòng gọi `TonKhoService.increase({ loai: 'nhap_kho', thamChieu: { loai: 'phieu_nhap_hang', id } })`; ghi `ngayNhanHang`, `xacNhanAt`, `xacNhanById`. Phiếu 0 dòng ⇒ `PHIEU_NHAP_EMPTY`. `ngayNhanHang` không ở tương lai (`PHIEU_NHAP_DATE_INVALID`).
- BR-10: **Hủy phiếu nháp:** chuyển `da_huy`, ghi lý do; không đụng tồn; lô do phiếu này tạo nếu không còn tham chiếu nào (không `TonKho`, không biến động, không dòng phiếu khác) thì xóa.
- BR-11: **Hủy phiếu đã nhập kho** (chỉ `QUAN_LY_KHO`/`ADMIN`, bắt buộc `lyDo`): trong một transaction, với mỗi dòng gọi `TonKhoService.decrease({ loai: 'huy_nhap', … })` đúng `soLuongCoBan` tại đúng `viTriId`; thiếu tồn (hàng đã xuất/chuyển đi) ⇒ `PHIEU_NHAP_CANNOT_REVERSE` kèm `details` liệt kê dòng thiếu; phiếu còn **phiếu thanh toán chưa hủy** ⇒ `PHIEU_NHAP_CANNOT_REVERSE` (phải hủy thanh toán trước). Ghi `NhatKyHeThong` `phieu_nhap.cancel_after_receipt`.
- BR-12: Mọi bước xác nhận/hủy ghi log sự kiện (`phieu_nhap.confirmed` / `cancelled`); hủy ghi thêm nhật ký.
- BR-13: Danh sách chỉ trả tổng hợp (không dòng); lọc `hangHoaId` tìm phiếu có dòng thuộc hàng đó.

## 8. Error cases
| Mã lỗi | HTTP | Khi nào | Message (VN) |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | DTO sai (thiếu/thừa, XOR `soLoId`/`soLo`) | Dữ liệu gửi lên không hợp lệ |
| `PHIEU_NHAP_NOT_FOUND` | 404 | id không tồn tại | Không tìm thấy phiếu nhập hàng |
| `PHIEU_NHAP_INVALID_STATE` | 409 | thao tác không hợp lệ với trạng thái hiện tại | Phiếu nhập không ở trạng thái cho phép thực hiện thao tác này |
| `PHIEU_NHAP_EMPTY` | 422 | xác nhận phiếu không có dòng | Phiếu nhập chưa có mặt hàng nào |
| `PHIEU_NHAP_DUPLICATE_LINE` | 422 | trùng lô × vị trí | Phiếu có hai dòng trùng lô và vị trí, hãy gộp lại |
| `PHIEU_NHAP_UNIT_INVALID` | 422 | đơn vị tính không thuộc hàng | Đơn vị tính không hợp lệ cho hàng hóa này |
| `PHIEU_NHAP_DATE_INVALID` | 422 | `ngayNhanHang` ở tương lai | Ngày nhận hàng không hợp lệ |
| `PHIEU_NHAP_CANNOT_REVERSE` | 409 | hủy phiếu đã nhập nhưng không hoàn tác được | Không thể hủy vì hàng đã được xuất, chuyển đi hoặc phiếu đã có thanh toán |
| `NHA_CUNG_CAP_NOT_FOUND` / `_NOT_VERIFIED` / `_LICENSE_EXPIRED` / `_INACTIVE` | 404 / 422 | NCC không hợp lệ | (xem [nha-cung-cap.md](nha-cung-cap.md)) |
| `SO_LO_NOT_FOUND` / `SO_LO_EXPIRED` / `SO_LO_NEAR_EXPIRY` / `SO_LO_DATE_INVALID` / `SO_LO_NAME_TAKEN` | 404 / 422 / 409 | lô không hợp lệ | (xem [so-lo.md](so-lo.md)) |
| `HANG_HOA_NOT_FOUND` / `HANG_HOA_INACTIVE` | 404 / 422 | hàng không hợp lệ | (xem [hang-hoa.md](hang-hoa.md)) |
| `VI_TRI_NOT_FOUND` / `VI_TRI_INACTIVE` | 404 / 422 | vị trí không hợp lệ | (xem [kho-vi-tri.md](kho-vi-tri.md)) |
| `TON_KHO_COLD_CHAIN_VIOLATION` | 422 | hàng lạnh vào vị trí thường | Hàng cần bảo quản lạnh chỉ được đặt ở vị trí cấp đông |
| `PHUONG_TIEN_NOT_FOUND` / `_NOT_COLD` / `_INACTIVE` | 404 / 422 | phương tiện không hợp lệ | (xem [phuong-tien-van-chuyen.md](phuong-tien-van-chuyen.md)) |
| `AUTH_FORBIDDEN` | 403 | thiếu quyền (ví dụ N hủy phiếu đã nhập) | Bạn không có quyền truy cập |

## 9. Service layer design
`PhieuNhapHangService`:
- `findAll(query: QueryPhieuNhapDto): Promise<PagedResponse<PhieuNhapListItemDto>>`
- `findOne(id: string): Promise<PhieuNhapResponseDto>`
- `create(dto: CreatePhieuNhapDto, actor: AuthenticatedUser): Promise<PhieuNhapResponseDto>` — `$transaction`: sinh mã, kiểm NCC/xe, `resolveOrCreate` lô, tạo phiếu và dòng.
- `update(id: string, dto: UpdatePhieuNhapDto, actor: AuthenticatedUser): Promise<PhieuNhapResponseDto>` — `$transaction`: khóa trạng thái, thay dòng.
- `remove(id: string, actor: AuthenticatedUser): Promise<void>` — chỉ nháp; dọn lô mồ côi.
- `confirm(id: string, dto: XacNhanNhapDto, actor: AuthenticatedUser): Promise<PhieuNhapResponseDto>` — `$transaction` (BR-09).
- `cancel(id: string, dto: HuyPhieuDto, actor: AuthenticatedUser): Promise<PhieuNhapResponseDto>` — `$transaction` (BR-10/11).
- `computeTotals(lines: { soLuong: number; donGia: Decimal }[]): Decimal` — hàm thuần.
- `getPaymentSummary(phieuId: string, tx?): Promise<{ tongTien: Decimal; daThanhToan: Decimal; conNo: Decimal }>` — dùng bởi `phieu-thanh-toan`.
- `findByIdOrThrow(id: string, tx?): Promise<PhieuNhapHang>` — dùng bởi `phieu-thanh-toan`.

Transaction boundaries: `create`, `update`, `remove`, `confirm`, `cancel` đều trong một `$transaction` (gồm gọi `TonKhoService`, `SoLoService`, `CodeGeneratorService`, `AuditService` với cùng `tx`). Side effects: log sự kiện; nhật ký khi hủy.

## 10. Controller layer
- 1–1 với service; `@CurrentUser()` làm `actor`.
- Guards: `GET` mọi role; ghi `@Roles(ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO)`; kiểm tinh chỉnh ở `cancel` trong service.
- Hành động dùng `@HttpCode(200)` và trả phiếu mới nhất.

## 11. File layout
```
src/phieu-nhap-hang/
  phieu-nhap-hang.module.ts
  phieu-nhap-hang.controller.ts
  phieu-nhap-hang.service.ts
  phieu-nhap-hang.service.spec.ts
  phieu-nhap-hang.controller.spec.ts
  phieu-nhap-hang.rules.ts       # computeTotals, assertEditable, assertTransition (hàm thuần)
  phieu-nhap-hang.rules.spec.ts
  phieu-nhap-hang.mapper.ts
  phieu-nhap-hang.constants.ts   # trạng thái, ngưỡng
  dto/
    create-phieu-nhap.dto.ts
    chi-tiet-nhap.dto.ts
    update-phieu-nhap.dto.ts
    xac-nhan-nhap.dto.ts
    query-phieu-nhap.dto.ts
    phieu-nhap-response.dto.ts
```
(`HuyPhieuDto` dùng chung từ `src/common/dto/huy-phieu.dto.ts`.)

## 12. Test plan
### Unit tests
- `create() — NCC đã xác minh, 2 dòng (1 lô có sẵn, 1 lô mới) → phiếu cho_xac_nhan, mã PN…0001, lô mới được tạo, mã dòng -01 -02, tồn chưa đổi`
- `create() — không có chiTiet → tạo phiếu nháp rỗng`
- `create() — NCC chưa xác minh → NHA_CUNG_CAP_NOT_VERIFIED`
- `create() — NCC giấy phép hết hạn → NHA_CUNG_CAP_LICENSE_EXPIRED`
- `create() — NCC ngừng hoạt động → NHA_CUNG_CAP_INACTIVE`
- `create() — vừa soLoId vừa soLo, hoặc thiếu cả hai → VALIDATION_FAILED`
- `create() — lô hết hạn → SO_LO_EXPIRED`
- `create() — hàng ngừng kinh doanh → HANG_HOA_INACTIVE`
- `create() — vị trí ngừng sử dụng → VI_TRI_INACTIVE`
- `create() — hàng lạnh vào vị trí thường → TON_KHO_COLD_CHAIN_VIOLATION`
- `create() — xe thường chở hàng lạnh → PHUONG_TIEN_NOT_COLD`
- `create() — đơn vị tính lạ → PHIEU_NHAP_UNIT_INVALID`
- `create() — trùng (lô, vị trí) → PHIEU_NHAP_DUPLICATE_LINE`
- `create() — soLo mới trùng (hàng, tên lô) nhưng hạn khác → SO_LO_DATE_INVALID`
- `create() — 201 dòng → VALIDATION_FAILED`
- `create() — quy đổi: 3 hộp (×100) → soLuongCoBan 300, thanhTien = 3 × donGia`
- `create() — soLuongCoBan tràn Int → VALIDATION_FAILED`
- `create() — mã phiếu tăng dần trong ngày và reset sang ngày sau (ClockService giả)`
- `update() — phiếu nháp, đổi NCC và thay toàn bộ dòng → dòng cũ bị xóa, mã dòng mới`
- `update() — chỉ đổi ghiChu (không gửi chiTiet) → dòng giữ nguyên`
- `update() — phiếu đã xác nhận → PHIEU_NHAP_INVALID_STATE`
- `remove() — nháp → xóa phiếu, dòng; xóa lô mồ côi do phiếu tạo, giữ lô đang được dùng`
- `remove() — đã xác nhận / đã hủy → PHIEU_NHAP_INVALID_STATE`
- `confirm() — hợp lệ → da_nhap_kho, TonKhoService.increase gọi cho từng dòng với loai nhap_kho và thamChieu đúng, xacNhanAt/By set`
- `confirm() — gọi hai lần → lần hai PHIEU_NHAP_INVALID_STATE, tồn không tăng gấp đôi`
- `confirm() — hai request đồng thời → đúng một thành công`
- `confirm() — phiếu rỗng → PHIEU_NHAP_EMPTY`
- `confirm() — NCC hết hạn giấy phép sau khi lập → NHA_CUNG_CAP_LICENSE_EXPIRED, trạng thái và tồn không đổi (rollback)`
- `confirm() — lô hết hạn sau khi lập → SO_LO_EXPIRED, rollback toàn bộ`
- `confirm() — lỗi ở dòng thứ 3 → các dòng 1–2 không để lại tồn (rollback)`
- `confirm() — ngayNhanHang tương lai → PHIEU_NHAP_DATE_INVALID`
- `cancel() — nháp, lý do → da_huy, không đụng tồn, dọn lô mồ côi`
- `cancel() — nháp bởi NHAN_VIEN_KHO → OK`
- `cancel() — đã nhập kho bởi NHAN_VIEN_KHO → AUTH_FORBIDDEN`
- `cancel() — đã nhập kho bởi QUAN_LY_KHO, tồn còn nguyên → decrease loai huy_nhap, da_huy, nhật ký cancel_after_receipt`
- `cancel() — đã nhập kho nhưng một phần hàng đã xuất → PHIEU_NHAP_CANNOT_REVERSE, toàn bộ rollback`
- `cancel() — còn phiếu thanh toán chưa hủy → PHIEU_NHAP_CANNOT_REVERSE`
- `cancel() — đã hủy → PHIEU_NHAP_INVALID_STATE`
- `cancel() — thiếu lý do → VALIDATION_FAILED`
- `findAll() — lọc nhaCungCapId, trangThai (nhiều giá trị), khoảng ngày, trangThaiThanhToan, hangHoaId, q; tongTien/daThanhToan/conNo đúng`
- `findOne() — chi tiết kèm dòng, thanhToan, daHuy đánh dấu đúng`
- `getPaymentSummary() — phiếu thanh toán đã hủy không tính vào daThanhToan`
- `computeTotals() — cộng chính xác Decimal (0.1+0.2 → 0.30), rỗng → 0.00`
- `rules.assertTransition() — bảng chuyển trạng thái hợp lệ/không hợp lệ`
### E2E tests
- **Luồng đầy đủ:** admin xác minh NCC → NVK lập phiếu (lô mới, vị trí lạnh cho hàng lạnh) → xác nhận → `GET /ton-kho` có tồn đúng và `bien-dong` có dòng `nhap_kho`; `doi-soat` không lệch.
- Xác nhận hai lần → lần hai 409; tồn không đổi.
- Hủy phiếu nháp (NVK) → 200; hủy phiếu đã nhập (NVK) → 403; (QL) → 200 và tồn về 0 với dòng `huy_nhap`.
- Xuất bớt một phần hàng rồi hủy phiếu nhập → 409 `PHIEU_NHAP_CANNOT_REVERSE`.
- Tạo thanh toán một phần → `conNo` đúng; hủy phiếu nhập bị chặn đến khi hủy thanh toán.
- NCC chưa xác minh → 422; hàng lạnh vào vị trí thường → 422; xe thường cho hàng lạnh → 422.
- Phân trang + lọc theo NCC/khoảng ngày/trạng thái thanh toán.
- Ma trận role: `KE_TOAN` `POST` → 403, `GET` → 200; không token → 401.
- Dữ liệu một dòng nhập: kiểm response `soLuongCoBan`, `thanhTien` (chuỗi 2 chữ số).

## 13. Permissions
| Action | ADMIN | QUAN_LY_KHO | NHAN_VIEN_KHO | KE_TOAN |
|---|---|---|---|---|
| list / read | ✓ | ✓ | ✓ | ✓ |
| create / update / delete (nháp) | ✓ | ✓ | ✓ | ✗ |
| xác nhận nhập kho | ✓ | ✓ | ✗ (đã triển khai: chỉ ADMIN, QUAN_LY_KHO; xem Q-NHAP-2) | ✗ |
| hủy phiếu nháp | ✓ | ✓ | ✓ | ✗ |
| hủy phiếu đã nhập kho | ✓ | ✓ | ✗ | ✗ |

## 14. Open questions
- **Q-NHAP-1**: Có cần **đơn đặt hàng (PO)** trước phiếu nhập, nhập hàng nhiều lần theo một PO? (hiện bỏ qua).
- **Q-NHAP-2**: Có cần bước **duyệt** giữa lập phiếu và xác nhận nhập kho (ví dụ phiếu giá trị lớn phải `QUAN_LY_KHO` xác nhận), hay NVK tự xác nhận như hiện đề xuất?
- **Q-NHAP-3**: Có cần **kiểm tra chất lượng / biệt trữ** khi nhận (hàng chưa kiểm không được xuất)? Nếu có, cần trạng thái lô/vị trí "biệt trữ".
- **Q-NHAP-4**: Có **VAT, chiết khấu, chi phí vận chuyển** trên phiếu nhập không? Công nợ phải trả tính theo tổng sau thuế?
- **Q-NHAP-5**: Phiếu nhập có bắt buộc đính kèm hóa đơn / COA của lô (liên quan file-upload)?
- **Q-NHAP-6**: Hủy phiếu đã nhập kho có cần **duyệt kép** (người đề nghị ≠ người duyệt)?
- **Q-NHAP-7**: Khi sửa phiếu nháp, thay toàn bộ dòng (đề xuất) hay sửa/xóa/thêm từng dòng riêng lẻ qua endpoint dòng?
- **Q-NHAP-8**: Đơn giá nhập có cần đối chiếu/cảnh báo so với `giaNhap` của hàng hóa không (lệch quá X%)?
