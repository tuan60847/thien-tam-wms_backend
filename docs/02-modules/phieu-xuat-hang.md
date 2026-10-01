# Module: phieu-xuat-hang

## 1. Mục đích
- Ghi nhận việc bán/xuất thuốc cho nhà thuốc: lập phiếu → xuất kho (trừ tồn theo lô và vị trí, phát sinh công nợ phải thu) → giao hàng → thu tiền dần. Đảm bảo truy vết lô, không xuất lô hết hạn, không bán cho khách không đủ điều kiện.
- Actors: `NHAN_VIEN_KHO`, `QUAN_LY_KHO`, `ADMIN` (lập, xuất kho, giao hàng, hủy nháp); `QUAN_LY_KHO`, `ADMIN` (hủy sau xuất kho, bán dưới giá tối thiểu); `KE_TOAN` (xem).

## 2. Scope
### In scope
- Tạo/sửa/xóa phiếu nháp kèm dòng (chọn lô + vị trí cụ thể); xuất kho; giao hàng; hủy (nháp và sau xuất kho); tra cứu/lọc.
- Kiểm tra điều kiện khách, hạn dùng lô, tồn, chuỗi lạnh (xe), giá tối thiểu, hạn mức công nợ (nếu chốt).
- Tổng tiền, đã thu, còn nợ, trạng thái thu tiền (tính khi đọc).
- Cảnh báo mềm không theo FEFO.
### Out of scope (phase 2)
- Đơn đặt hàng của khách / báo giá; **giữ chỗ tồn** khi nháp (Q-TK-1); giao một phần / nhiều đợt; **trả hàng, đổi hàng** sau khi giao; hóa đơn VAT/điện tử và chiết khấu; tự động chọn lô (auto-allocate) khi lập phiếu; soạn hàng (picking list) và tối ưu lộ trình; chữ ký xác nhận giao hàng; in phiếu PDF; duyệt nhiều cấp.

## 3. Dependencies
- Cần có trước: [khach-hang.md](khach-hang.md), [so-lo.md](so-lo.md), [ton-kho.md](ton-kho.md), [kho-vi-tri.md](kho-vi-tri.md), [ty-le-quy-doi.md](ty-le-quy-doi.md), [hang-hoa.md](hang-hoa.md), [phuong-tien-van-chuyen.md](phuong-tien-van-chuyen.md); `CodeGeneratorService`, `AuditService`, `ClockService`. Nên có [phieu-nhap-hang.md](phieu-nhap-hang.md) để dựng dữ liệu tồn trong test.
- Được dùng bởi: [phieu-thu-cong-no.md](phieu-thu-cong-no.md), [bao-cao.md](bao-cao.md).
- Thư viện ngoài: không thêm.

## 4. Data model
- Model: `PhieuXuatHang`, `ChiTietPhieuXuatHang` (+ `SoLo`, `TonKho`, `BienDongTonKho`, `PhieuThuCongNo`).
- Trường `PhieuXuatHang`: `maPhieuXuatHang` (`PX` + `yyMMdd` + 4 số), `ngayGiaoHang` (dự kiến), `diaChiGiaoHang`, `trangThai` (`cho_xu_ly | da_xuat_kho | da_giao | da_huy`), `khachHangId`, `createdById`.
- Trường `ChiTietPhieuXuatHang`: `maChiTietPhieuXuatHang` (`<maPhieu>-<nn>`), `soLuong`, `donGia`, `soLoId`.
- **Đề xuất schema (bắt buộc cho module):**
  - P-07: `donViTinh`, `heSoQuyDoi`, `soLuongCoBan` trên dòng.
  - P-08: `viTriId` (FK `ViTri`) trên dòng.
  - P-09: `ghiChu`, `phuongTienVanChuyenId`, `ngayXuatKho`, `xuatKhoById`, `ngayGiaoThucTe`, `huyAt`, `huyById`, `lyDoHuy` trên phiếu.
  - P-02 (`updatedAt`, `updatedById`), P-05 (index `(trangThai, createdAt)`, `(khachHangId)`, `(ngayXuatKho)`), P-18 (CHECK `soLuong > 0`, `donGia >= 0`).
