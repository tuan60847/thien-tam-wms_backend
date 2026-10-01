# Module: bao-cao

Module **chỉ đọc**: không ghi bất kỳ bảng nào, không có transaction ghi. Tổng hợp dữ liệu từ các module khác bằng truy vấn đọc Prisma (`groupBy`, `aggregate`, `$queryRaw` tham số hóa).

## 1. Mục đích
- Cung cấp báo cáo vận hành và tài chính: tồn kho (kèm giá trị), cảnh báo cận date / hết hạn, nhập–xuất–tồn theo kỳ, doanh thu, hàng bán chạy, công nợ phải thu / phải trả theo tuổi nợ.
- Actors: `ADMIN`, `QUAN_LY_KHO`, `KE_TOAN` (tất cả báo cáo); `NHAN_VIEN_KHO` (chỉ báo cáo tồn kho, cận date, hết hạn — không thấy giá vốn/giá trị).

## 2. Scope
### In scope
- 9 báo cáo ở §5, trả JSON, có tham số kỳ báo cáo, múi giờ VN.
- Phân quyền theo báo cáo và ẩn trường giá trị với `NHAN_VIEN_KHO`.
### Out of scope (phase 2)
- Xuất file (`.xlsx`/`.csv`/PDF) — cần `exceljs` (Q-BC-1); lịch gửi báo cáo định kỳ qua email; dashboard biểu đồ (frontend); **giá vốn hàng bán và lợi nhuận gộp** (Q-BC-3); dự báo nhu cầu, tồn tối thiểu/đặt hàng lại; báo cáo gửi cơ quan quản lý dược (mẫu biểu theo quy định); snapshot tồn theo ngày lịch sử (chỉ có tồn hiện tại và tồn lịch sử dựng từ sổ biến động trong báo cáo nhập–xuất–tồn); cache báo cáo.

## 3. Dependencies
- Cần có trước: `ton-kho` (tồn + sổ biến động), `so-lo`, `hang-hoa`, `kho-vi-tri`, `phieu-nhap-hang`, `phieu-xuat-hang`, `phieu-thanh-toan`, `phieu-thu-cong-no`, `khach-hang`, `nha-cung-cap`, `ClockService`.
- Thư viện ngoài: không thêm ở phase 1 (`exceljs` khi làm xuất Excel).

## 4. Data model
- Không có model riêng. Đọc: `TonKho`, `BienDongTonKho`, `SoLo`, `HangHoa`, `LoaiHang`, `Kho`, `ViTri`, `PhieuNhapHang`/`ChiTiet…`, `PhieuXuatHang`/`ChiTiet…`, `PhieuThanhToan`, `PhieuThuCongNo`, `KhachHang`, `NhaCungCap`, `User`.
- Dựa vào các trường đề xuất: `PhieuXuatHang.ngayXuatKho`, `PhieuNhapHang.xacNhanAt`/`ngayNhanHang`, `huyAt` của phiếu và phiếu thu/thanh toán, `soLuongCoBan` và `heSoQuyDoi` trên dòng (P-07, P-09, P-10), index (P-05).
- **Giá vốn lô** (dùng để tính giá trị tồn): `giaVonCoBan(lô) = Σ thanhTien ÷ Σ soLuongCoBan` trên các dòng của phiếu nhập `da_nhap_kho` của lô đó (bình quân gia quyền theo lô). Tính bằng `Decimal` đủ độ chính xác, làm tròn 2 chữ số **chỉ ở kết quả cuối**.

