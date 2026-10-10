# Câu hỏi mở tổng hợp

Tổng cộng **102** câu hỏi, gom từ mục 14 của từng module doc và các tài liệu chung. Mỗi câu có số thứ tự toàn cục (`#`) và mã gốc (để tra về module). Trả lời bằng số `#` là đủ. Câu có ⭐ là **chặn việc viết code** của milestone tương ứng — nên trả lời trước.

## A. Cần trả lời trước khi bắt đầu code (⭐)

| # | Mã | Câu hỏi | Chặn |
|---|---|---|---|
| 30 | Q-HH-1 | Ba mức giá hiện tại (`giaNhap`, `giaHienThi`, `giaToiThieu`) tính theo đơn vị nào — hộp, hay đơn vị cơ bản? Đề xuất `donViTinhGia` (P-07). Xem thêm [schema-notes.md](01-data/schema-notes.md) §6. | M2, M5, M6 |
| 82 | Q-XUAT-1 | Ai lập phiếu xuất trong thực tế — nhân viên kho hay một vai trò **bán hàng/kinh doanh** riêng (cần thêm role `NHAN_VIEN_BAN_HANG` và tách bước "lập đơn" khỏi "xuất kho")? | M1, M6 |
| 63 | Q-TK-1 | Có cần **giữ chỗ tồn** khi lập phiếu xuất (để hai phiếu nháp không cùng "ăn" một lượng tồn, hiển thị `tồn khả dụng = tồn − đã giữ`)? Đề xuất hiện tại: không, chỉ chặn lúc xuất kho. Nếu cần: thêm `TonKho.soLuongGiu` hoặc bảng `GiuCho`. | M4, M6 |
| 44 | Q-KH-1 | Có kiểm soát **hạn mức công nợ** và/hoặc **số ngày nợ tối đa** theo khách không? (nếu có: thêm P-12, chặn khi vượt, ai được ghi đè?) | M3, M6 |
| 58 | Q-LO-1 | Ngưỡng "cận date" bao nhiêu ngày (đề xuất 90)? Có ngưỡng khác theo loại hàng (ví dụ vắc-xin 30 ngày) không? | M4 |
| 59 | Q-LO-2 | Có quy định **thời hạn còn lại tối thiểu** khi nhập (ví dụ ≥ 6 tháng hoặc ≥ 2/3 hạn) và khi xuất cho nhà thuốc (ví dụ ≥ 90 ngày)? (`MIN_SHELF_LIFE_DAYS_*`) | M4–M6 |
| 70 | Q-NHAP-2 | Có cần bước **duyệt** giữa lập phiếu và xác nhận nhập kho (ví dụ phiếu giá trị lớn phải `QUAN_LY_KHO` xác nhận), hay NVK tự xác nhận như hiện đề xuất? | M5 |
| 79 | Q-TT-3 | Một lần trả tiền thực tế thường gộp **nhiều phiếu nhập** cùng NCC? Nếu có, cần chức năng thanh toán gộp (phân bổ vào nhiều phiếu), schema hiện chỉ có 1 phiếu nhập/1 phiếu thanh toán. | M5 |
| 92 | Q-THU-2 | Khách thường trả một lần cho **nhiều phiếu**? Nếu có, cần thu gộp và phân bổ (hiện chỉ gắn một phiếu xuất). | M6 |
| 2 | Q-GEN-2 | Xác nhận quy ước API: prefix `/api/v1`, response thành công **không** bọc envelope, danh sách `{ items, meta }`, lỗi có `code`. Áp dụng sẽ đổi route Auth từ `/auth/*` thành `/api/v1/auth/*` (breaking với client/test hiện tại) — đồng ý retrofit ở M0? | M0 |
| 7 | Q-GEN-7 | `yarn.lock` hiện không được git theo dõi: có theo dõi lại để bản dựng tái lập được (khuyến nghị)? Lịch sử cũ vẫn chứa bản `yarn.lock`. | M0 / CI |
| 12 | Q-OPS-1 | Hosting `m3xs.net`: phiên bản Node hỗ trợ, quyền chạy PM2 và build module native (`bcrypt`), có Redis không (quyết định BullMQ vs `@nestjs/schedule`)? | M4 (job), M8 |
| 13 | Q-OPS-2 | M3Admin cụ thể làm gì (biến môi trường, deploy, vhost/cổng, DB)? Cung cấp quy trình chuẩn bạn dùng để tôi thay phần **[GIẢ ĐỊNH]** trong `deployment.md`. | M8 |
| 99 | Q-BC-3 | Có cần **giá vốn hàng bán / lợi nhuận gộp**? Nếu có, chọn phương pháp giá vốn (bình quân gia quyền theo lô như giá trị tồn hiện tại, FIFO, bình quân di động toàn kho) vì kết quả khác nhau. | M7 |

