# Ghi chú schema

Tài liệu này (1) ghi bất biến/ràng buộc nghiệp vụ theo từng bảng, (2) **gom mọi đề xuất thay đổi schema** vào một danh mục có mã `P-xx` để các module tham chiếu. **Không có thay đổi nào được áp dụng**; việc áp dụng nằm ở M0 (nền tảng chung) và từng milestone, theo [migrations-policy.md](migrations-policy.md).

## 1. Danh mục đề xuất thay đổi schema

| Mã | Đề xuất | Lý do | Milestone | Module dùng |
|---|---|---|---|---|
| P-01 | Chuyển các cột trạng thái `String` sang `enum` Prisma (danh sách ở §2) | Chặn giá trị rác ở DB, type-safe | M0 | tất cả |
| P-02 | Thêm audit field chung (§3) | Truy vết ai/khi nào | M0 | tất cả |
| P-03 | Thêm `trangThai Boolean @default(true)` cho `LoaiHang`, `HangHoa`, `Kho`, `ViTri`, `PhuongTienVanChuyen`, `NhaCungCap` | Vô hiệu hóa thay vì xóa | M0 | danh mục |
| P-04 | Unique: `LoaiHang.tenLoaiHang`, `Kho.tenKho`, `@@unique([khoId, tenViTri])` trên `ViTri`, `@@unique([hangHoaId, donViTinh])` trên `TyLeQuyDoi`, `@@unique([hangHoaId, tenLo])` trên `SoLo`, `KhachHang.maSoThue` | Chống trùng | theo module | danh mục, lô |
| P-05 | Index hỗ trợ truy vấn (§5) | Hiệu năng danh sách/báo cáo | M0/M7 | nhiều |
| P-06 | Đổi các trường chỉ-có-ngày sang `@db.Date` (§4) | Tránh lệch múi giờ | M0 | lô, GPKD, thanh toán |
| P-07 | Dòng chi tiết nhập/xuất thêm `donViTinh String`, `heSoQuyDoi Int`, `soLuongCoBan Int`; `HangHoa` thêm `donViTinhGia String` | Số lượng và giá có đơn vị rõ ràng (§6) | M5 | phiếu nhập/xuất, hàng hóa |
| P-08 | `viTriId` (FK `ViTri`) trên `ChiTietPhieuNhapHang` và `ChiTietPhieuXuatHang` | Xác định dòng `TonKho` bị tác động | M5/M6 | phiếu nhập/xuất |
| P-09 | Trường vòng đời phiếu (§7) | Vết chuyển trạng thái, lý do hủy | M5/M6 | phiếu nhập/xuất |
| P-10 | `PhieuThuCongNo`/`PhieuThanhToan`: `phuongThuc`, `ghiChu`, `createdById`, `createdAt`, `huyAt`, `huyById`, `lyDoHuy` | Hủy được, biết ai lập | M5/M6 | phiếu thu/thanh toán |
| P-11 | `NhaCungCap`: `maNCC` unique, `ngayHetHanGPKD`, `ngayHetHanGCNDuoc`, `xacMinhAt`, `xacMinhById` | Mã tra cứu, theo dõi hiệu lực giấy phép | M3 | nhà cung cấp |
| P-12 | `KhachHang`: `hanMucCongNo Decimal?`, `soNgayNoToiDa Int?` | Chỉ nếu bạn chốt có kiểm soát hạn mức (xem câu hỏi mở) | M6 | khách hàng |
| P-13 | Bảng mới `BienDongTonKho` (sổ biến động tồn) | Truy vết mọi thay đổi tồn | M4 | tồn kho |
| P-14 | Bảng mới `NhatKyHeThong` (nhật ký thao tác nhạy cảm) | Audit | M0 | audit |
| P-15 | Bảng mới `BoDemMa` (bộ đếm sinh mã chứng từ) | Mã phiếu không trùng | M0 | phiếu, user, khách |
| P-16 | Bảng mới `TepDinhKem` (file đính kèm đa hình) | Cloudinary | M7 | file |
| P-17 | `HangHoa.maSP String @unique` | Khóa nghiệp vụ | M2 | hàng hóa |
| P-18 | CHECK constraint bằng SQL thô: `ton_kho.so_luong >= 0`, `chi_tiet_*.so_luong > 0`, `ty_le_quy_doi.so_luong_quy_doi >= 1`, tiền `>= 0` | Lưới an toàn cuối cùng | theo module | tồn kho, phiếu |
| P-19 | Index `RefreshToken.expiresAt` | Job dọn token hết hạn | M8 | auth |
| P-20 | Đổi tên `PhieuNhapHang.createAt` → `createdAt` (cột `create_at` → `created_at`) | Nhất quán | M0 | phiếu nhập |
| P-21 | `PhuongTienVanChuyen.isXeLanh Boolean @default(false)` | Phân biệt xe lạnh cho hàng cần bảo quản lạnh | M3 | phương tiện, phiếu nhập/xuất |