- Dẫn xuất: `thanhTien = soLuong × donGia`; `tongTien = Σ thanhTien`; `daThu = Σ phiếu thu hiệu lực`; `conNo = tongTien − daThu` (khi `da_xuat_kho`/`da_giao`); `trangThaiThu`.
- `ngayGiaoHang` = ngày giao **dự kiến**; `ngayGiaoThucTe` đặt khi giao hàng.

## 5. API endpoints
| Method | Path | Auth | Roles | Mô tả ngắn | DTO request | DTO response |
|---|---|---|---|---|---|---|
| GET | `/api/v1/phieu-xuat-hang` | JWT | mọi role | Danh sách phiếu xuất | `QueryPhieuXuatDto` | `PagedResponse<PhieuXuatListItemDto>` |
| GET | `/api/v1/phieu-xuat-hang/:id` | JWT | mọi role | Chi tiết phiếu + dòng + phiếu thu | — | `PhieuXuatResponseDto` |
| POST | `/api/v1/phieu-xuat-hang` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Lập phiếu xuất (chờ xử lý) | `CreatePhieuXuatDto` | `PhieuXuatResponseDto` (201) |
| PATCH | `/api/v1/phieu-xuat-hang/:id` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Sửa phiếu chờ xử lý (thay toàn bộ dòng nếu gửi `chiTiet`) | `UpdatePhieuXuatDto` | `PhieuXuatResponseDto` |
| DELETE | `/api/v1/phieu-xuat-hang/:id` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Xóa phiếu chờ xử lý | — | 204 |
| POST | `/api/v1/phieu-xuat-hang/:id/xuat-kho` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Xuất kho: trừ tồn, phát sinh công nợ | — | `PhieuXuatResponseDto` |
| POST | `/api/v1/phieu-xuat-hang/:id/giao-hang` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Xác nhận đã giao hàng | `GiaoHangDto` | `PhieuXuatResponseDto` |
| POST | `/api/v1/phieu-xuat-hang/:id/huy` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO* | Hủy phiếu | `HuyPhieuDto` | `PhieuXuatResponseDto` |

\* `NHAN_VIEN_KHO` chỉ hủy phiếu `cho_xu_ly`; hủy phiếu `da_xuat_kho` chỉ `ADMIN`, `QUAN_LY_KHO` (kiểm trong service).

## 6. DTOs
### Request
- `CreatePhieuXuatDto`:
  - `khachHangId: string` (`@IsUUID`)
  - `phuongTienVanChuyenId?: string | null`
  - `ngayGiaoHang?: string | null` (`@IsDateOnly`, dự kiến, không ở quá khứ)
  - `diaChiGiaoHang?: string | null` (`@MaxLength(255)`; mặc định = `khachHang.diaChi`)
  - `ghiChu?: string | null` (`@MaxLength(500)`)
  - `chiTiet?: ChiTietXuatDto[]` (0…200 dòng)
- `ChiTietXuatDto { soLoId: string; viTriId: string; donViTinh: string; soLuong: number; donGia: string }` — `@IsUUID`, `@IsNotEmpty`, `@IsQuantity`, `@IsMoney`.
- `UpdatePhieuXuatDto = PartialType(CreatePhieuXuatDto)`; gửi `chiTiet` ⇒ thay toàn bộ dòng.
- `GiaoHangDto { ngayGiaoThucTe?: string; ghiChu?: string }`.
- `HuyPhieuDto { lyDo: string }` (dùng chung `src/common/dto`).
### Response
- `PhieuXuatListItemDto { id; maPhieuXuatHang; khachHang: { id; maKH; tenKH }; trangThai; ngayGiaoHang; ngayXuatKho; soDong: number; tongTien; daThu; conNo; trangThaiThu: 'chua_thu'|'thu_mot_phan'|'da_thu_du'|null; createdBy; createdAt }`.
- `PhieuXuatResponseDto` = list item + `{ diaChiGiaoHang; ghiChu; phuongTienVanChuyen: { id; bienSo; isXeLanh } | null; ngayGiaoThucTe; xuatKhoBoi; huyAt; huyBoi; lyDoHuy; chiTiet: ChiTietXuatResponseDto[]; thuTien: { id; maPhieuThuCongNo; soTien; ngayThanhToan; daHuy: boolean }[]; updatedAt }`.
- `ChiTietXuatResponseDto { id; maChiTietPhieuXuatHang; soLo: { id; tenLo; hanSuDung; trangThai; hangHoa: { id; maSP; tenSP } }; viTri: { id; tenViTri; kho: { id; tenKho } }; donViTinh; heSoQuyDoi; soLuong; soLuongCoBan; donGia; thanhTien; canhBao: ('KHONG_THEO_FEFO')[] }`. Tiền là chuỗi.
### Query
- `QueryPhieuXuatDto extends PaginationQueryDto { khachHangId?; trangThai?: enum | enum[]; trangThaiThu?: enum; createdById?; createdAtFrom?; createdAtTo?; ngayXuatKhoFrom?; ngayXuatKhoTo?; ngayGiaoHangFrom?; ngayGiaoHangTo?; hangHoaId?; soLoId? }`; `q` trên `maPhieuXuatHang`, `khachHang.tenKH`, `khachHang.maKH`; sort `createdAt`, `ngayXuatKho`, `ngayGiaoHang`, `maPhieuXuatHang`; mặc định `createdAt:desc`.

