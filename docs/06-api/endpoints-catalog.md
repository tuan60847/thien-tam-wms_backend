# Danh mục endpoint (nguồn sự thật)

Bảng phẳng mọi endpoint của hệ thống: method, path, xác thực, role, mô tả. **Đây là nguồn sự thật về quyền truy cập**; chi tiết DTO ở mục 5–6 của từng module doc, ma trận role theo hành động ở [permissions.md](../03-cross-cutting/permissions.md). Khi sửa endpoint ở module doc, sửa bảng này cùng lúc (test M8 đối chiếu hai nơi).

Quy ước: `mọi role` = mọi người dùng đã đăng nhập; `Public` = không cần token; prefix `/api/v1` (áp dụng sau M0). Cột **MS** = milestone triển khai ([roadmap.md](../00-overview/roadmap.md)). Cột **Doc** trỏ tới file nguồn.

Tổng số endpoint: **109** (102 trong module nghiệp vụ + 7 hạ tầng).

## Auth — [auth](../02-modules/auth.md)

| Method | Path | Auth | Roles | Mô tả | MS |
|---|---|---|---|---|---|
| POST | `/api/v1/auth/login` | Public | — | Đăng nhập | M0 |
| POST | `/api/v1/auth/refresh` | Public | — | Cấp cặp token mới, thu hồi token cũ | M0 |
| POST | `/api/v1/auth/logout` | Public | — | Thu hồi refresh token (204) | M0 |
| GET | `/api/v1/auth/me` | JWT | mọi role | Hồ sơ người dùng hiện tại | M0 |

## Vai trò — [roles](../02-modules/roles.md)

| Method | Path | Auth | Roles | Mô tả | MS |
|---|---|---|---|---|---|
| GET | `/api/v1/roles` | JWT | ADMIN | Danh sách role | M1 |
| GET | `/api/v1/roles/:id` | JWT | ADMIN | Chi tiết role | M1 |
| PATCH | `/api/v1/roles/:id` | JWT | ADMIN | Sửa tên/mô tả/trạng thái | M1 |

## Người dùng — [users](../02-modules/users.md)

| Method | Path | Auth | Roles | Mô tả | MS |
|---|---|---|---|---|---|
| GET | `/api/v1/users` | JWT | ADMIN, QUAN_LY_KHO | Danh sách user | M1 |
| GET | `/api/v1/users/:id` | JWT | ADMIN, QUAN_LY_KHO | Chi tiết user | M1 |
| POST | `/api/v1/users` | JWT | ADMIN | Tạo user | M1 |
| PATCH | `/api/v1/users/:id` | JWT | ADMIN | Sửa hồ sơ/role/trạng thái | M1 |
| POST | `/api/v1/users/:id/dat-lai-mat-khau` | JWT | ADMIN | Đặt mật khẩu mới cho user | M1 |
| PATCH | `/api/v1/users/me` | JWT | mọi role | Sửa hồ sơ của mình | M1 |
| POST | `/api/v1/users/me/doi-mat-khau` | JWT | mọi role | Đổi mật khẩu của mình | M1 |

## Loại hàng — [loai-hang](../02-modules/loai-hang.md)

| Method | Path | Auth | Roles | Mô tả | MS |
|---|---|---|---|---|---|
| GET | `/api/v1/loai-hang` | JWT | mọi role | Danh sách loại hàng | M2 |
| GET | `/api/v1/loai-hang/:id` | JWT | mọi role | Chi tiết | M2 |
| POST | `/api/v1/loai-hang` | JWT | ADMIN, QUAN_LY_KHO | Tạo loại hàng | M2 |
| PATCH | `/api/v1/loai-hang/:id` | JWT | ADMIN, QUAN_LY_KHO | Sửa / ngừng sử dụng | M2 |
| DELETE | `/api/v1/loai-hang/:id` | JWT | ADMIN | Xóa nếu chưa có hàng hóa | M2 |

## Hàng hóa — [hang-hoa](../02-modules/hang-hoa.md)