## Chung (quy ước, kiến trúc)

1. **Q-GEN-1**: Bốn role cố định `ADMIN`, `QUAN_LY_KHO`, `NHAN_VIEN_KHO`, `KE_TOAN` đã đủ chưa? (xem thêm Q-ROLES-2, Q-XUAT-1)
2. **Q-GEN-2** ⭐: Xác nhận quy ước API: prefix `/api/v1`, response thành công **không** bọc envelope, danh sách `{ items, meta }`, lỗi có `code`. Áp dụng sẽ đổi route Auth từ `/auth/*` thành `/api/v1/auth/*` (breaking với client/test hiện tại) — đồng ý retrofit ở M0?
3. **Q-GEN-3**: Unit test đặt **cạnh** file nguồn (như `src/auth`) thay vì thư mục `tests/` trong mẫu module — đồng ý?
4. **Q-GEN-4**: Trạng thái dùng `enum` Prisma/MySQL (P-01) hay giữ `String` + `@IsIn`?
5. **Q-GEN-5**: Xác nhận định dạng hợp lệ: SĐT (`0xxxxxxxxx` / `+84…`), MST (`10` hoặc `10-3` số), biển số (`\d{2}[A-Z]{1,2}\d{4,6}`) — dữ liệu thật có ngoại lệ không?
6. **Q-GEN-6**: `@nestjs/observe` đang cắm với key placeholder: giữ (cần key thật + biến môi trường) hay bỏ?
7. **Q-GEN-7** ⭐: `yarn.lock` hiện không được git theo dõi: có theo dõi lại để bản dựng tái lập được (khuyến nghị)? Lịch sử cũ vẫn chứa bản `yarn.lock`.
8. **Q-GEN-8**: Có cần `Idempotency-Key` cho tạo chứng từ và `expectedUpdatedAt` chống ghi đè khi sửa phiếu nháp không?
9. **Q-GEN-9**: Mức rate limit chung cho các route ngoài login (hiện đề xuất chưa bật hoặc nới 300/phút/user)?
10. **Q-GEN-10**: Dữ liệu ban đầu: có hệ thống mã cũ (maSP, maKH, maNCC, maNV, số phiếu) cần giữ khi import không? Tồn đầu kỳ nhập bằng phiếu nhập "đầu kỳ" hay điều chỉnh tồn? Ai cung cấp file dữ liệu?
11. **Q-GEN-11**: Ngôn ngữ giao diện/message chỉ tiếng Việt (đề xuất), hay cần thêm tiếng Anh?

## Hạ tầng & vận hành

12. **Q-OPS-1** ⭐: Hosting `m3xs.net`: phiên bản Node hỗ trợ, quyền chạy PM2 và build module native (`bcrypt`), có Redis không (quyết định BullMQ vs `@nestjs/schedule`)?
13. **Q-OPS-2** ⭐: M3Admin cụ thể làm gì (biến môi trường, deploy, vhost/cổng, DB)? Cung cấp quy trình chuẩn bạn dùng để tôi thay phần **[GIẢ ĐỊNH]** trong `deployment.md`.
14. **Q-OPS-3**: Jenkins: vị trí chạy, cách deploy (SSH/rsync/API), có MySQL cho e2e không? Có môi trường staging không?
15. **Q-OPS-4**: Chính sách backup của hosting; thời gian lưu giữ dữ liệu dược bắt buộc theo quy định?
16. **Q-OPS-5**: Tên miền, HTTPS, origin frontend (cho `CORS_ORIGINS`); client là web, mobile hay cả hai (ảnh hưởng token/cookie, Q-AUTH-4)?