## 5. API endpoints
| Method | Path | Auth | Roles | Mô tả ngắn | DTO request | DTO response |
|---|---|---|---|---|---|---|
| GET | `/api/v1/bao-cao/ton-kho` | JWT | mọi role | Tồn kho hiện tại, nhóm theo hàng / kho / loại hàng | `BaoCaoTonKhoQueryDto` | `BaoCaoTonKhoResponseDto` |
| GET | `/api/v1/bao-cao/ton-kho/theo-lo` | JWT | mọi role | Tồn theo từng lô kèm hạn dùng | `BaoCaoTheoLoQueryDto` | `PagedResponse<BaoCaoTheoLoItemDto>` |
| GET | `/api/v1/bao-cao/can-date` | JWT | mọi role | Lô sắp hết hạn còn tồn | `BaoCaoCanDateQueryDto` | `PagedResponse<BaoCaoHanDungItemDto>` |
| GET | `/api/v1/bao-cao/het-han` | JWT | mọi role | Lô đã hết hạn còn tồn | `BaoCaoHetHanQueryDto` | `PagedResponse<BaoCaoHanDungItemDto>` |
| GET | `/api/v1/bao-cao/nhap-xuat-ton` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Nhập–xuất–tồn theo kỳ | `BaoCaoNhapXuatTonQueryDto` | `BaoCaoNhapXuatTonResponseDto` |
| GET | `/api/v1/bao-cao/doanh-thu` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Doanh thu theo kỳ và nhóm | `BaoCaoDoanhThuQueryDto` | `BaoCaoDoanhThuResponseDto` |
| GET | `/api/v1/bao-cao/top-ban-chay` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Hàng bán chạy | `BaoCaoTopBanChayQueryDto` | `BaoCaoTopBanChayResponseDto` |
| GET | `/api/v1/bao-cao/cong-no-phai-thu` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Công nợ phải thu theo tuổi nợ | `BaoCaoCongNoQueryDto` | `BaoCaoCongNoPhaiThuResponseDto` |
| GET | `/api/v1/bao-cao/cong-no-phai-tra` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Công nợ phải trả theo tuổi nợ | `BaoCaoCongNoQueryDto` | `BaoCaoCongNoPhaiTraResponseDto` |

## 6. DTOs
Mọi tham số ngày: `YYYY-MM-DD` theo lịch Việt Nam (`@IsDateOnly`). Mọi response có `generatedAt` (ISO) và, với báo cáo theo kỳ, `kyBaoCao: { tuNgay, denNgay }`. Tiền là chuỗi 2 chữ số. Số lượng theo đơn vị cơ bản kèm `donViCoBan`.

### Query
- `BaoCaoTonKhoQueryDto { groupBy?: 'hang-hoa' | 'kho' | 'loai-hang' (mặc định hang-hoa); khoId?; loaiHangId?; hangHoaId?; isCanGiuLanh?: boolean; chiConTon?: boolean (mặc định true) }`.
- `BaoCaoTheoLoQueryDto extends PaginationQueryDto { khoId?; hangHoaId?; trangThaiLo?: enum; conTon?: boolean (mặc định true) }`; sort `hanSuDung`, `tenSP`, `giaTri`; mặc định `hanSuDung:asc`.
- `BaoCaoCanDateQueryDto extends PaginationQueryDto { soNgay?: number (1…365, mặc định EXPIRY_WARNING_DAYS); khoId?; hangHoaId?; loaiHangId? }`; sort `hanSuDung`; mặc định `hanSuDung:asc`.
- `BaoCaoHetHanQueryDto extends PaginationQueryDto { khoId?; hangHoaId?; loaiHangId? }`; mặc định `hanSuDung:desc`.
- `BaoCaoNhapXuatTonQueryDto { tuNgay: date; denNgay: date; khoId?; loaiHangId?; hangHoaId? }` (≤ 366 ngày).
- `BaoCaoDoanhThuQueryDto { tuNgay: date; denNgay: date; groupBy?: 'ngay' | 'thang' | 'khach-hang' | 'hang-hoa' | 'nguoi-tao' (mặc định ngay); khachHangId?; hangHoaId?; loaiHangId?; createdById? }` (≤ 366 ngày).
- `BaoCaoTopBanChayQueryDto { tuNgay: date; denNgay: date; tieuChi?: 'doanh-thu' | 'so-luong' (mặc định doanh-thu); limit?: number (1…50, mặc định 10); loaiHangId? }`.
- `BaoCaoCongNoQueryDto { denNgay?: date (mặc định hôm nay); khachHangId? / nhaCungCapId?; chiConNo?: boolean (mặc định true) }`.