| Method | Path | Auth | Roles | Mô tả | MS |
|---|---|---|---|---|---|
| GET | `/api/v1/hang-hoa` | JWT | mọi role | Danh sách hàng hóa | M2 |
| GET | `/api/v1/hang-hoa/:id` | JWT | mọi role | Chi tiết kèm đơn vị quy đổi | M2 |
| POST | `/api/v1/hang-hoa` | JWT | ADMIN, QUAN_LY_KHO | Tạo hàng hóa (kèm đơn vị) | M2 |
| PATCH | `/api/v1/hang-hoa/:id` | JWT | ADMIN, QUAN_LY_KHO | Sửa thông tin / giá / ngừng KD | M2 |
| DELETE | `/api/v1/hang-hoa/:id` | JWT | ADMIN | Xóa nếu chưa phát sinh | M2 |

## Tỷ lệ quy đổi — [ty-le-quy-doi](../02-modules/ty-le-quy-doi.md)

| Method | Path | Auth | Roles | Mô tả | MS |
|---|---|---|---|---|---|
| GET | `/api/v1/hang-hoa/:hangHoaId/ty-le-quy-doi` | JWT | mọi role | Danh sách đơn vị của hàng | M2 |
| GET | `/api/v1/hang-hoa/:hangHoaId/ty-le-quy-doi/:id` | JWT | mọi role | Chi tiết một đơn vị | M2 |
| POST | `/api/v1/hang-hoa/:hangHoaId/ty-le-quy-doi` | JWT | ADMIN, QUAN_LY_KHO | Thêm đơn vị quy đổi | M2 |
| PATCH | `/api/v1/hang-hoa/:hangHoaId/ty-le-quy-doi/:id` | JWT | ADMIN, QUAN_LY_KHO | Sửa tên/hệ số | M2 |
| DELETE | `/api/v1/hang-hoa/:hangHoaId/ty-le-quy-doi/:id` | JWT | ADMIN | Xóa đơn vị (không phải cơ bản) | M2 |

## Kho & Vị trí — [kho-vi-tri](../02-modules/kho-vi-tri.md)

| Method | Path | Auth | Roles | Mô tả | MS |
|---|---|---|---|---|---|
| GET | `/api/v1/kho` | JWT | mọi role | Danh sách kho | M3 |
| GET | `/api/v1/kho/:id` | JWT | mọi role | Chi tiết kho | M3 |
| POST | `/api/v1/kho` | JWT | ADMIN, QUAN_LY_KHO | Tạo kho | M3 |
| PATCH | `/api/v1/kho/:id` | JWT | ADMIN, QUAN_LY_KHO | Sửa / vô hiệu hóa kho | M3 |
| DELETE | `/api/v1/kho/:id` | JWT | ADMIN | Xóa kho rỗng | M3 |
| GET | `/api/v1/vi-tri` | JWT | mọi role | Danh sách vị trí | M3 |
| GET | `/api/v1/vi-tri/:id` | JWT | mọi role | Chi tiết vị trí | M3 |
| POST | `/api/v1/vi-tri` | JWT | ADMIN, QUAN_LY_KHO | Tạo vị trí trong kho | M3 |
| PATCH | `/api/v1/vi-tri/:id` | JWT | ADMIN, QUAN_LY_KHO | Sửa / vô hiệu hóa vị trí | M3 |
| DELETE | `/api/v1/vi-tri/:id` | JWT | ADMIN | Xóa vị trí chưa từng phát sinh | M3 |

## Khách hàng — [khach-hang](../02-modules/khach-hang.md)

| Method | Path | Auth | Roles | Mô tả | MS |
|---|---|---|---|---|---|
| GET | `/api/v1/khach-hang` | JWT | mọi role | Danh sách khách hàng | M3 |
| GET | `/api/v1/khach-hang/:id` | JWT | mọi role | Chi tiết khách hàng | M3 |
| POST | `/api/v1/khach-hang` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Tạo khách hàng | M3 |
| PATCH | `/api/v1/khach-hang/:id` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Sửa / ngừng hoạt động | M3 |
| DELETE | `/api/v1/khach-hang/:id` | JWT | ADMIN | Xóa nếu chưa có phiếu xuất | M3 |