## Auth (`auth`)

17. **Q-AUTH-1**: Có cần giới hạn tốc độ `POST /auth/login` (đề xuất 5 lần/phút/IP) và khóa tạm sau N lần sai không?
18. **Q-AUTH-2**: Thời hạn token hiện 15 phút / 7 ngày — giữ nguyên hay đổi (ví dụ kho dùng thiết bị chung cần phiên ngắn hơn)?
19. **Q-AUTH-3**: Mỗi user được đăng nhập đồng thời mấy thiết bị? (hiện không giới hạn; mỗi lần login tạo thêm một refresh token).
20. **Q-AUTH-4**: Giữ dùng chung `Authorization: Bearer` hay chuyển refresh token sang cookie httpOnly (phụ thuộc loại client: web/mobile)?

## Vai trò (`roles`)

21. **Q-ROLES-1**: Có cần tạo role tùy biến và phân quyền động (bảng permission) không, hay 4 role cố định là đủ? Nếu cần, module này mở rộng đáng kể (RBAC động) và mọi `@Roles` phải đổi cơ chế.
22. **Q-ROLES-2**: Danh sách 4 role đã đủ chưa? (ví dụ cần `NHAN_VIEN_BAN_HANG`/`KINH_DOANH` để lập phiếu xuất, `THU_KHO`, `DUOC_SI` chịu trách nhiệm chuyên môn?) Xem thêm Q-XUAT-1.

## Người dùng (`users`)

23. **Q-USERS-1**: `maNV` đã có hệ thống mã riêng cần giữ (ví dụ nhập tay) hay để hệ thống tự sinh `NV0002…`?
24. **Q-USERS-2**: Có cần buộc user đổi mật khẩu ở lần đăng nhập đầu sau khi admin tạo/đặt lại mật khẩu (cần thêm cờ `phaiDoiMatKhau` trong `User`)?
25. **Q-USERS-3**: Quy tắc mật khẩu (≥ 8, hoa/thường/số) có phù hợp? Có hết hạn mật khẩu định kỳ không?
26. **Q-USERS-4**: `QUAN_LY_KHO` có được tạo/khóa tài khoản nhân viên kho không, hay chỉ `ADMIN`?
27. **Q-USERS-5**: Email có bắt buộc không (hiện tùy chọn)?

## Loại hàng (`loai-hang`)

28. **Q-LOAI-1**: Danh sách loại hàng ban đầu có sẵn chưa (để làm dữ liệu import), có phân cấp (ví dụ Thuốc → Kháng sinh → Penicillin) không?
29. **Q-LOAI-2**: Loại hàng có cần mã (ví dụ `KS`, `GD`) để in phiếu không?

## Hàng hóa (`hang-hoa`)

