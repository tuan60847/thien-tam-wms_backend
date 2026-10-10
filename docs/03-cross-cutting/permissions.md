# Phân quyền

Nguồn sự thật duy nhất cho "role nào làm được gì". Mỗi module doc (mục 13) phải khớp bảng này; nếu lệch, bảng này thắng và module doc phải sửa.

## 1. Role

| `maRole` | Mô tả | Ghi chú |
|---|---|---|
| `ADMIN` | Quản trị viên | Toàn quyền |
| `QUAN_LY_KHO` | Quản lý kho | Quản lý danh mục kho/hàng, duyệt các thao tác khó hoàn tác, xem báo cáo |
| `NHAN_VIEN_KHO` | Nhân viên kho | Lập phiếu nhập–xuất (nháp), xuất kho, chuyển vị trí, tra cứu; xác nhận nhập kho do quản lý |
| `KE_TOAN` | Kế toán | Công nợ; xem chứng từ và báo cáo; không thao tác tồn kho |

Role cố định trong code; seed tạo 4 role này ([seed-strategy.md](../01-data/seed-strategy.md)). Muốn role tùy biến/permission động → ngoài phạm vi phase 1 (câu hỏi mở).

## 2. Cơ chế kỹ thuật

- Mặc định mọi route cần JWT (`JwtAuthGuard` global). Route công khai: chỉ `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /health`, `GET /` (Hello) — và `/api/docs` nếu bật.
- `@Roles(...)` liệt kê role **được phép** (so khớp `maRole`). Route không có `@Roles` = mọi user đăng nhập đều được. Vì vậy mỗi route phải được quyết định rõ ràng: hoặc `@Roles`, hoặc ghi "mọi role" trong bảng dưới.
- Hằng số role đặt ở `src/auth/roles.constants.ts` (đề xuất): `export const ROLE = { ADMIN: 'ADMIN', … } as const`. Controller dùng `@Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO)`.
- Quyền theo **trường** (ví dụ ẩn `giaNhap`) xử lý ở mapper response, dựa trên `AuthenticatedUser.role`, không bằng guard.
- Quyền theo **ngữ cảnh** (ví dụ chỉ `QUAN_LY_KHO`/`ADMIN` được bán dưới giá tối thiểu) xử lý trong service dựa trên `AuthenticatedUser` truyền vào.
- `ADMIN` luôn được liệt kê tường minh trong mọi `@Roles` (không có "bypass ngầm") để đọc code là biết ai được phép.

## 3. Ma trận theo tài nguyên

Ký hiệu: ✓ = được; ✗ = không; ✓* = được kèm điều kiện ghi chú bên dưới bảng.
Cột: **A** = `ADMIN`, **Q** = `QUAN_LY_KHO`, **N** = `NHAN_VIEN_KHO`, **K** = `KE_TOAN`.

### 3.1 Định danh

| Tài nguyên.Hành động | A | Q | N | K |
|---|---|---|---|---|
| `auth.login/refresh/logout` | public | public | public | public |
| `auth.me` | ✓ | ✓ | ✓ | ✓ |
| `users.me` (xem/sửa hồ sơ mình, đổi mật khẩu mình) | ✓ | ✓ | ✓ | ✓ |
| `users.list`, `users.read` | ✓ | ✓ | ✗ | ✗ |
| `users.create`, `users.update`, `users.reset-password` | ✓ | ✗ | ✗ | ✗ |
| `roles.list`, `roles.read` | ✓ | ✗ | ✗ | ✗ |
| `roles.update` | ✓ | ✗ | ✗ | ✗ |

### 3.2 Danh mục hàng hóa

| Hành động | A | Q | N | K |
|---|---|---|---|---|
| `loai-hang.list/read` | ✓ | ✓ | ✓ | ✓ |
| `loai-hang.create/update` | ✓ | ✓ | ✗ | ✗ |
| `loai-hang.delete` | ✓ | ✗ | ✗ | ✗ |
| `hang-hoa.list/read` | ✓ | ✓ | ✓* | ✓ |
| `hang-hoa.create/update` | ✓ | ✓ | ✗ | ✗ |
| `hang-hoa.delete` | ✓ | ✗ | ✗ | ✗ |
| `ty-le-quy-doi.list/read` | ✓ | ✓ | ✓ | ✓ |
| `ty-le-quy-doi.create/update` | ✓ | ✓ | ✗ | ✗ |
| `ty-le-quy-doi.delete` | ✓ | ✗ | ✗ | ✗ |