## 7. Business rules
- BR-01: **Vòng đời:** `cho_xu_ly → da_xuat_kho → da_giao`; `cho_xu_ly → da_huy`; `da_xuat_kho → da_huy`. `da_giao` và `da_huy` là cuối (không hủy phiếu đã giao ở phase 1 — trả hàng nằm ngoài phạm vi). Chuyển trạng thái bằng `updateMany` có điều kiện trạng thái cũ; sai ⇒ `PHIEU_XUAT_INVALID_STATE`.
- BR-02: Chỉ `cho_xu_ly` mới sửa/xóa được.
- BR-03: **Khách đủ điều kiện** (`KhachHangService.assertCanBuy`): hoạt động, GPKD còn hiệu lực — kiểm lúc **lập** và lúc **xuất kho**. Nếu bật hạn mức: `công nợ hiện tại + tổng phiếu ≤ hanMucCongNo` (`KHACH_HANG_CREDIT_EXCEEDED`), `QUAN_LY_KHO`/`ADMIN` được ghi đè kèm lý do (Q-KH-1).
- BR-04: Mỗi dòng: lô tồn tại; `donViTinh` thuộc hàng; `heSoQuyDoi` snapshot; `soLuongCoBan = soLuong × heSoQuyDoi`; `thanhTien = soLuong × donGia`.
- BR-05: **Dòng phải trỏ vào dòng tồn có thật:** tại `viTriId` phải có `TonKho` của lô với `soLuong > 0` (`PHIEU_XUAT_LOT_NOT_AT_LOCATION`); khi lập/sửa kiểm thêm `soLuongCoBan ≤ tồn hiện tại` (`TON_KHO_INSUFFICIENT`) — **chỉ kiểm tra, không giữ chỗ**; kiểm **quyết định** ở bước xuất kho (BR-08).
- BR-06: **Hạn dùng:** lô `het_han` không được đưa vào phiếu (`SO_LO_EXPIRED`); lô dưới ngưỡng hạn tối thiểu khi xuất (`SO_LO_NEAR_EXPIRY`, nếu bật `MIN_SHELF_LIFE_DAYS_ISSUE`). Kiểm lúc **lập** và lúc **xuất kho** (`SoLoService.assertIssuable`, dựa trên `hanSuDung`).
- BR-07: **Giá tối thiểu:** `donGia` quy về đơn vị tính giá của hàng không được thấp hơn `giaToiThieu` (quy đổi theo hệ số: `giaToiThieu × heSo(donViTinh) ÷ heSo(donViTinhGia)`, làm tròn HALF_UP 2 chữ số). Vi phạm với `NHAN_VIEN_KHO` ⇒ `PHIEU_XUAT_PRICE_BELOW_MIN` (message không nêu giá tối thiểu); `QUAN_LY_KHO`/`ADMIN` được phép nhưng ghi `NhatKyHeThong` `phieu_xuat.below_min_price` (dòng, đơn giá, mức tối thiểu). Chỉ kiểm lúc lập/sửa dòng.
- BR-08: **Xuất kho** (một `$transaction`): chuyển trạng thái có điều kiện; kiểm lại BR-03, BR-05, BR-06; với mỗi dòng `TonKhoService.decrease({ loai: 'xuat_kho', thamChieu: { loai: 'phieu_xuat_hang', id } })`; set `ngayXuatKho`, `xuatKhoById`. Thiếu tồn ở bất kỳ dòng nào ⇒ `TON_KHO_INSUFFICIENT` (kèm lô/vị trí trong `details`) và **toàn bộ rollback**. Phiếu 0 dòng ⇒ `PHIEU_XUAT_EMPTY`. Từ đây phát sinh công nợ phải thu.
- BR-09: Không trùng cặp `(soLoId, viTriId)` trong phiếu (`PHIEU_XUAT_DUPLICATE_LINE`).
- BR-10: Phương tiện (nếu chọn): hoạt động; có dòng hàng `isCanGiuLanh` thì phải xe lạnh (`PHUONG_TIEN_NOT_COLD`).
- BR-11: **Giao hàng:** chỉ từ `da_xuat_kho`; `ngayGiaoThucTe` mặc định hôm nay, không ở tương lai, không trước `ngayXuatKho`.
- BR-12: **Hủy phiếu `cho_xu_ly`:** `da_huy`, không đụng tồn, lý do bắt buộc.
- BR-13: **Hủy phiếu `da_xuat_kho`** (chỉ `QUAN_LY_KHO`/`ADMIN`, bắt buộc `lyDo`): trong một transaction hoàn tồn bằng `TonKhoService.increase({ loai: 'huy_xuat', … })` về đúng `viTriId` cũ (bỏ qua kiểm "vị trí đang hoạt động" cho thao tác hoàn tác, vẫn kiểm chuỗi lạnh); phiếu còn **phiếu thu hiệu lực** ⇒ `PHIEU_XUAT_CANNOT_REVERSE` (phải hủy phiếu thu trước). Ghi `NhatKyHeThong` `phieu_xuat.cancel_after_issue`.
- BR-14: **Cảnh báo FEFO (mềm):** dòng dùng lô có hạn **muộn hơn** một lô khác của cùng hàng còn tồn khả dụng ⇒ `canhBao = ['KHONG_THEO_FEFO']` trong response; không chặn.
- BR-15: `diaChiGiaoHang` mặc định lấy `khachHang.diaChi` tại thời điểm lập (snapshot, không đổi theo khách sau đó).
- BR-16: Ghi log sự kiện `phieu_xuat.stock_out`, `phieu_xuat.delivered`, `phieu_xuat.cancelled`.