## Nhà cung cấp — [nha-cung-cap](../02-modules/nha-cung-cap.md)

| Method | Path | Auth | Roles | Mô tả | MS |
|---|---|---|---|---|---|
| GET | `/api/v1/nha-cung-cap` | JWT | mọi role | Danh sách NCC | M3 |
| GET | `/api/v1/nha-cung-cap/:id` | JWT | mọi role | Chi tiết NCC | M3 |
| POST | `/api/v1/nha-cung-cap` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Tạo NCC (mặc định chưa xác minh) | M3 |
| PATCH | `/api/v1/nha-cung-cap/:id` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Sửa thông tin / ngừng hoạt động | M3 |
| POST | `/api/v1/nha-cung-cap/:id/xac-minh` | JWT | ADMIN, QUAN_LY_KHO | Xác minh hoặc từ chối NCC | M3 |
| DELETE | `/api/v1/nha-cung-cap/:id` | JWT | ADMIN | Xóa nếu chưa có phiếu nhập | M3 |

## Phương tiện vận chuyển — [phuong-tien-van-chuyen](../02-modules/phuong-tien-van-chuyen.md)

| Method | Path | Auth | Roles | Mô tả | MS |
|---|---|---|---|---|---|
| GET | `/api/v1/phuong-tien-van-chuyen` | JWT | mọi role | Danh sách phương tiện | M3 |
| GET | `/api/v1/phuong-tien-van-chuyen/:id` | JWT | mọi role | Chi tiết | M3 |
| POST | `/api/v1/phuong-tien-van-chuyen` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Thêm phương tiện | M3 |
| PATCH | `/api/v1/phuong-tien-van-chuyen/:id` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Sửa / vô hiệu hóa | M3 |
| DELETE | `/api/v1/phuong-tien-van-chuyen/:id` | JWT | ADMIN | Xóa nếu chưa dùng | M3 |

## Số lô — [so-lo](../02-modules/so-lo.md)

| Method | Path | Auth | Roles | Mô tả | MS |
|---|---|---|---|---|---|
| GET | `/api/v1/so-lo` | JWT | mọi role | Danh sách lô | M4 |
| GET | `/api/v1/so-lo/:id` | JWT | mọi role | Chi tiết lô (kèm tổng tồn) | M4 |
| POST | `/api/v1/so-lo` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Tạo lô | M4 |
| PATCH | `/api/v1/so-lo/:id` | JWT | ADMIN, QUAN_LY_KHO | Sửa tên/ngày/hạn lô | M4 |
| DELETE | `/api/v1/so-lo/:id` | JWT | ADMIN | Xóa lô chưa phát sinh | M4 |

## Tồn kho — [ton-kho](../02-modules/ton-kho.md)

| Method | Path | Auth | Roles | Mô tả | MS |
|---|---|---|---|---|---|
| GET | `/api/v1/ton-kho` | JWT | mọi role | Tồn theo dòng (lô × vị trí) | M4 |
| GET | `/api/v1/ton-kho/:id` | JWT | mọi role | Một dòng tồn | M4 |
| GET | `/api/v1/ton-kho/tong-hop` | JWT | mọi role | Tổng hợp theo hàng hóa | M4 |
| GET | `/api/v1/ton-kho/goi-y-xuat` | JWT | mọi role | Gợi ý lô xuất theo FEFO | M4 |
| GET | `/api/v1/ton-kho/bien-dong` | JWT | mọi role | Sổ biến động tồn | M4 |
| POST | `/api/v1/ton-kho/chuyen-vi-tri` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Chuyển hàng giữa hai vị trí | M4 |
| POST | `/api/v1/ton-kho/dieu-chinh` | JWT | ADMIN, QUAN_LY_KHO | Điều chỉnh tồn (kiểm kê) | M4 |
| GET | `/api/v1/ton-kho/doi-soat` | JWT | ADMIN | Đối soát tồn với sổ biến động | M4 |