✓* `NHAN_VIEN_KHO` xem được hàng hóa nhưng response **không** có `giaNhap` và `giaToiThieu` (nhạy cảm thương mại) — mapper theo role; câu hỏi mở nếu cần mở.

### 3.3 Kho, đối tác

| Hành động | A | Q | N | K |
|---|---|---|---|---|
| `kho.list/read`, `vi-tri.list/read` | ✓ | ✓ | ✓ | ✓ |
| `kho.create/update`, `vi-tri.create/update` | ✓ | ✓ | ✗ | ✗ |
| `kho.delete`, `vi-tri.delete` | ✓ | ✗ | ✗ | ✗ |
| `khach-hang.list/read` | ✓ | ✓ | ✓ | ✓ |
| `khach-hang.create/update` | ✓ | ✓ | ✗ | ✓ |
| `khach-hang.delete` | ✓ | ✗ | ✗ | ✗ |
| `nha-cung-cap.list/read` | ✓ | ✓ | ✓ | ✓ |
| `nha-cung-cap.create/update` | ✓ | ✓ | ✗ | ✓ |
| `nha-cung-cap.xac-minh` | ✓ | ✓ | ✗ | ✗ |
| `nha-cung-cap.delete` | ✓ | ✗ | ✗ | ✗ |
| `phuong-tien-van-chuyen.list/read` | ✓ | ✓ | ✓ | ✓ |
| `phuong-tien-van-chuyen.create/update` | ✓ | ✓ | ✓ | ✗ |
| `phuong-tien-van-chuyen.delete` | ✓ | ✗ | ✗ | ✗ |

### 3.4 Lô & tồn kho

| Hành động | A | Q | N | K |
|---|---|---|---|---|
| `so-lo.list/read` | ✓ | ✓ | ✓ | ✓ |
| `so-lo.create` | ✓ | ✓ | ✓ | ✗ |
| `so-lo.update` | ✓ | ✓ | ✗ | ✗ |
| `so-lo.delete` | ✓ | ✗ | ✗ | ✗ |
| `ton-kho.list/tong-hop/bien-dong/goi-y-xuat` | ✓ | ✓ | ✓ | ✓* |
| `ton-kho.chuyen-vi-tri` | ✓ | ✓ | ✓ | ✗ |
| `ton-kho.dieu-chinh` | ✓ | ✓ | ✗ | ✗ |

✓* `KE_TOAN` xem tồn kho và sổ biến động nhưng không dùng `goi-y-xuat` (vô nghĩa với kế toán) — cho phép đọc để đơn giản; không rủi ro.

### 3.4b Danh mục kinh doanh

| Hành động | A | Q | N | K |
|---|---|---|---|---|
| `nhom-doi-tac`, `dieu-khoan-thanh-toan`, `nhan-vien-kinh-doanh` đọc | ✓ | ✓ | ✓ | ✓ |
| các mục trên tạo / sửa | ✓ | ✓ | ✗ | ✓ |
| các mục trên xóa | ✓ | ✗ | ✗ | ✗ |

### 3.5 Chứng từ