30. **Q-HH-1** ⭐ (đã triển khai theo đề xuất `donViTinhGia`): Ba mức giá hiện tại (`giaNhap`, `giaHienThi`, `giaToiThieu`) tính theo đơn vị nào — hộp, hay đơn vị cơ bản? Đề xuất `donViTinhGia` (P-07). Xem thêm [schema-notes.md](01-data/schema-notes.md) §6.
31. **Q-HH-2**: `tenSP` có cần duy nhất (theo `tenSP + quyCach`)? Đề xuất không bắt buộc duy nhất, chỉ cảnh báo khi trùng cả `tenSP` và `quyCach`.
32. **Q-HH-3**: Cần thêm các trường dược: hoạt chất, hàm lượng, dạng bào chế, nhà sản xuất, nước sản xuất, mã vạch/GTIN, thuế VAT?
33. **Q-HH-4**: `soDangKy` bắt buộc cho mọi thuốc hay chỉ thuốc kê đơn/kiểm soát (đề xuất hiện tại)? Có cần kiểm tra định dạng số đăng ký (ví dụ `VD-xxxxx-xx`)?
34. **Q-HH-5**: Hàng "ngừng kinh doanh" có được xuất nốt tồn còn lại không (đề xuất: được)?
35. **Q-HH-6**: `NHAN_VIEN_KHO` không được thấy `giaNhap`/`giaToiThieu` — đúng ý bạn không?
36. **Q-HH-7**: Có tồn kho tối thiểu / định mức cần cảnh báo hết hàng (cần thêm `tonToiThieu`)?

## Tỷ lệ quy đổi (`ty-le-quy-doi`)

37. **Q-TLQD-1**: Có hàng nào có đơn vị không chia hết (ví dụ vỉ = 10, hộp = 25 viên)? Đề xuất không bắt buộc chia hết giữa các đơn vị.
38. **Q-TLQD-2**: Có cần cho phép bán lẻ theo đơn vị cơ bản (lẻ viên) hay chỉ nguyên hộp/vỉ? (ảnh hưởng đến việc có xuất thiếu nguyên đơn vị lớn hay không).
39. **Q-TLQD-3**: Có cần đơn vị mặc định riêng cho nhập và cho xuất của từng hàng không?

## Kho & Vị trí (`kho-vi-tri`)

40. **Q-KHO-1**: Hiện có mấy kho, mỗi kho có bao nhiêu vị trí và quy ước đặt tên vị trí (ví dụ `A-01-03` = dãy–kệ–ô)? Có cần thêm cấp "khu/dãy" giữa kho và vị trí?
41. **Q-KHO-2**: Có cần mã kho (ví dụ `K01`) để in phiếu không?
42. **Q-KHO-3**: Có cần kho "hàng hủy / biệt trữ / chờ kiểm" (quarantine, hàng trả về) tách riêng khỏi kho bán hàng không?
43. **Q-KHO-4**: Có cần giới hạn sức chứa vị trí và cảnh báo vượt?

## Khách hàng (`khach-hang`)

44. **Q-KH-1** ⭐ (**ĐÃ CHỐT 2026-10-10**: hạn mức `soNoToiDa` trên khách, 0 = không giới hạn, chặn khi lập, sửa và xuất kho phiếu xuất; ADMIN/QUAN_LY_KHO ghi đè được bằng `vuotHanMucLyDo` và có nhật ký `phieu_xuat.credit_limit_override`; phiếu `thu_tien_ngay` không tính hạn mức): Có kiểm soát **hạn mức công nợ** và/hoặc **số ngày nợ tối đa** theo khách không? (nếu có: thêm P-12, chặn khi vượt, ai được ghi đè?)
45. **Q-KH-2**: Khách chưa khai báo ngày hết hạn GPKD có được mua không? (đề xuất hiện tại: không; có thể đổi thành cảnh báo mềm).
46. **Q-KH-3**: Khách hàng đã có mã riêng cần giữ khi import (thay vì `KH00001`)?
47. **Q-KH-4**: Một nhà thuốc có nhiều chi nhánh/địa chỉ giao khác nhau không (cần bảng địa chỉ giao)?
48. **Q-KH-5**: Có cần lưu thêm Chứng chỉ hành nghề dược sĩ / GCN đạt GPP của nhà thuốc (ngoài GPKD) và kiểm tra hạn của chúng?

## Nhà cung cấp (`nha-cung-cap`)

