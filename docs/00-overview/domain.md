# Bối cảnh nghiệp vụ

## 1. Hệ thống phục vụ ai, làm gì

Thiên Tâm là **nhà phân phối dược phẩm**: nhập thuốc từ nhà cung cấp (NCC), lưu kho, bán sỉ cho các **nhà thuốc** (khách hàng) và theo dõi công nợ hai chiều. WMS backend là hệ thống nghiệp vụ lõi, phục vụ các bài toán:

- Biết **mỗi lô thuốc** đang nằm ở **vị trí nào** của kho, còn bao nhiêu, còn hạn đến khi nào.
- Nhập hàng từ NCC, xuất hàng cho nhà thuốc, **truy vết theo lô** (lô nào đi đâu, lô nào đến từ NCC nào) — yêu cầu tuân thủ ngành dược.
- Tuân thủ điều kiện bảo quản (thuốc cần giữ lạnh chỉ nằm ở vị trí cấp đông/lạnh) và điều kiện kinh doanh (giấy phép của NCC / khách hàng còn hiệu lực).
- Theo dõi **công nợ phải thu** (khách nợ mình) và **phải trả** (mình nợ NCC).
- Cảnh báo **cận date / hết hạn**.

## 2. Actors

| Actor | `maRole` | Làm gì trong hệ thống |
|---|---|---|
| Quản trị viên | `ADMIN` | Toàn quyền: người dùng, danh mục, cấu hình, mọi nghiệp vụ, xóa dữ liệu danh mục chưa phát sinh |
| Quản lý kho | `QUAN_LY_KHO` | Quản lý danh mục kho/hàng, duyệt hủy phiếu đã nhập/xuất, điều chỉnh tồn (kiểm kê), xem báo cáo |
| Nhân viên kho | `NHAN_VIEN_KHO` | Lập và xác nhận phiếu nhập/xuất, chuyển vị trí, tra cứu tồn |
| Kế toán | `KE_TOAN` | Quản lý công nợ (phiếu thu / phiếu thanh toán), xem phiếu và báo cáo tài chính, không đụng vào tồn kho |

Role cố định trong code (`@Roles('ADMIN', ...)`), seed tạo sẵn. Bảng quyền chi tiết: [permissions.md](../03-cross-cutting/permissions.md).

Không có actor "nhân viên bán hàng" và không có cổng khách hàng tự đặt hàng — xem câu hỏi mở trong [open-questions.md](../open-questions.md).

## 3. Các luồng nghiệp vụ chính

### 3.1 Nhập hàng
`Lập phiếu nhập (nháp)` → `Xác nhận nhập kho` (hàng lên kệ: tăng `TonKho`, ghi sổ biến động) → `Thanh toán NCC` (một hoặc nhiều `PhieuThanhToan`). Hủy: phiếu nháp hủy tự do; phiếu đã nhập kho chỉ hủy được khi tồn còn nguyên để hoàn tác.

### 3.2 Xuất hàng
`Lập phiếu xuất (chờ xử lý)` → `Xuất kho` (trừ `TonKho`, phát sinh công nợ phải thu) → `Giao hàng` → `Thu công nợ` (một hoặc nhiều `PhieuThuCongNo`). Chọn lô theo **FEFO** (hết hạn trước, xuất trước).

### 3.3 Kiểm soát lô & hạn dùng
Mỗi dòng nhập/xuất gắn một `SoLo`. Lô có `hanSuDung`; trạng thái `con_han` / `can_date` / `het_han` suy ra từ hạn. Lô hết hạn không được xuất; lô cận date được cảnh báo ở báo cáo.

### 3.4 Công nợ
- Phải thu = tổng tiền các phiếu xuất đã xuất kho − tổng phiếu thu chưa hủy.
- Phải trả = tổng tiền các phiếu nhập đã nhập kho − tổng phiếu thanh toán chưa hủy.
- Aging theo tuổi nợ (0–30, 31–60, 61–90, >90 ngày).