### Response (rút gọn hình dạng chính)
- `BaoCaoTonKhoResponseDto { items: { nhom: { id; ten; ma? }; tongTon; tonKhaDung; tonCanDate; tonHetHan; soLo; giaTriTon?: string }[]; tong: { tongTon; giaTriTon?: string }; generatedAt }`.
- `BaoCaoTheoLoItemDto { soLo: { id; tenLo; hanSuDung; trangThai; soNgayConLai }; hangHoa: { id; maSP; tenSP; donViCoBan }; viTri: { id; tenViTri; kho: { id; tenKho } }; soLuong; giaVonCoBan?: string; giaTri?: string }`.
- `BaoCaoHanDungItemDto` = như trên (một dòng mỗi lô × vị trí) + `giaTri?`; kèm `tong: { soLo; tongSoLuong; tongGiaTri? }` trong `meta`.
- `BaoCaoNhapXuatTonResponseDto { items: { hangHoa: { id; maSP; tenSP; donViCoBan }; tonDau; nhap; xuat; huyNhap; huyXuat; dieuChinh; chuyenRong; tonCuoi }[]; tong: {…}; kyBaoCao; generatedAt }` — bất biến: `tonCuoi = tonDau + nhap + xuat(âm) + huyNhap(âm) + huyXuat + dieuChinh + chuyenRong` theo dấu của sổ biến động.
- `BaoCaoDoanhThuResponseDto { items: { nhom: { khoa: string; ten: string }; soPhieu; soLuongCoBan; doanhThu: string }[]; tong: { soPhieu; soLuongCoBan; doanhThu }; groupBy; kyBaoCao; generatedAt }`.
- `BaoCaoTopBanChayResponseDto { items: { hang: 1…limit; hangHoa; soLuongCoBan; doanhThu: string; soPhieu }[]; kyBaoCao; generatedAt }`.
- `BaoCaoCongNoPhaiThuResponseDto { items: { khachHang: { id; maKH; tenKH }; nhom0_30; nhom31_60; nhom61_90; nhomTren90; tongConNo: string; soPhieuConNo }[]; tong: {…}; denNgay; generatedAt }` (phải trả: tương tự với `nhaCungCap`).