49. **Q-NCC-1**: Hồ sơ pháp lý bắt buộc để "xác minh" gồm những loại nào chính xác (GPKD + GCN đủ điều kiện kinh doanh dược; còn GDP/GMP, chứng chỉ hành nghề)? Hiện đề xuất hai loại có sẵn trong schema.
50. **Q-NCC-2**: Giấy phép hết hạn sau khi đã xác minh: tự hạ trạng thái xác minh bằng job, hay chỉ chặn nhập hàng khi kiểm tra (đề xuất hiện tại: chặn khi nhập, không tự hạ)?
51. **Q-NCC-3**: NCC đã có mã riêng cần giữ khi import (thay vì `NCC0001`)?
52. **Q-NCC-4**: Có cần điều khoản thanh toán (số ngày nợ) theo NCC để tính hạn trả và aging phải trả?
53. **Q-NCC-5**: NCC "tu_choi" có được xác minh lại sau khi bổ sung hồ sơ không (đề xuất: có)?

## Phương tiện vận chuyển (`phuong-tien-van-chuyen`)

54. **Q-PT-1**: Phương tiện vận chuyển của công ty hay của nhà cung cấp/đơn vị vận chuyển thuê ngoài? (ảnh hưởng việc lưu tài xế, chủ xe).
55. **Q-PT-2**: Giao hàng cho khách có dùng xe của công ty và cần ghi nhận xe/tài xế trên phiếu xuất không (P-09)?
56. **Q-PT-3**: Định dạng biển số thực tế (xe máy, biển tạm, biển nước ngoài) có ngoài mẫu `\d{2}[A-Z]{1,2}\d{4,6}` không?
57. **Q-PT-4**: Có cần theo dõi nhiệt độ khi vận chuyển hàng lạnh (nhập tay nhiệt độ lúc nhận hàng)?

## Số lô (`so-lo`)

58. **Q-LO-1** ⭐: Ngưỡng "cận date" bao nhiêu ngày (đề xuất 90)? Có ngưỡng khác theo loại hàng (ví dụ vắc-xin 30 ngày) không?
59. **Q-LO-2** ⭐: Có quy định **thời hạn còn lại tối thiểu** khi nhập (ví dụ ≥ 6 tháng hoặc ≥ 2/3 hạn) và khi xuất cho nhà thuốc (ví dụ ≥ 90 ngày)? (`MIN_SHELF_LIFE_DAYS_*`)
60. **Q-LO-3**: Cùng một số lô có thể trùng giữa hai nhà sản xuất khác nhau của cùng một hàng? (hiện unique theo hàng + tên lô).
61. **Q-LO-4**: Lô hết hạn còn tồn xử lý thế nào — chỉ điều chỉnh tồn về 0 (hủy thuốc) hay cần quy trình/biên bản hủy riêng?
62. **Q-LO-5**: Có cho đăng ký lô đã hết hạn trong trường hợp import dữ liệu cũ không?

## Tồn kho (`ton-kho`)

63. **Q-TK-1** ⭐ (**ĐÃ CHỐT 2026-10-10**: không giữ chỗ tồn, chỉ chặn lúc xuất kho): Có cần **giữ chỗ tồn** khi lập phiếu xuất (để hai phiếu nháp không cùng "ăn" một lượng tồn, hiển thị `tồn khả dụng = tồn − đã giữ`)? Đề xuất hiện tại: không, chỉ chặn lúc xuất kho. Nếu cần: thêm `TonKho.soLuongGiu` hoặc bảng `GiuCho`.
64. **Q-TK-2**: Quy trình **kiểm kê** thực tế: kiểm toàn bộ theo đợt (cần phiếu kiểm kê, khóa kho tạm thời) hay điều chỉnh lẻ từng lô như đề xuất?
65. **Q-TK-3**: Hàng thường có được để ở vị trí cấp đông không (hiện cho phép)? Hàng lạnh có bắt buộc 100% ở vị trí cấp đông (hiện bắt buộc)?
66. **Q-TK-4**: Hiển thị số lượng cho người dùng theo đơn vị nào — chỉ đơn vị cơ bản, hay quy đổi dạng "3 hộp 2 vỉ 5 viên"?
67. **Q-TK-5**: Hàng hết hạn còn tồn xử lý bằng điều chỉnh về 0 (hủy) hay chuyển sang một vị trí/kho "hàng hủy" trước khi tiêu hủy chính thức?
68. **Q-TK-6**: Có cần tồn đầu kỳ nhập bằng phiếu nhập "đầu kỳ" hay bằng điều chỉnh khi đưa hệ thống vào chạy? (liên quan [seed-strategy.md](01-data/seed-strategy.md) §7).