### 3.5 Kiểm kê & chuyển vị trí
Điều chỉnh tồn có lý do (kiểm kê lệch, hao hụt, hỏng vỡ) và chuyển lô giữa các vị trí; mọi thay đổi ghi vào sổ biến động tồn kho để truy vết.

## 4. Bảng thuật ngữ (VN → EN)

| Thuật ngữ | Giải thích (EN) | Model / field |
|---|---|---|
| Nhà phân phối | Distributor — the company running this system | — |
| Nhà thuốc | Pharmacy; the customer who buys from the distributor | `KhachHang` |
| Nhà cung cấp (NCC) | Supplier / manufacturer / upstream distributor | `NhaCungCap` |
| Hàng hóa | Product / SKU (a drug) | `HangHoa` |
| Loại hàng | Product category | `LoaiHang` |
| Quy cách | Packaging description (e.g. "hộp 10 vỉ × 10 viên") | `HangHoa.quyCach` |
| Tỷ lệ quy đổi | Unit conversion ratio to the smallest unit | `TyLeQuyDoi` |
| Đơn vị cơ bản / nhỏ nhất | Base unit (viên, ống, chai…), `soLuongQuyDoi = 1` | `TyLeQuyDoi` |
| Số lô | Manufacturing batch / lot | `SoLo` |
| Hạn sử dụng (HSD) | Expiry date | `SoLo.hanSuDung` |
| Cận date | Near expiry (within the warning window) | `SoLo.trangThai = can_date` |
| Hết hạn | Expired | `het_han` |
| FEFO | First-Expired-First-Out picking rule | — |
| Kho | Warehouse | `Kho` |
| Vị trí | Storage location (shelf / bin / cold room) inside a warehouse | `ViTri` |
| Cấp đông / bảo quản lạnh | Cold storage | `ViTri.isCapDong`, `HangHoa.isCanGiuLanh` |
| Tồn kho | Stock on hand per (lot × location) | `TonKho` |
| Phiếu nhập hàng | Goods receipt / inbound document | `PhieuNhapHang` |
| Phiếu xuất hàng | Goods issue / outbound document / delivery order | `PhieuXuatHang` |
| Chi tiết phiếu | Document line item | `ChiTietPhieuNhapHang`, `ChiTietPhieuXuatHang` |
| Phiếu thu công nợ | Receipt voucher for money collected from a customer | `PhieuThuCongNo` |
| Phiếu thanh toán | Payment voucher for money paid to a supplier | `PhieuThanhToan` |
| Công nợ phải thu | Accounts receivable (AR) | derived |
| Công nợ phải trả | Accounts payable (AP) | derived |
| Thuốc kê đơn | Prescription-only drug | `HangHoa.isKeDon` |
| Loại kiểm soát | Control class: thường / kê đơn / kiểm soát đặc biệt | `HangHoa.loaiKiemSoat` |
| Số đăng ký | Drug marketing authorisation number | `HangHoa.soDangKy` |
| Giấy phép kinh doanh (GPKD) | Business licence | `soGiayPhepKinhDoanh` … |
| GCN đủ điều kiện kinh doanh dược | Pharmaceutical business eligibility certificate (GDP/GPP-type) | `soGCNDuDieuKienKinhDoanhDuoc` |
| Mã số thuế (MST) | Tax code | `KhachHang.maSoThue` |
| Mã nhân viên (NV) | Employee code | `User.maNV` |
| Giá nhập / giá hiển thị / giá tối thiểu | Purchase price / list price / floor price | `HangHoa.giaNhap` … |
| Xác minh NCC | Supplier verification (licences checked) | `NhaCungCap.trangThaiXacMinh` |
| Hủy phiếu | Void / cancel a document | `trangThai = da_huy` |
| Điều chỉnh tồn | Stock adjustment (cycle count / write-off) | module `ton-kho` |