## 8. Error cases
| Mã lỗi | HTTP | Khi nào | Message (VN) |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | DTO sai | Dữ liệu gửi lên không hợp lệ |
| `PHIEU_XUAT_NOT_FOUND` | 404 | id không tồn tại | Không tìm thấy phiếu xuất hàng |
| `PHIEU_XUAT_INVALID_STATE` | 409 | thao tác sai trạng thái | Phiếu xuất không ở trạng thái cho phép thực hiện thao tác này |
| `PHIEU_XUAT_EMPTY` | 422 | xuất kho phiếu không có dòng | Phiếu xuất chưa có mặt hàng nào |
| `PHIEU_XUAT_DUPLICATE_LINE` | 422 | trùng lô × vị trí | Phiếu có hai dòng trùng lô và vị trí, hãy gộp lại |
| `PHIEU_XUAT_UNIT_INVALID` | 422 | đơn vị không thuộc hàng | Đơn vị tính không hợp lệ cho hàng hóa này |
| `PHIEU_XUAT_PRICE_BELOW_MIN` | 422 | giá thấp hơn mức tối thiểu | Đơn giá thấp hơn mức tối thiểu cho phép |
| `PHIEU_XUAT_LOT_NOT_AT_LOCATION` | 422 | lô không có tồn ở vị trí chọn | Lô này không có hàng tại vị trí đã chọn |
| `PHIEU_XUAT_CANNOT_REVERSE` | 409 | hủy sau xuất kho khi còn phiếu thu | Không thể hủy vì phiếu đã có thu tiền, hãy hủy phiếu thu trước |
| `TON_KHO_INSUFFICIENT` | 409 | không đủ tồn | Số lượng tồn không đủ (còn {conLai}) |
| `SO_LO_EXPIRED` / `SO_LO_NEAR_EXPIRY` / `SO_LO_NOT_FOUND` | 422 / 422 / 404 | lô không hợp lệ | (xem [so-lo.md](so-lo.md)) |
| `KHACH_HANG_NOT_FOUND` / `_INACTIVE` / `_LICENSE_EXPIRED` / `_CREDIT_EXCEEDED` | 404 / 422 | khách không đủ điều kiện | (xem [khach-hang.md](khach-hang.md)) |
| `VI_TRI_NOT_FOUND` | 404 | vị trí không tồn tại | Không tìm thấy vị trí |
| `PHUONG_TIEN_NOT_FOUND` / `_NOT_COLD` / `_INACTIVE` | 404 / 422 | phương tiện không hợp lệ | (xem [phuong-tien-van-chuyen.md](phuong-tien-van-chuyen.md)) |
| `AUTH_FORBIDDEN` | 403 | thiếu quyền (ví dụ N hủy phiếu đã xuất kho) | Bạn không có quyền truy cập |