## Phiếu nhập hàng — [phieu-nhap-hang](../02-modules/phieu-nhap-hang.md)

| Method | Path | Auth | Roles | Mô tả | MS |
|---|---|---|---|---|---|
| GET | `/api/v1/phieu-nhap-hang` | JWT | mọi role | Danh sách phiếu nhập | M5 |
| GET | `/api/v1/phieu-nhap-hang/:id` | JWT | mọi role | Chi tiết phiếu + dòng + thanh toán | M5 |
| POST | `/api/v1/phieu-nhap-hang` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Lập phiếu nhập (nháp) | M5 |
| PATCH | `/api/v1/phieu-nhap-hang/:id` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Sửa phiếu nháp (thay toàn bộ dòng nếu gửi `chiTiet`) | M5 |
| DELETE | `/api/v1/phieu-nhap-hang/:id` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Xóa phiếu nháp | M5 |
| POST | `/api/v1/phieu-nhap-hang/:id/xac-nhan` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Xác nhận nhập kho, tăng tồn | M5 |
| POST | `/api/v1/phieu-nhap-hang/:id/huy` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Hủy phiếu | M5 |

## Phiếu thanh toán — [phieu-thanh-toan](../02-modules/phieu-thanh-toan.md)

| Method | Path | Auth | Roles | Mô tả | MS |
|---|---|---|---|---|---|
| GET | `/api/v1/phieu-thanh-toan` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Danh sách phiếu thanh toán | M5 |
| GET | `/api/v1/phieu-thanh-toan/:id` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Chi tiết | M5 |
| POST | `/api/v1/phieu-thanh-toan` | JWT | ADMIN, KE_TOAN | Lập phiếu thanh toán | M5 |
| POST | `/api/v1/phieu-thanh-toan/:id/huy` | JWT | ADMIN, KE_TOAN | Hủy phiếu thanh toán | M5 |
| GET | `/api/v1/nha-cung-cap/:id/cong-no` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Công nợ phải trả của NCC | M5 |

## Phiếu xuất hàng — [phieu-xuat-hang](../02-modules/phieu-xuat-hang.md)

| Method | Path | Auth | Roles | Mô tả | MS |
|---|---|---|---|---|---|
| GET | `/api/v1/phieu-xuat-hang` | JWT | mọi role | Danh sách phiếu xuất | M6 |
| GET | `/api/v1/phieu-xuat-hang/:id` | JWT | mọi role | Chi tiết phiếu + dòng + phiếu thu | M6 |
| POST | `/api/v1/phieu-xuat-hang` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Lập phiếu xuất (chờ xử lý) | M6 |
| PATCH | `/api/v1/phieu-xuat-hang/:id` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Sửa phiếu chờ xử lý (thay toàn bộ dòng nếu gửi `chiTiet`) | M6 |
| DELETE | `/api/v1/phieu-xuat-hang/:id` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Xóa phiếu chờ xử lý | M6 |
| POST | `/api/v1/phieu-xuat-hang/:id/xuat-kho` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Xuất kho: trừ tồn, phát sinh công nợ | M6 |
| POST | `/api/v1/phieu-xuat-hang/:id/giao-hang` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Xác nhận đã giao hàng | M6 |
| POST | `/api/v1/phieu-xuat-hang/:id/huy` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Hủy phiếu | M6 |

## Phiếu thu công nợ — [phieu-thu-cong-no](../02-modules/phieu-thu-cong-no.md)

| Method | Path | Auth | Roles | Mô tả | MS |
|---|---|---|---|---|---|
| GET | `/api/v1/phieu-thu-cong-no` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Danh sách phiếu thu | M6 |
| GET | `/api/v1/phieu-thu-cong-no/:id` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Chi tiết | M6 |
| POST | `/api/v1/phieu-thu-cong-no` | JWT | ADMIN, KE_TOAN | Lập phiếu thu | M6 |
| POST | `/api/v1/phieu-thu-cong-no/:id/huy` | JWT | ADMIN, KE_TOAN | Hủy phiếu thu | M6 |
| GET | `/api/v1/khach-hang/:id/cong-no` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Công nợ phải thu của khách | M6 |