## 7. Business rules
- BR-01: **Mốc ngày theo giờ VN:** `tuNgay`…`denNgay` bao gồm cả hai đầu; quy đổi sang `[00:00 VN của tuNgay, 00:00 VN của ngày sau denNgay)` UTC.
- BR-02: `tuNgay ≤ denNgay` (`BAO_CAO_RANGE_INVALID`); khoảng tối đa 366 ngày (`BAO_CAO_RANGE_TOO_LARGE`).
- BR-03: **Doanh thu** = Σ `thanhTien` các dòng của phiếu xuất ở trạng thái `da_xuat_kho` hoặc `da_giao`, tính theo **ngày xuất kho**; phiếu `cho_xu_ly` và `da_huy` bị loại. Phiếu bị hủy sau khi xuất kho (đã `da_huy`) bị loại khỏi mọi kỳ.
- BR-04: **Nhập–xuất–tồn** dựng từ `BienDongTonKho`: `tonDau(D)` = Σ `soLuongThayDoi` có `createdAt < đầu kỳ`; các cột trong kỳ nhóm theo `loai`; `tonCuoi` = `tonDau` + Σ trong kỳ. Hàng không phát sinh và tồn đầu = 0 bị bỏ khỏi báo cáo. Lọc `khoId` ⇒ chuyển vị trí giữa hai kho hiện ra ở `chuyenRong`.
- BR-05: **Tồn khả dụng** = tồn các lô chưa hết hạn tại ngày hiện hành; `tonCanDate` ⊂ `tonKhaDung`; `tonHetHan` tính riêng. Phân loại dựa vào `hanSuDung` và `EXPIRY_WARNING_DAYS`, không dựa cột `SoLo.trangThai`.
- BR-06: **Cận date**: lô còn tồn với `hôm nay ≤ hanSuDung ≤ hôm nay + soNgay`; **hết hạn**: lô còn tồn với `hanSuDung < hôm nay`. Chỉ dòng `TonKho.soLuong > 0`.
- BR-07: **Giá trị tồn** = Σ `soLuong × giaVonCoBan(lô)`. Lô chưa có phiếu nhập `da_nhap_kho` (ví dụ tồn do điều chỉnh) có `giaVonCoBan = null` và **không** được tính vào giá trị (hiển thị cờ `thieuGiaVon`).
- BR-08: **Công nợ tại ngày D** (`denNgay`): phiếu xuất tính nếu `ngayXuatKho ≤ D` và (`huyAt IS NULL` hoặc `huyAt > D`); khoản thu tính nếu `ngayThanhToan ≤ D` và (`huyAt IS NULL` hoặc `huyAt > D`). Tuổi nợ = `D − ngày xuất kho`. Nhóm `0-30`, `31-60`, `61-90`, `>90`. Công nợ phải trả: tương tự với phiếu nhập (ngày = ngày nhận hàng) và phiếu thanh toán.
- BR-09: Trường giá vốn/giá trị (`giaVonCoBan`, `giaTri`, `giaTriTon`, `thieuGiaVon`) **không có** trong response khi người xem là `NHAN_VIEN_KHO` (mapper theo role).
- BR-10: Danh sách (theo lô, cận date, hết hạn) phân trang chuẩn; báo cáo tổng hợp trả tối đa 1.000 nhóm, vượt thì `VALIDATION_FAILED` yêu cầu thu hẹp bộ lọc.
- BR-11: Mọi báo cáo là ảnh chụp tại thời điểm truy vấn (nhiều truy vấn đọc, không đảm bảo nhất quán tuyệt đối khi đang có giao dịch); đủ cho phase 1. Không cache.
- BR-12: Truy vấn thô chỉ qua `$queryRaw` dạng template tham số hóa.

## 8. Error cases
| Mã lỗi | HTTP | Khi nào | Message (VN) |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | tham số sai / thiếu `tuNgay`,`denNgay` / quá 1.000 nhóm | Dữ liệu gửi lên không hợp lệ |
| `BAO_CAO_RANGE_INVALID` | 422 | `tuNgay` sau `denNgay` | Khoảng thời gian báo cáo không hợp lệ |
| `BAO_CAO_RANGE_TOO_LARGE` | 422 | kỳ báo cáo quá 366 ngày | Khoảng thời gian báo cáo tối đa là 366 ngày |
| `AUTH_FORBIDDEN` | 403 | `NHAN_VIEN_KHO` gọi báo cáo tài chính | Bạn không có quyền truy cập |

## 9. Service layer design
`BaoCaoService` (không ghi, không `tx`):
- `tonKho(query, viewer): Promise<BaoCaoTonKhoResponseDto>`
- `tonKhoTheoLo(query, viewer): Promise<PagedResponse<BaoCaoTheoLoItemDto>>`
- `canDate(query, viewer): Promise<PagedResponse<BaoCaoHanDungItemDto>>`
- `hetHan(query, viewer): Promise<PagedResponse<BaoCaoHanDungItemDto>>`
- `nhapXuatTon(query): Promise<BaoCaoNhapXuatTonResponseDto>`
- `doanhThu(query): Promise<BaoCaoDoanhThuResponseDto>`
- `topBanChay(query): Promise<BaoCaoTopBanChayResponseDto>`
- `congNoPhaiThu(query): Promise<BaoCaoCongNoPhaiThuResponseDto>`
- `congNoPhaiTra(query): Promise<BaoCaoCongNoPhaiTraResponseDto>`