## 9. Service layer design
`PhieuXuatHangService`:
- `findAll(query: QueryPhieuXuatDto): Promise<PagedResponse<PhieuXuatListItemDto>>`
- `findOne(id: string): Promise<PhieuXuatResponseDto>` — kèm `canhBao` FEFO.
- `create(dto: CreatePhieuXuatDto, actor: AuthenticatedUser): Promise<PhieuXuatResponseDto>` — `$transaction`: sinh mã, kiểm khách/xe, kiểm từng dòng (BR-04…07, 09), tạo.
- `update(id: string, dto: UpdatePhieuXuatDto, actor: AuthenticatedUser): Promise<PhieuXuatResponseDto>` — thay dòng; kiểm lại.
- `remove(id: string, actor: AuthenticatedUser): Promise<void>` — chỉ `cho_xu_ly`.
- `issue(id: string, actor: AuthenticatedUser): Promise<PhieuXuatResponseDto>` — `$transaction` (BR-08).
- `deliver(id: string, dto: GiaoHangDto, actor: AuthenticatedUser): Promise<PhieuXuatResponseDto>`
- `cancel(id: string, dto: HuyPhieuDto, actor: AuthenticatedUser): Promise<PhieuXuatResponseDto>` — `$transaction` (BR-12/13).
- `computeTotals(lines): Decimal`, `minUnitPrice(hangHoa, donViTinh): Decimal` — hàm thuần (`phieu-xuat-hang.rules.ts`).
- `getReceivableSummary(phieuId: string, tx?): Promise<{ tongTien: Decimal; daThu: Decimal; conNo: Decimal }>` — dùng bởi `phieu-thu-cong-no`.
- `findByIdOrThrow(id: string, tx?): Promise<PhieuXuatHang>`.

Transaction: `create`, `update`, `remove`, `issue`, `cancel` (và `deliver` khi ghi) đều trong `$transaction`, truyền cùng `tx` cho `TonKhoService`, `SoLoService`, `CodeGeneratorService`, `AuditService`. Side effects: log sự kiện; nhật ký (hủy, bán dưới giá tối thiểu).

## 10. Controller layer
- 1–1 với service; `@CurrentUser()` là `actor`. Hành động dùng `@HttpCode(200)`.
- Guards: `GET` mọi role; ghi `@Roles(ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO)`; kiểm tinh chỉnh (hủy sau xuất kho, bán dưới giá tối thiểu) trong service theo `actor.role`.

## 11. File layout
```
src/phieu-xuat-hang/
  phieu-xuat-hang.module.ts
  phieu-xuat-hang.controller.ts
  phieu-xuat-hang.service.ts
  phieu-xuat-hang.service.spec.ts
  phieu-xuat-hang.controller.spec.ts
  phieu-xuat-hang.rules.ts       # computeTotals, minUnitPrice, assertTransition, detectFefoWarning
  phieu-xuat-hang.rules.spec.ts
  phieu-xuat-hang.mapper.ts
  phieu-xuat-hang.constants.ts
  dto/
    create-phieu-xuat.dto.ts
    chi-tiet-xuat.dto.ts
    update-phieu-xuat.dto.ts
    giao-hang.dto.ts
    query-phieu-xuat.dto.ts
    phieu-xuat-response.dto.ts
```