**Đã áp dụng ở M3** (migration `m3_kho_doi_tac`): P-11 (`maNCC`, `ngayHetHanGPKD`, `ngayHetHanGCNDuoc`, `xacMinhAt`, `xacMinhById`), P-21 (`isXeLanh`), `createdById`/`updatedById` cho `KhachHang` và `NhaCungCap` (phần của P-02); nới độ dài cột văn bản. Chưa áp dụng P-12 (hạn mức công nợ).

**Đã áp dụng ở M2** (migration `m2_hang_hoa_catalog`): P-17 (`HangHoa.maSP`), `HangHoa.donViTinhGia` (phần của P-07), `createdById`/`updatedById` cho `HangHoa` (phần của P-02); nới độ dài `tenSP`/`quyCach` (200) và `ghiChu` (500).

**Đã áp dụng ở M0** (migration `m0_foundation_schema`): P-01 (6 enum cho cột đã có), P-02 phần `createdAt`/`updatedAt` (chưa có `createdById`/`updatedById`), P-03, P-04, P-05 (index trên cột đã có), P-06, P-14, P-15, P-20. Còn lại làm ở milestone cần dùng.

Nguyên tắc triển khai: gom P-01…P-06, P-14, P-15, P-20 vào **một** migration ở M0 (an toàn vì chưa có dữ liệu thật); các đề xuất còn lại thêm đúng milestone cần dùng.

## 2. Enum đề xuất (P-01)

| Enum | Giá trị | Dùng cho |
|---|---|---|
| `TrangThaiPhieuNhap` | `cho_xac_nhan`, `da_nhap_kho`, `da_huy` | `PhieuNhapHang.trangThai` (mặc định `cho_xac_nhan`, đã có) |
| `TrangThaiPhieuXuat` | `cho_xu_ly`, `da_xuat_kho`, `da_giao`, `da_huy` | `PhieuXuatHang.trangThai` (mặc định `cho_xu_ly`, đã có) |
| `TrangThaiSoLo` | `con_han`, `can_date`, `het_han` | `SoLo.trangThai` (đã có) |
| `TrangThaiKhachHang` | `hoat_dong`, `ngung_hoat_dong` | `KhachHang.trangThai` (mặc định `hoat_dong`, đã có) |
| `TrangThaiXacMinh` | `chua_xac_minh`, `da_xac_minh`, `tu_choi` | `NhaCungCap.trangThaiXacMinh` (mặc định `chua_xac_minh`, đã có) |
| `LoaiKiemSoat` | `thuong`, `ke_don`, `kiem_soat_dac_biet` | `HangHoa.loaiKiemSoat` |
| `PhuongThucThanhToan` | `tien_mat`, `chuyen_khoan` | phiếu thu / thanh toán (P-10) |
| `LoaiBienDong` | `nhap_kho`, `xuat_kho`, `huy_nhap`, `huy_xuat`, `chuyen_di`, `chuyen_den`, `dieu_chinh` | `BienDongTonKho.loai` |
| `LoaiDoiTuongTep` | `khach_hang`, `nha_cung_cap`, `hang_hoa`, `phieu_nhap_hang`, `so_lo` | `TepDinhKem.loaiDoiTuong` |

Giá trị `String` hiện có khớp các enum trên nên đổi sang enum không làm mất dữ liệu (migration đổi kiểu cột). Nếu bạn chưa muốn enum ở DB: giữ `String` và validate bằng `@IsIn` + hằng số — hai phương án đều dùng cùng tập giá trị trên.

## 3. Audit field chung (P-02)

| Nhóm bảng | Thêm |
|---|---|
| Danh mục (`LoaiHang`, `HangHoa`, `TyLeQuyDoi`, `Kho`, `ViTri`, `KhachHang`, `NhaCungCap`, `PhuongTienVanChuyen`, `SoLo`) | thiếu gì bổ sung đó trong `createdAt`, `updatedAt` (`@updatedAt`); thêm `createdById`, `updatedById` (nullable FK `User`, `onDelete: SetNull`) cho `HangHoa`, `KhachHang`, `NhaCungCap`, `SoLo` |
| Chứng từ (`PhieuNhapHang`, `PhieuXuatHang`, `PhieuThuCongNo`, `PhieuThanhToan`) | `createdAt`, `updatedAt`, `createdById`, `updatedById` |
| Dòng chi tiết | `createdAt` |
| `TonKho` | `updatedAt` |

`createdById`/`updatedById` điền tự động bởi service từ `@CurrentUser()`. Ai sửa gì chi tiết ở mức giá trị: xem `NhatKyHeThong` ([audit-trail.md](../03-cross-cutting/audit-trail.md)).

## 4. Trường ngày (P-06)