| Hành động | A | Q | N | K |
|---|---|---|---|---|
| `phieu-nhap-hang.list/read` | ✓ | ✓ | ✓ | ✓ |
| `phieu-nhap-hang.create/update/delete-nháp` | ✓ | ✓ | ✓ | ✗ |
| `phieu-nhap-hang.xac-nhan` | ✓ | ✓ | ✗ | ✗ |
| `phieu-nhap-hang.huy` (phiếu nháp) | ✓ | ✓ | ✓ | ✗ |
| `phieu-nhap-hang.huy` (phiếu đã nhập kho) | ✓ | ✓ | ✗ | ✗ |
| `phieu-xuat-hang.list/read` | ✓ | ✓ | ✓ | ✓ |
| `phieu-xuat-hang.create/update/delete-nháp` | ✓ | ✓ | ✓ | ✗ |
| `phieu-xuat-hang.xuat-kho`, `giao-hang` | ✓ | ✓ | ✓ | ✗ |
| `phieu-xuat-hang.huy` (phiếu chờ xử lý) | ✓ | ✓ | ✓ | ✗ |
| `phieu-xuat-hang.huy` (đã xuất kho) | ✓ | ✓ | ✗ | ✗ |
| `phieu-xuat-hang` bán dưới `giaToiThieu` | ✓ | ✓ | ✗ | ✗ |
| `phieu-thu-cong-no.list/read` | ✓ | ✓ | ✗ | ✓ |
| `phieu-thu-cong-no.create` | ✓ | ✗ | ✗ | ✓ |
| `phieu-thu-cong-no.huy` | ✓ | ✗ | ✗ | ✓ |
| `phieu-thu-cong-no.thu-gop` | ✓ | ✗ | ✗ | ✓ |
| `doi-tru-chung-tu.list/read` | ✓ | ✓ | ✗ | ✓ |
| `doi-tru-chung-tu.create`, `bo` | ✓ | ✗ | ✗ | ✓ |
| `tra-lai-hang-ban.list/read` | ✓ | ✓ | ✓ | ✓ |
| `tra-lai-hang-ban.create/update/delete-nháp` | ✓ | ✓ | ✓ | ✗ |
| `tra-lai-hang-ban.xac-nhan` | ✓ | ✓ | ✗ | ✗ |
| `tra-lai-hang-ban.huy` (phiếu nháp) | ✓ | ✓ | ✓ | ✗ |
| `tra-lai-hang-ban.huy` (đã nhập lại kho) | ✓ | ✓ | ✗ | ✗ |
| `bao-gia.list/read` | ✓ | ✓ | ✓ | ✓ |
| `bao-gia.create/update/delete/chuyen-phieu-xuat` | ✓ | ✓ | ✓ | ✗ |
| `tai-khoan-ngan-hang`, `dia-diem-giao-hang` (đọc) | ✓ | ✓ | ✓ | ✓ |
| `tai-khoan-ngan-hang`, `dia-diem-giao-hang` (thêm/sửa/xóa) | ✓ | ✓ | ✗ | ✓ |
| `khach-hang.cong-no` (xem công nợ khách) | ✓ | ✓ | ✗ | ✓ |
| `phieu-thanh-toan.list/read` | ✓ | ✓ | ✗ | ✓ |
| `phieu-thanh-toan.create`, `huy` | ✓ | ✗ | ✗ | ✓ |
| `nha-cung-cap.cong-no` | ✓ | ✓ | ✗ | ✓ |

### 3.6 Báo cáo

| Báo cáo | A | Q | N | K |
|---|---|---|---|---|
| `ton-kho`, `ton-kho/theo-lo`, `can-date`, `het-han` | ✓ | ✓ | ✓ | ✓ |
| `nhap-xuat-ton` | ✓ | ✓ | ✗ | ✓ |
| `doanh-thu`, `top-ban-chay` | ✓ | ✓ | ✗ | ✓ |
| `cong-no-phai-thu`, `cong-no-phai-tra` | ✓ | ✓ | ✗ | ✓ |

### 3.7 Hạ tầng

| Hành động | A | Q | N | K |
|---|---|---|---|---|
| `tep-dinh-kem.upload/delete` (theo đối tượng gắn) | theo quyền sửa đối tượng đó | | | |
| `tep-dinh-kem.read` | theo quyền xem đối tượng đó | | | |
| `audit.list` (xem nhật ký hệ thống) | ✓ | ✗ | ✗ | ✗ |
| `health` | public | | | |
| `docs` (Swagger) | tắt ở production | | | |

## 4. Quy tắc phụ

1. **Không tự nâng quyền / tự khóa:** user không đổi role của chính mình, không khóa chính mình, không hạ role admin cuối cùng.
2. **Tách nhiệm vụ (đề xuất, chưa bắt buộc):** người lập phiếu thu / thanh toán không tự hủy phiếu mình đã lập, trừ `ADMIN`. Chưa áp dụng ở phase 1; câu hỏi mở.
3. **Ngưỡng duyệt giá trị** (ví dụ phiếu xuất > X VND phải `QUAN_LY_KHO` xác nhận): chưa có; câu hỏi mở.
4. Quyền xem ở list luôn áp dụng cùng quyền ở read chi tiết.
5. Mọi thao tác **hủy**, **điều chỉnh tồn**, **bán dưới giá tối thiểu**, **đổi role**, **khóa user**, **sửa hạn sử dụng lô** ghi `NhatKyHeThong` ([audit-trail.md](audit-trail.md)).

## 5. Kiểm thử phân quyền

- Mỗi module có e2e ma trận role × endpoint: với mỗi endpoint kiểm tra role được phép nhận 2xx/4xx nghiệp vụ, role không được phép nhận `403`, không token nhận `401`.
- Test tổng hợp ở M8 duyệt toàn bộ [endpoints-catalog.md](../06-api/endpoints-catalog.md): mọi endpoint không `@Public` phải có dòng quyền tương ứng trong bảng trên (script đối chiếu metadata `@Roles` với catalog).