## Phiếu nhập hàng (`phieu-nhap-hang`)

69. **Q-NHAP-1**: Có cần **đơn đặt hàng (PO)** trước phiếu nhập, nhập hàng nhiều lần theo một PO? (hiện bỏ qua).
70. **Q-NHAP-2** ⭐ (**ĐÃ CHỐT 2026-10-10**: giữ như hiện tại, NV kho lập, ADMIN/QL kho xác nhận nhập kho): Có cần bước **duyệt** giữa lập phiếu và xác nhận nhập kho (ví dụ phiếu giá trị lớn phải `QUAN_LY_KHO` xác nhận), hay NVK tự xác nhận như hiện đề xuất?
71. **Q-NHAP-3**: Có cần **kiểm tra chất lượng / biệt trữ** khi nhận (hàng chưa kiểm không được xuất)? Nếu có, cần trạng thái lô/vị trí "biệt trữ".
72. **Q-NHAP-4**: Có **VAT, chiết khấu, chi phí vận chuyển** trên phiếu nhập không? Công nợ phải trả tính theo tổng sau thuế?
73. **Q-NHAP-5**: Phiếu nhập có bắt buộc đính kèm hóa đơn / COA của lô (liên quan file-upload)?
74. **Q-NHAP-6**: Hủy phiếu đã nhập kho có cần **duyệt kép** (người đề nghị ≠ người duyệt)?
75. **Q-NHAP-7**: Khi sửa phiếu nháp, thay toàn bộ dòng (đề xuất) hay sửa/xóa/thêm từng dòng riêng lẻ qua endpoint dòng?
76. **Q-NHAP-8**: Đơn giá nhập có cần đối chiếu/cảnh báo so với `giaNhap` của hàng hóa không (lệch quá X%)?

## Phiếu thanh toán (`phieu-thanh-toan`)

77. **Q-TT-1**: NCC có **điều khoản thanh toán** (số ngày nợ) để tính hạn trả và phân loại quá hạn trong aging phải trả không? (liên quan Q-NCC-4)
78. **Q-TT-2**: Có cần **tách nhiệm vụ** (người lập khác người hủy / cần duyệt khi hủy) cho phiếu thanh toán?
79. **Q-TT-3** ⭐: Một lần trả tiền thực tế thường gộp **nhiều phiếu nhập** cùng NCC? Nếu có, cần chức năng thanh toán gộp (phân bổ vào nhiều phiếu), schema hiện chỉ có 1 phiếu nhập/1 phiếu thanh toán.
80. **Q-TT-4**: Có thanh toán **tạm ứng** trước khi có phiếu nhập không?
81. **Q-TT-5**: Có cần lưu **số chứng từ ngân hàng / tài khoản** cho thanh toán chuyển khoản?

## Phiếu xuất hàng (`phieu-xuat-hang`)