| Trường | Hiện tại | Đề xuất |
|---|---|---|
| `SoLo.ngaySX`, `SoLo.hanSuDung` | `DateTime` | `@db.Date` |
| `KhachHang.ngayCapGPKD`, `ngayHetHanGPKD` | `DateTime?` | `@db.Date` |
| `NhaCungCap.ngayCapGPKD`, `ngayCapGCNDuoc` | `DateTime?` | `@db.Date` |
| `PhieuThuCongNo.ngayThanhToan`, `PhieuThanhToan.ngayThanhToan` | `DateTime` | `@db.Date` |
| `PhieuNhapHang.ngayNhanHang`, `PhieuXuatHang.ngayGiaoHang` | `DateTime?` | giữ `DateTime` (có giờ) |

## 5. Index đề xuất (P-05)

| Bảng | Index | Phục vụ |
|---|---|---|
| `SoLo` | `(hanSuDung)`, `(hangHoaId, hanSuDung)` | cảnh báo cận date, FEFO |
| `TonKho` | `(viTriId)` (đã có nhờ FK), `(soLoId)` | tra cứu theo vị trí / lô |
| `PhieuNhapHang` | `(trangThai, createdAt)`, `(nhaCungCapId)` | danh sách, công nợ NCC |
| `PhieuXuatHang` | `(trangThai, createdAt)`, `(khachHangId)`, `(ngayXuatKho)` | danh sách, công nợ khách, doanh thu |
| `PhieuThuCongNo` | `(phieuXuatHangId)`, `(ngayThanhToan)` | tổng thu theo phiếu / kỳ |
| `PhieuThanhToan` | `(phieuNhapHangId)`, `(ngayThanhToan)` | tương tự |
| `BienDongTonKho` | `(soLoId, createdAt)`, `(viTriId, createdAt)`, `(loaiThamChieu, thamChieuId)` | sổ cái theo lô/vị trí/chứng từ |
| `HangHoa` | `(loaiHangId)`, fulltext `tenSP` (cân nhắc) | lọc, tìm kiếm |

MySQL InnoDB tự tạo index cho cột khóa ngoại; chỉ liệt kê thêm những cái chưa có.

## 6. Chính sách đơn vị & số lượng (P-07)

Vấn đề: `TonKho.soLuong`, `ChiTiet*.soLuong`, `ChiTiet*.donGia`, `HangHoa.giaNhap/giaHienThi/giaToiThieu` đều không nói rõ tính theo đơn vị nào, trong khi `TyLeQuyDoi` cho phép nhiều đơn vị (viên/vỉ/hộp).

Chính sách đề xuất:

1. `TonKho.soLuong` = **đơn vị cơ bản** (`soLuongQuyDoi = 1`).
2. `ChiTiet*` thêm 3 trường:
   - `donViTinh` — tên đơn vị người dùng chọn (snapshot chuỗi, phải thuộc `TyLeQuyDoi` của hàng).
   - `heSoQuyDoi` — snapshot `soLuongQuyDoi` tại thời điểm lập.
   - `soLuongCoBan = soLuong × heSoQuyDoi` — lượng thực tác động tồn.
   - `soLuong` và `donGia` hiểu theo `donViTinh`.
3. `HangHoa` thêm `donViTinhGia`: đơn vị mà ba mức giá của hàng đó tính theo (ví dụ giá theo "hộp"). Phải thuộc `TyLeQuyDoi` của hàng. Giá theo đơn vị khác = `giá × (heSo đơn vị đó / heSo donViTinhGia)`, làm tròn 2 chữ số.
4. Vì snapshot, đổi `TyLeQuyDoi` sau này không làm sai chứng từ cũ; vẫn khóa sửa hệ số khi hàng đã phát sinh chứng từ ([ty-le-quy-doi.md](../02-modules/ty-le-quy-doi.md)).

Phương án thay thế (đơn giản hơn nhưng kém linh hoạt): chỉ cho nhập/xuất theo đơn vị cơ bản, bỏ P-07. Chọn phương án nào là một câu hỏi mở.

## 7. Trường vòng đời phiếu (P-09)

| Bảng | Thêm |
|---|---|
| `PhieuNhapHang` | `ghiChu String?`, `xacNhanAt DateTime?`, `xacNhanById`, `huyAt DateTime?`, `huyById`, `lyDoHuy String?` |
| `PhieuXuatHang` | `ghiChu String?`, `phuongTienVanChuyenId String?` (FK), `ngayXuatKho DateTime?`, `xuatKhoById`, `ngayGiaoThucTe DateTime?`, `huyAt`, `huyById`, `lyDoHuy` |

`ngayNhanHang` (đã có) = ngày hàng thực tế về kho, nhập tay khi xác nhận; `xacNhanAt` = thời điểm bấm xác nhận. `ngayGiaoHang` (đã có) = ngày giao dự kiến; `ngayGiaoThucTe` được đặt khi `giao-hang`.