## 12. Test plan
### Unit tests
- `create() — khách đủ điều kiện, 2 dòng hợp lệ → phiếu cho_xu_ly, mã PX…0001, mã dòng -01 -02, diaChiGiaoHang = địa chỉ khách, tồn chưa đổi`
- `create() — không có chiTiet → nháp rỗng`
- `create() — khách ngừng hoạt động → KHACH_HANG_INACTIVE`
- `create() — GPKD hết hạn / chưa khai báo → KHACH_HANG_LICENSE_EXPIRED`
- `create() — GPKD hết hạn đúng hôm nay → tạo được`
- `create() — lô hết hạn → SO_LO_EXPIRED`
- `create() — lô dưới ngưỡng hạn tối thiểu (bật cấu hình) → SO_LO_NEAR_EXPIRY`
- `create() — lô không có tồn ở vị trí → PHIEU_XUAT_LOT_NOT_AT_LOCATION`
- `create() — soLuongCoBan vượt tồn hiện tại → TON_KHO_INSUFFICIENT`
- `create() — đơn vị lạ → PHIEU_XUAT_UNIT_INVALID`
- `create() — trùng (lô, vị trí) → PHIEU_XUAT_DUPLICATE_LINE`
- `create() — giá dưới tối thiểu bởi NHAN_VIEN_KHO → PHIEU_XUAT_PRICE_BELOW_MIN, message không lộ giá tối thiểu`
- `create() — giá dưới tối thiểu bởi QUAN_LY_KHO → tạo được, ghi nhật ký phieu_xuat.below_min_price`
- `create() — giá bằng đúng tối thiểu → tạo được`
- `create() — giá theo hộp quy đổi đúng giaToiThieu (donViTinhGia = viên, hộp = 100) → so sánh giaToiThieu × 100`
- `create() — hàng lạnh trên xe thường → PHUONG_TIEN_NOT_COLD`
- `create() — vượt hạn mức công nợ (bật cấu hình) → KHACH_HANG_CREDIT_EXCEEDED; QUAN_LY_KHO ghi đè → OK`
- `create() — dòng dùng lô hạn muộn trong khi lô hạn sớm còn tồn → response có canhBao KHONG_THEO_FEFO`
- `update() — nháp, thay dòng → dòng cũ xóa, kiểm tra lại toàn bộ`
- `update() — đã xuất kho → PHIEU_XUAT_INVALID_STATE`
- `remove() — nháp → xóa; đã xuất kho/đã hủy → PHIEU_XUAT_INVALID_STATE`
- `issue() — hợp lệ → da_xuat_kho, decrease cho từng dòng loai xuat_kho, ngayXuatKho/xuatKhoById set, công nợ = tongTien`
- `issue() — gọi hai lần → lần hai INVALID_STATE, tồn không trừ hai lần`
- `issue() — hai request đồng thời → đúng một thành công`
- `issue() — phiếu rỗng → PHIEU_XUAT_EMPTY`
- `issue() — tồn đã bị người khác xuất bớt giữa lúc lập và lúc xuất → TON_KHO_INSUFFICIENT và rollback toàn bộ (các dòng trước không bị trừ)`
- `issue() — hai phiếu nháp cùng tranh một lô, phiếu thứ hai xuất sau khi hết → TON_KHO_INSUFFICIENT`
- `issue() — lô hết hạn trong lúc chờ → SO_LO_EXPIRED, rollback`
- `issue() — khách bị ngừng hoạt động / hết GPKD sau khi lập → lỗi tương ứng, rollback`
- `deliver() — da_xuat_kho → da_giao, ngayGiaoThucTe mặc định hôm nay`
- `deliver() — ngày trước ngày xuất kho / tương lai → VALIDATION_FAILED hoặc PHIEU_XUAT_INVALID_STATE theo quy ước ngày`
- `deliver() — phiếu cho_xu_ly → PHIEU_XUAT_INVALID_STATE`
- `cancel() — cho_xu_ly bởi NHAN_VIEN_KHO → da_huy, không đụng tồn`
- `cancel() — da_xuat_kho bởi NHAN_VIEN_KHO → AUTH_FORBIDDEN`
- `cancel() — da_xuat_kho bởi QUAN_LY_KHO → increase loai huy_xuat về đúng vị trí cũ, da_huy, nhật ký cancel_after_issue`
- `cancel() — da_xuat_kho, vị trí cũ đã ngừng sử dụng → vẫn hoàn tồn được`
- `cancel() — còn phiếu thu hiệu lực → PHIEU_XUAT_CANNOT_REVERSE`
- `cancel() — da_giao → PHIEU_XUAT_INVALID_STATE`
- `cancel() — thiếu lý do → VALIDATION_FAILED`
- `findAll() — lọc khachHangId, trangThai nhiều giá trị, trangThaiThu, khoảng ngày, hangHoaId, soLoId, q; tongTien/daThu/conNo đúng`
- `findOne() — thuTien kèm daHuy; canhBao FEFO`
- `getReceivableSummary() — bỏ phiếu thu đã hủy`
- `rules.minUnitPrice() — bảng case đơn vị/hệ số và làm tròn`
- `rules.computeTotals() — Decimal chính xác`
- `rules.assertTransition() — bảng chuyển trạng thái`
### E2E tests
- **Luồng đầy đủ:** nhập hàng (2 lô: hạn gần và xa) → `goi-y-xuat` → lập phiếu xuất theo FEFO → xuất kho (tồn giảm, `bien-dong` có `xuat_kho`) → giao hàng → thu tiền một phần (`conNo` đúng) → `doi-soat` không lệch.
- Xuất kho phiếu có lô hết hạn → 422 và tồn nguyên vẹn.
- Hai phiếu nháp tranh cùng tồn: xuất phiếu 1 OK, phiếu 2 → 409 `TON_KHO_INSUFFICIENT`.
- **Đồng thời:** hai request `xuat-kho` cùng một phiếu (`Promise.all`) → một 200, một 409; tồn chỉ giảm một lần.
- Hủy sau xuất kho bởi QL → tồn hoàn; bởi NVK → 403; còn phiếu thu → 409; hủy phiếu thu rồi hủy phiếu xuất → 200.
- Giá dưới tối thiểu: NVK → 422; QL → 201 và có nhật ký.
- Khách ngừng hoạt động / hết GPKD → 422 khi lập.
- Hàng lạnh + xe thường → 422.
- Phân trang + lọc theo khách, trạng thái, trạng thái thu, khoảng ngày xuất kho.
- Ma trận role: `KE_TOAN` `POST` → 403, `GET` → 200; không token → 401.