82. **Q-XUAT-1** ⭐ (**ĐÃ CHỐT 2026-10-10**: nhân viên kho lập phiếu xuất, giữ 4 role cố định): Ai lập phiếu xuất trong thực tế — nhân viên kho hay một vai trò **bán hàng/kinh doanh** riêng (cần thêm role `NHAN_VIEN_BAN_HANG` và tách bước "lập đơn" khỏi "xuất kho")?
83. **Q-XUAT-2**: Có cần **giữ chỗ tồn** ngay khi lập/duyệt phiếu (xem Q-TK-1) và bước **soạn hàng** trước khi xuất kho?
84. **Q-XUAT-3**: **Trả hàng / đổi hàng** sau khi giao có cần ngay từ đầu không (hiện không hỗ trợ hủy phiếu đã giao)?
85. **Q-XUAT-4**: Giá bán lấy từ đâu — nhập tay mỗi dòng (đề xuất), mặc định điền `giaHienThi`, hay có bảng giá theo nhóm khách/chiết khấu?
86. **Q-XUAT-5**: Có hóa đơn VAT / chiết khấu / phí vận chuyển trên phiếu xuất, và công nợ tính theo tổng sau thuế?
87. **Q-XUAT-6**: Có buộc **FEFO** (chặn khi không theo thứ tự hạn) hay chỉ cảnh báo mềm như đề xuất?
88. **Q-XUAT-7**: Thuốc **kiểm soát đặc biệt / kê đơn** có cần thêm điều kiện khi bán (ví dụ khách phải có chứng chỉ riêng, ghi nhận người nhận, báo cáo cơ quan quản lý)?
89. **Q-XUAT-8**: Giao hàng có xác nhận (người nhận, chữ ký, ảnh) không, và có giao một phần nhiều đợt không?
90. **Q-XUAT-9**: Phiếu xuất có gắn **phương tiện/tài xế** (P-09) không?

## Phiếu thu công nợ (`phieu-thu-cong-no`)

91. **Q-THU-1**: Có **hạn thanh toán/số ngày nợ** theo từng khách (liên quan Q-KH-1) để tính nợ quá hạn thay vì tính tuổi nợ từ ngày xuất kho?
92. **Q-THU-2** ⭐: Khách thường trả một lần cho **nhiều phiếu**? Nếu có, cần thu gộp và phân bổ (hiện chỉ gắn một phiếu xuất).
93. **Q-THU-3**: Có **chiết khấu thanh toán**, làm tròn/xóa nợ nhỏ (write-off), hoặc thu **tạm ứng** trước khi xuất hàng?
94. **Q-THU-4**: Có cần lưu thông tin ngân hàng/số chứng từ và đối soát với sao kê?
95. **Q-THU-5**: Có cần nhắc nợ/báo cáo nợ quá hạn tự động (job, email/SMS)?
96. **Q-THU-6**: Có cần **tách nhiệm vụ** (người hủy khác người lập) cho phiếu thu (liên quan Q-TT-2)?

## Báo cáo (`bao-cao`)

97. **Q-BC-1**: Báo cáo có cần xuất **Excel/CSV/PDF** không, và mẫu biểu cụ thể (đặc biệt mẫu báo cáo gửi cơ quan quản lý dược)?
98. **Q-BC-2**: Mốc tính **tuổi nợ**: từ ngày xuất kho (đề xuất), ngày giao hàng, hay ngày đến hạn theo điều khoản thanh toán (cần dữ liệu hạn thanh toán — Q-KH-1, Q-NCC-4)?
99. **Q-BC-3** ⭐: Có cần **giá vốn hàng bán / lợi nhuận gộp**? Nếu có, chọn phương pháp giá vốn (bình quân gia quyền theo lô như giá trị tồn hiện tại, FIFO, bình quân di động toàn kho) vì kết quả khác nhau.
100. **Q-BC-4**: Doanh thu tính trước hay sau VAT/chiết khấu (liên quan Q-XUAT-5)? Mốc ghi nhận doanh thu: ngày xuất kho (đề xuất) hay ngày giao hàng?
101. **Q-BC-5**: Cần báo cáo nào khác: tồn tối thiểu/sắp hết hàng, hàng chậm luân chuyển, thuốc kiểm soát đặc biệt (xuất–nhập–tồn riêng), truy vết lô (lô X từ NCC nào, bán cho khách nào), doanh số theo nhân viên?
102. **Q-BC-6**: Có cần xem **tồn tại một ngày trong quá khứ** (snapshot) theo kho/lô — hiện chỉ dựng được tổng theo hàng trong báo cáo nhập–xuất–tồn?