Hàm thuần (`bao-cao.rules.ts`): `toUtcRange(tuNgay, denNgay)`, `assertRange(tuNgay, denNgay)`, `ageBucket(days)`, `classifyLot(hanSuDung, today, warningDays)`, `maskForViewer(item, role)`, `computeLotCost(lines)`, `checkNxtIdentity(row)`.

Transaction: không. Side effects: không; log thời gian chạy mỗi báo cáo (mức info) để phát hiện truy vấn chậm.

## 10. Controller layer
- `BaoCaoController` map 1–1. Guards: các báo cáo tồn/cận date/hết hạn không `@Roles` (mọi role); còn lại `@Roles(ADMIN, QUAN_LY_KHO, KE_TOAN)`. `@CurrentUser()` truyền `viewer`.
- Interceptor ghi thời gian truy vấn (dùng log chung).

## 11. File layout
```
src/bao-cao/
  bao-cao.module.ts
  bao-cao.controller.ts
  bao-cao.service.ts
  bao-cao.service.spec.ts
  bao-cao.controller.spec.ts
  bao-cao.rules.ts
  bao-cao.rules.spec.ts
  bao-cao.mapper.ts
  queries/                         # mỗi báo cáo một file truy vấn (groupBy / $queryRaw)
    ton-kho.query.ts
    nhap-xuat-ton.query.ts
    doanh-thu.query.ts
    cong-no.query.ts
  dto/
    bao-cao-ton-kho-query.dto.ts
    bao-cao-theo-lo-query.dto.ts
    bao-cao-can-date-query.dto.ts
    bao-cao-het-han-query.dto.ts
    bao-cao-nhap-xuat-ton-query.dto.ts
    bao-cao-doanh-thu-query.dto.ts
    bao-cao-top-ban-chay-query.dto.ts
    bao-cao-cong-no-query.dto.ts
    bao-cao-response.dto.ts
```

## 12. Test plan
Chiến lược: phần **logic thuần** kiểm bằng unit test; phần **đúng sai của tổng hợp SQL** kiểm bằng e2e trên DB thật với bộ dữ liệu nhỏ có đáp án tính tay (mock Prisma cho truy vấn tổng hợp không chứng minh được gì).
### Unit tests
- `toUtcRange() — 2026-10-01 → 2026-10-01T00:00+07 = 2026-09-30T17:00Z; denNgay bao gồm cả ngày cuối`
- `assertRange() — tuNgay > denNgay → BAO_CAO_RANGE_INVALID; 367 ngày → BAO_CAO_RANGE_TOO_LARGE; đúng 366 ngày → OK`
- `ageBucket() — biên 0, 30, 31, 60, 61, 90, 91 ngày`
- `classifyLot() — hôm qua → het_han; hôm nay → can_date; hôm nay + warningDays → can_date; +1 → con_han`
- `computeLotCost() — bình quân gia quyền nhiều lần nhập; lô chưa nhập → null; chia số lẻ không làm tròn giữa chừng`
- `maskForViewer() — NHAN_VIEN_KHO bỏ giaVonCoBan/giaTri/giaTriTon/thieuGiaVon; role khác giữ`
- `checkNxtIdentity() — hàng đủ cột thì tonCuoi khớp công thức; cố ý lệch → false`
- `BaoCaoService.tonKho() — gọi truy vấn đúng nhóm theo groupBy, truyền viewer cho mapper` (kiểm tương tác, không kiểm số liệu)
- `BaoCaoService.* — tham số sai (thiếu tuNgay) → VALIDATION_FAILED; vượt 1.000 nhóm → VALIDATION_FAILED`
- `BaoCaoController — metadata @Roles đúng từng route (tồn kho/cận date/hết hạn không giới hạn role; còn lại ADMIN/QL/KT)`
### E2E tests (dữ liệu có đáp án tính tay)
- Dựng: 2 hàng, 3 lô (quá hạn, cận date, còn xa), 2 vị trí, 2 lần nhập giá khác nhau cho một lô; 2 khách; vài phiếu xuất/thu/hủy; vài NCC/phiếu nhập/thanh toán.
- `ton-kho`: tổng theo hàng/kho/loại đúng; `tonKhaDung` loại lô quá hạn; `giaTriTon` khớp bình quân gia quyền tính tay; lô điều chỉnh không giá vốn có `thieuGiaVon`.
- `ton-kho/theo-lo`: số dòng, sắp xếp, lọc `conTon`, phân trang.
- `can-date` với `soNgay` khác nhau; `het-han` chỉ lô quá hạn còn tồn; lô quá hạn đã điều chỉnh về 0 biến mất.
- `nhap-xuat-ton`: `tonDau + biến động = tonCuoi` cho từng hàng; kỳ không phát sinh; bất biến khớp `GET /ton-kho` tại ngày cuối kỳ (kỳ kết thúc hôm nay); chuyển vị trí hiện `chuyenRong` khi lọc kho.
- `doanh-thu`: loại phiếu chờ xử lý và phiếu hủy; phiếu xuất ở ranh giới ngày (23:30 VN) rơi đúng ngày; các `groupBy` cùng tổng.
- `top-ban-chay`: xếp hạng theo `doanh-thu` và `so-luong` khác nhau khi dữ liệu thiết kế khác nhau; `limit`.
- `cong-no-phai-thu`: nhóm tuổi nợ đúng; `denNgay` trong quá khứ loại phiếu xuất sau ngày đó và tính lại khoản thu/hủy đúng thời điểm; khớp `GET /khach-hang/:id/cong-no` khi `denNgay` = hôm nay; `cong-no-phai-tra` tương tự.
- `NHAN_VIEN_KHO`: `ton-kho` 200 nhưng không có trường giá trị; `doanh-thu` → 403; `KE_TOAN` đủ quyền; không token → 401.
- Kỳ báo cáo sai → 422; thiếu tham số → 400.