## 8. Bất biến theo bảng

| Bảng | Bất biến (service phải giữ) |
|---|---|
| `Role` | `maRole` không đổi sau khi tạo; 4 role hệ thống không xóa |
| `User` | ≥ 1 user `ADMIN` đang hoạt động; `password` luôn là hash bcrypt; không bao giờ trả `password` ra API |
| `RefreshToken` | `tokenHash` = SHA-256 token; dùng một lần |
| `LoaiHang` | không xóa khi còn `HangHoa` |
| `HangHoa` | `giaToiThieu ≤ giaHienThi`; `isKeDon = true ⇒ loaiKiemSoat ≠ thuong`; luôn có đúng 1 `TyLeQuyDoi` cơ bản; `donViTinhGia` thuộc các đơn vị của hàng |
| `TyLeQuyDoi` | đúng một dòng `soLuongQuyDoi = 1` mỗi hàng; `soLuongQuyDoi ≥ 1`; đơn vị cơ bản không xóa/sửa hệ số |
| `SoLo` | `hanSuDung > ngaySX` (nếu có `ngaySX`); `(hangHoaId, tenLo)` duy nhất; `hanSuDung` bất biến sau khi có biến động tồn trừ khi `QUAN_LY_KHO`/`ADMIN` sửa kèm lý do và ghi nhật ký |
| `Kho`, `ViTri` | `ViTri.isCapDong` không đổi `true → false` khi vị trí đang chứa hàng cần giữ lạnh |
| `TonKho` | `soLuong ≥ 0`; chỉ `TonKhoService` được ghi; mỗi lần ghi kèm một dòng `BienDongTonKho` trong cùng transaction |
| `KhachHang` | không lập phiếu xuất mới khi `trangThai ≠ hoat_dong` hoặc GPKD hết hạn |
| `NhaCungCap` | chỉ `da_xac_minh` mới lập được phiếu nhập |
| `PhieuNhapHang` | `cho_xac_nhan` mới sửa/xóa được dòng; ≥ 1 dòng khi xác nhận; mọi dòng cùng NCC của phiếu |
| `ChiTietPhieuNhapHang` | `soLuong ≥ 1`, `donGia ≥ 0`; lô thuộc đúng hàng; `viTri.isCapDong` bắt buộc nếu hàng `isCanGiuLanh` |
| `PhieuXuatHang` | chỉ `cho_xu_ly` mới sửa dòng; xuất kho trừ tồn; hủy sau xuất kho phải hoàn tồn |
| `ChiTietPhieuXuatHang` | lô chưa `het_han`; `soLuongCoBan ≤ TonKho.soLuong` tại `viTriId` lúc xuất kho; `donGia ≥ giaToiThieu` (quy đổi đơn vị) trừ khi `QUAN_LY_KHO`/`ADMIN` |
| `PhieuThuCongNo` | `soTien > 0`; Σ phiếu thu hiệu lực của một phiếu xuất ≤ `tongTien` phiếu xuất; phiếu xuất phải ở `da_xuat_kho`/`da_giao`; bất biến sau khi tạo (chỉ hủy) |
| `PhieuThanhToan` | tương tự, với phiếu nhập `da_nhap_kho` |

## 9. Xóa mềm hay xóa cứng

Không dùng cột `deletedAt` chung. Thay vào đó:

- **Chứng từ**: không xóa sau xác nhận → trạng thái `da_huy`. Phiếu nháp xóa cứng được (không ảnh hưởng tồn/công nợ).
- **Danh mục**: ngừng dùng bằng `trangThai` (P-03); `DELETE` chỉ khi chưa có tham chiếu (kiểm tra bằng đếm quan hệ trước khi xóa, trả `*_IN_USE`).
- **Dòng chi tiết**: xóa cứng chỉ khi phiếu cha còn nháp.
- Khóa ngoại: `onDelete` mặc định `Restrict` (Prisma mặc định với quan hệ bắt buộc) để DB cũng chặn xóa; ngoại lệ có chủ đích: `RefreshToken → User` `Cascade` (đã có), `createdById`/`updatedById → User` `SetNull`.

Lý do không dùng `deletedAt`: dược phẩm cần giữ nguyên chứng từ; danh mục dùng cờ hoạt động đã đủ; `deletedAt` đòi mọi truy vấn phải nhớ lọc — dễ sai.

## 10. Quy đổi tiền & làm tròn

`Decimal(15,2)` ⇒ tối đa 9.999.999.999.999,99 VND. Thành tiền dòng = `round(soLuong × donGia, 2, HALF_UP)`; tổng phiếu = Σ thành tiền dòng đã làm tròn (cộng sau khi làm tròn từng dòng, để tổng khớp tổng các dòng in ra).