## 13. Permissions
| Action | ADMIN | QUAN_LY_KHO | NHAN_VIEN_KHO | KE_TOAN |
|---|---|---|---|---|
| list / read | ✓ | ✓ | ✓ | ✓ |
| create / update / delete (chờ xử lý) | ✓ | ✓ | ✓ | ✗ |
| xuất kho / giao hàng | ✓ | ✓ | ✓ | ✗ |
| hủy phiếu chờ xử lý | ✓ | ✓ | ✓ | ✗ |
| hủy phiếu đã xuất kho | ✓ | ✓ | ✗ | ✗ |
| bán dưới giá tối thiểu | ✓ | ✓ | ✗ | ✗ |

## 14. Open questions
- **Q-XUAT-1**: Ai lập phiếu xuất trong thực tế — nhân viên kho hay một vai trò **bán hàng/kinh doanh** riêng (cần thêm role `NHAN_VIEN_BAN_HANG` và tách bước "lập đơn" khỏi "xuất kho")?
- **Q-XUAT-2**: Có cần **giữ chỗ tồn** ngay khi lập/duyệt phiếu (xem Q-TK-1) và bước **soạn hàng** trước khi xuất kho?
- **Q-XUAT-3**: **Trả hàng / đổi hàng** sau khi giao có cần ngay từ đầu không (hiện không hỗ trợ hủy phiếu đã giao)?
- **Q-XUAT-4**: Giá bán lấy từ đâu — nhập tay mỗi dòng (đề xuất), mặc định điền `giaHienThi`, hay có bảng giá theo nhóm khách/chiết khấu?
- **Q-XUAT-5**: Có hóa đơn VAT / chiết khấu / phí vận chuyển trên phiếu xuất, và công nợ tính theo tổng sau thuế?
- **Q-XUAT-6**: Có buộc **FEFO** (chặn khi không theo thứ tự hạn) hay chỉ cảnh báo mềm như đề xuất?
- **Q-XUAT-7**: Thuốc **kiểm soát đặc biệt / kê đơn** có cần thêm điều kiện khi bán (ví dụ khách phải có chứng chỉ riêng, ghi nhận người nhận, báo cáo cơ quan quản lý)?
- **Q-XUAT-8**: Giao hàng có xác nhận (người nhận, chữ ký, ảnh) không, và có giao một phần nhiều đợt không?
- **Q-XUAT-9**: Phiếu xuất có gắn **phương tiện/tài xế** (P-09) không?