## 13. Permissions
| Báo cáo | ADMIN | QUAN_LY_KHO | NHAN_VIEN_KHO | KE_TOAN |
|---|---|---|---|---|
| ton-kho, ton-kho/theo-lo, can-date, het-han | ✓ | ✓ | ✓ (không giá trị) | ✓ |
| nhap-xuat-ton | ✓ | ✓ | ✗ | ✓ |
| doanh-thu, top-ban-chay | ✓ | ✓ | ✗ | ✓ |
| cong-no-phai-thu, cong-no-phai-tra | ✓ | ✓ | ✗ | ✓ |

## 14. Open questions
- **Q-BC-1**: Báo cáo có cần xuất **Excel/CSV/PDF** không, và mẫu biểu cụ thể (đặc biệt mẫu báo cáo gửi cơ quan quản lý dược)?
- **Q-BC-2**: Mốc tính **tuổi nợ**: từ ngày xuất kho (đề xuất), ngày giao hàng, hay ngày đến hạn theo điều khoản thanh toán (cần dữ liệu hạn thanh toán — Q-KH-1, Q-NCC-4)?
- **Q-BC-3**: Có cần **giá vốn hàng bán / lợi nhuận gộp**? Nếu có, chọn phương pháp giá vốn (bình quân gia quyền theo lô như giá trị tồn hiện tại, FIFO, bình quân di động toàn kho) vì kết quả khác nhau.
- **Q-BC-4**: Doanh thu tính trước hay sau VAT/chiết khấu (liên quan Q-XUAT-5)? Mốc ghi nhận doanh thu: ngày xuất kho (đề xuất) hay ngày giao hàng?
- **Q-BC-5**: Cần báo cáo nào khác: tồn tối thiểu/sắp hết hàng, hàng chậm luân chuyển, thuốc kiểm soát đặc biệt (xuất–nhập–tồn riêng), truy vết lô (lô X từ NCC nào, bán cho khách nào), doanh số theo nhân viên?
- **Q-BC-6**: Có cần xem **tồn tại một ngày trong quá khứ** (snapshot) theo kho/lô — hiện chỉ dựng được tổng theo hàng trong báo cáo nhập–xuất–tồn?