## Báo cáo — [bao-cao](../02-modules/bao-cao.md)

| Method | Path | Auth | Roles | Mô tả | MS |
|---|---|---|---|---|---|
| GET | `/api/v1/bao-cao/ton-kho` | JWT | mọi role | Tồn kho hiện tại, nhóm theo hàng / kho / loại hàng | M7 |
| GET | `/api/v1/bao-cao/ton-kho/theo-lo` | JWT | mọi role | Tồn theo từng lô kèm hạn dùng | M7 |
| GET | `/api/v1/bao-cao/can-date` | JWT | mọi role | Lô sắp hết hạn còn tồn | M7 |
| GET | `/api/v1/bao-cao/het-han` | JWT | mọi role | Lô đã hết hạn còn tồn | M7 |
| GET | `/api/v1/bao-cao/nhap-xuat-ton` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Nhập–xuất–tồn theo kỳ | M7 |
| GET | `/api/v1/bao-cao/doanh-thu` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Doanh thu theo kỳ và nhóm | M7 |
| GET | `/api/v1/bao-cao/top-ban-chay` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Hàng bán chạy | M7 |
| GET | `/api/v1/bao-cao/cong-no-phai-thu` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Công nợ phải thu theo tuổi nợ | M7 |
| GET | `/api/v1/bao-cao/cong-no-phai-tra` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Công nợ phải trả theo tuổi nợ | M7 |

## Hạ tầng

| Method | Path | Auth | Roles | Mô tả | Doc |
|---|---|---|---|---|---|
| GET | `/api/v1/health` | Public | — | Kiểm tra sẵn sàng (DB, bộ nhớ, job) | [observability.md](../05-ops/observability.md) |
| GET | `/api/v1/health/live` | Public | — | Kiểm tra tiến trình sống | [observability.md](../05-ops/observability.md) |
| GET | `/api/v1/audit` | JWT | ADMIN | Xem nhật ký thao tác hệ thống | [audit-trail.md](../03-cross-cutting/audit-trail.md) |
| POST | `/api/v1/tep-dinh-kem` | JWT | theo quyền sửa đối tượng gắn | Tải tệp lên (multipart) | [file-upload.md](../03-cross-cutting/file-upload.md) |
| GET | `/api/v1/tep-dinh-kem` | JWT | theo quyền xem đối tượng gắn | Danh sách tệp của một đối tượng | [file-upload.md](../03-cross-cutting/file-upload.md) |
| GET | `/api/v1/tep-dinh-kem/:id/url` | JWT | theo quyền xem đối tượng gắn | Lấy URL ký có hạn ngắn | [file-upload.md](../03-cross-cutting/file-upload.md) |
| DELETE | `/api/v1/tep-dinh-kem/:id` | JWT | theo quyền sửa đối tượng gắn | Xóa tệp | [file-upload.md](../03-cross-cutting/file-upload.md) |

## Ghi chú

- Công nợ: `GET /khach-hang/:id/cong-no` được khai báo ở [phieu-thu-cong-no](../02-modules/phieu-thu-cong-no.md) và `GET /nha-cung-cap/:id/cong-no` ở [phieu-thanh-toan](../02-modules/phieu-thanh-toan.md); chúng được liệt kê trong bảng của module sở hữu logic (không lặp lại ở bảng `khach-hang`/`nha-cung-cap`) dù URL nằm dưới hai tài nguyên đó.
- Route tĩnh (`/ton-kho/tong-hop`, `/users/me`, …) luôn khai báo **trước** route `/:id` trong controller.
- `HEAD`/`OPTIONS` do Nest/Express xử lý, không liệt kê.
- Mọi endpoint không `Public` trả `401` khi thiếu token và `403` khi sai role.
