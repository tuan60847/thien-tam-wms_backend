# Roadmap triển khai

Không ước lượng ngày tháng. Kích thước tương đối: **S** (≈ 1 ngày làm việc của một dev), **M** (2–3 ngày), **L** (4–6 ngày), **XL** (>1 tuần). Mỗi milestone kết thúc khi toàn bộ test (unit + e2e) của milestone xanh và `docs/06-api/endpoints-catalog.md` khớp code.

## Tổng quan

```
M0 Nền tảng ──► M1 Định danh ──► M2 Danh mục hàng ──► M3 Kho & đối tác ──► M4 Lô & tồn kho
                                                                                   │
                         M7 Báo cáo & file ◄── M6 Xuất hàng & thu nợ ◄── M5 Nhập hàng & thanh toán
                                  │
                                  ▼
                          M8 Hardening & triển khai
```

## M0 — Nền tảng chung (L) — ✅ đã triển khai (2026-10-01)

Mục tiêu: dựng "hợp đồng" kỹ thuật để các module sau chỉ việc cắm vào.

| Việc | Ghi chú |
|---|---|
| Global prefix `api/v1`; chuyển route auth sang `/api/v1/auth/*` | **Breaking** với client hiện tại và `docs/auth/*`, test e2e auth cần cập nhật |
| `AppException` + `error-codes.ts` + `HttpExceptionFilter` | Body lỗi chuẩn; map lại lỗi của auth sang `code` (giữ nguyên `message`) |
| Pagination helper + `PaginationQueryDto` + `PagedResponse<T>` | [pagination-filtering.md](../03-cross-cutting/pagination-filtering.md) |
| Logger pino + request-id + redact | |
| Swagger (`/api/docs`, chỉ bật ngoài production hoặc có basic-auth) | |
| Health check `/api/v1/health` (`@Public`) | |
| `helmet`, CORS theo env | |
| `ClockService`, `CodeGeneratorService` + bảng `BoDemMa` | |
| Hằng số role + seed thêm `QUAN_LY_KHO`, `KE_TOAN` | |
| `configureApp(app)` dùng chung (`src/app.setup.ts`): prefix, `ValidationPipe`, filter, `enableShutdownHooks`; `main.ts` và e2e cùng gọi | tránh test chạy trên cấu hình khác production |
| Factory test dùng chung (`src/testing/factories.ts`, `test/helpers/factories.ts`) và `expectRoleMatrix` | [unit-testing.md](../04-testing/unit-testing.md), [e2e-testing.md](../04-testing/e2e-testing.md) |
| Migration thêm trường audit chung (xem [schema-notes.md](../01-data/schema-notes.md)) | Làm một lần ở đây để tránh migrate rải rác |
| Quyết định giữ/bỏ `@nestjs/observe` | |

Phụ thuộc: không. Là điều kiện cho mọi milestone sau.

**Kết quả thực tế M0:** xong tất cả mục trên trừ: `helmet`/CORS cấu hình qua env (xong), rate limit login (để M1 cùng `@nestjs/throttler`), `createdById`/`updatedById` (thêm cùng module cần dùng), `P-17`/`P-21` và các trường phiếu P-07…P-10 (thêm ở milestone tương ứng). `@nestjs/observe` đã gỡ. Chi tiết trong báo cáo cuối M0.

## M1 — Định danh (M) — ✅ đã triển khai (2026-10-02)

`roles` → `users`. Lý do làm trước: cần có user thật ở nhiều role để test phân quyền ở mọi module sau; Auth đã xong nên chỉ còn quản lý user/role. Thêm `@nestjs/throttler` cho login.

**Kết quả thực tế M1:** `RolesModule` (3 endpoint), `UsersModule` (7 endpoint), `RefreshTokenModule` tách khỏi Auth, giới hạn đăng nhập theo IP (`LOGIN_RATE_LIMIT`, mặc định 5/phút), validator `IsStrongPassword`/`IsUsername`, transformer `Trim`/`LowerTrim`/`ToBoolean`. Phát hiện và sửa khi viết e2e: ràng buộc "luôn còn một admin" không an toàn khi hai admin hạ quyền nhau đồng thời — xem `users.md` BR-05.

## M2 — Danh mục hàng hóa (M) — ✅ đã triển khai (2026-10-02)

`loai-hang` → `hang-hoa` → `ty-le-quy-doi`. Lý do: là danh mục gốc của mọi chứng từ; không phụ thuộc kho/đối tác. `hang-hoa` và `ty-le-quy-doi` ràng buộc lẫn nhau (phải có đúng một đơn vị cơ bản), nên làm chung một milestone.

**Kết quả thực tế M2:** `LoaiHangModule` (5 endpoint), `HangHoaModule` (5), `TyLeQuyDoiModule` (5); migration `m2_hang_hoa_catalog` (P-17 `maSP`, P-07 một phần: `HangHoa.donViTinhGia`, P-02 `createdById`/`updatedById` cho `HangHoa`). **Câu hỏi #30 (Q-HH-1) chưa được trả lời nên áp dụng phương án đề xuất** — giá tính theo `donViTinhGia`; nếu bạn chọn phương án khác (giá theo đơn vị cơ bản) thì sửa ở `hang-hoa.rules.ts`/`mapper` và bỏ cột. Chưa làm: kiểm tra "đơn vị đang nằm trong phiếu nháp" khi xóa đơn vị (cần cột `donViTinh` trên dòng phiếu, thêm ở M5).

## M3 — Kho & đối tác (L) — ✅ đã triển khai (2026-10-06)

`kho-vi-tri`, `khach-hang`, `nha-cung-cap`, `phuong-tien-van-chuyen` — bốn module độc lập nhau, làm song song được. Phải xong trước M4–M5 vì tồn kho cần vị trí, phiếu cần đối tác. `nha-cung-cap` có luồng "xác minh" ảnh hưởng phiếu nhập.

**Kết quả thực tế M3:** `KhoViTriModule` (10 endpoint), `KhachHangModule` (5), `NhaCungCapModule` (6, gồm `/xac-minh`), `PhuongTienVanChuyenModule` (5); migration `m3_kho_doi_tac` (`maNCC`, ngày hết hạn GPKD/GCN, người xác minh, người tạo/sửa, `isXeLanh`, nới độ dài cột). Các hàm cho milestone sau đã có sẵn và có test: `ViTriService.assertReceivable`, `KhachHangService.assertCanBuy`, `NhaCungCapService.assertCanSupply`, `PhuongTienService.assertUsable`. **Chưa làm:** hạn mức công nợ khách (chờ câu #44); kiểm tra xóa vị trí mới chỉ xét `TonKho` — M4/M5 bổ sung sổ biến động và dòng chứng từ.

## M4 — Lô & tồn kho (L) — ✅ đã triển khai (2026-10-06)

**Kết quả thực tế M4:** `SoLoModule` (list/detail/create/update/delete) và `TonKhoModule` (list, chi tiết, tổng hợp, gợi ý FEFO, sổ biến động, chuyển vị trí, điều chỉnh, đối soát); migration `m4_ton_kho_bien_dong` (bảng `bien_dong_ton_kho`, `CHECK so_luong >= 0` trên `ton_kho`, người tạo/sửa lô); job `expiry-scan` (00:05) và `stock-reconcile` (02:30) qua `@nestjs/schedule`, tắt bằng `JOBS_ENABLED=false`. Đường ghi tồn duy nhất cho M5/M6: `TonKhoService.increase/decrease` (nhận `tx`, tự ghi sổ biến động). **Chưa làm:** giữ hàng/đặt chỗ (câu #63), `chiHetHang` trong tổng hợp; unit test service ton-kho/so-lo mới ở mức quy tắc thuần, phần còn lại do e2e phủ.

`so-lo` → `ton-kho`. Đây là **lõi rủi ro cao nhất** (tính đúng đắn của số liệu tồn): cập nhật có điều kiện, sổ biến động `BienDongTonKho`, chuyển vị trí, điều chỉnh, quy tắc kho lạnh, gợi ý FEFO. Cũng thêm job quét lô cận date/hết hạn ([background-jobs.md](../03-cross-cutting/background-jobs.md)). Phải xong và được test kỹ (kể cả test đồng thời) **trước** khi viết phiếu nhập/xuất.

## M5 — Nhập hàng & thanh toán NCC (L) — ✅ đã triển khai (2026-10-06)

**Kết quả thực tế M5:** `PhieuNhapHangModule` (7 endpoint: list, chi tiết, tạo, sửa, xóa nháp, `xac-nhan`, `huy`) và `PhieuThanhToanModule` (4 endpoint + `GET /nha-cung-cap/:id/cong-no`); migration `m5_phieu_nhap_thanh_toan` (đơn vị/hệ số/số lượng cơ bản/vị trí trên dòng, người xác nhận/hủy, phương thức và hủy trên thanh toán, CHECK số lượng/đơn giá/số tiền). Xác nhận gọi `TonKhoService.increase`, hủy phiếu đã nhập gọi `decrease` (`huy_nhap`). **Lệch so với kế hoạch:** (1) xác nhận nhập kho chỉ `ADMIN`/`QUAN_LY_KHO` (kế hoạch ghi cả `NHAN_VIEN_KHO`, xem Q-NHAP-2); (2) hủy phiếu nháp **không** xóa lô mồ côi (dòng của phiếu hủy vẫn tham chiếu lô), chỉ xóa phiếu nháp mới dọn lô; (3) route công nợ NCC nằm trong `PhieuThanhToanModule`, không phải `NhaCungCapController`, để tránh phụ thuộc vòng; (4) thuộc tính `conNoSauKhiTra` là số còn nợ của phiếu nhập tại thời điểm đọc.

`phieu-nhap-hang` → `phieu-thanh-toan`. Làm nhập trước xuất vì tồn phải có hàng thì mới có gì để xuất, và e2e M6 dùng phiếu nhập để dựng dữ liệu. Thanh toán NCC làm ngay sau vì cần phiếu nhập đã xác nhận và có cùng khuôn với thu công nợ.

## M6 — Xuất hàng & thu công nợ (XL) — ✅ đã triển khai (2026-10-06)

**Kết quả thực tế M6:** `PhieuXuatHangModule` (8 endpoint: list, chi tiết, tạo, sửa, xóa, `xuat-kho`, `giao-hang`, `huy`) và `PhieuThuCongNoModule` (4 endpoint + `GET /khach-hang/:id/cong-no`); migration `m6_phieu_xuat_thu_cong_no` (đơn vị/hệ số/số lượng cơ bản/vị trí trên dòng, xe/ngày xuất/ngày giao thực tế/người xuất/hủy trên phiếu, phương thức/hủy trên phiếu thu, CHECK). Xuất kho gọi `TonKhoService.decrease` (`xuat_kho`), hủy sau xuất gọi `increase` (`huy_xuat`, bỏ qua kiểm vị trí hoạt động). Kiểm tra giá tối thiểu theo đơn vị (chỉ quản lý/admin được bán dưới giá, có nhật ký), cảnh báo FEFO mềm, tuổi nợ theo nhóm 0-30/31-60/61-90/>90. **Chưa làm:** hạn mức công nợ khách (câu #44: `hanMucCongNo` và `vuotHanMuc` trả `null`), giữ hàng khi nháp (câu #63), role bán hàng riêng (câu #82). **Lệch so với kế hoạch:** route công nợ khách nằm trong `PhieuThuCongNoModule` (không phải `KhachHangController`) để tránh phụ thuộc vòng; `conNoSauKhiThu` là số còn nợ của phiếu xuất tại thời điểm đọc; `computeTotals`/`lineAmount` chuyển sang `common/money.ts` dùng chung cho nhập/xuất.

`phieu-xuat-hang` → `phieu-thu-cong-no`. Phức tạp nhất: FEFO, kiểm tra giấy phép khách, giá tối thiểu, hạn mức công nợ (nếu chốt), hoàn tác khi hủy. Sau milestone này hệ thống chạy được trọn vòng nhập → lưu kho → xuất → thu tiền: **đây là MVP**.

## M8 — Bổ sung theo màn hình MISA (đã triển khai một phần, 2026-10-08)

Schema bổ sung (migration `m8_bo_sung_misa`, chỉ thêm): nhóm đối tác, điều khoản thanh toán, nhân viên kinh doanh, tài khoản ngân hàng, địa điểm giao hàng, báo giá, trả lại hàng bán, đối trừ chứng từ, và các cột mới trên khách hàng, nhà cung cấp, hàng hóa, phiếu xuất, dòng phiếu xuất, phiếu thu. **Đã có API và test:** `nhom-doi-tac`, `dieu-khoan-thanh-toan`, `nhan-vien-kinh-doanh`; các trường mới của khách hàng, nhà cung cấp, hàng hóa; phiếu xuất (mặc định từ khách, ảnh chụp thông tin khách, chiết khấu và thuế theo dòng, tổng = hàng − chiết khấu + thuế, hạn thanh toán, **hạn mức nợ chặn khi lập và khi xuất kho** = câu #44, giá vốn ước tính theo giá nhập); phiếu thu (người nộp, ngày ghi sổ quỹ, nhân viên); công nợ khách (hạn mức thật, hạn thanh toán, số ngày quá hạn). **Báo giá** đã có API (lập, sửa, xóa, chuyển thành phiếu xuất chọn lô). **Tài khoản ngân hàng** (khách và NCC) và **địa điểm giao hàng** đã có API. **Cũng đã có:** chiết khấu thanh toán trên phiếu thu (cộng thêm vào số trừ nợ, chưa hỗ trợ thu gộp), đổi `tinhTrangNo`, thu tiền ngay (`hinhThucThanhToan = thu_tien_ngay`: xuất kho tự lập phiếu thu đủ tổng phiếu, không tính hạn mức nợ).

## M9 — Đối trừ, thu gộp, trả lại hàng bán (đã triển khai, 2026-10-08)

Migration `m9_doi_tru_tra_hang` (giá trị `tra_hang` cho sổ biến động; chuyển mỗi phiếu thu cũ thành một khoản đối trừ). **Công nợ phiếu xuất = tổng thanh toán − Σ khoản đối trừ còn hiệu lực − giá trị hàng đã trả lại**, tính ở `phieu-xuat-hang.debt.ts`. Thu gộp: một phiếu thu trả nhiều phiếu của một khách; tiền chưa áp ở lại phiếu thu (tạm ứng) và áp sau bằng đối trừ; bỏ đối trừ trả tiền về phiếu thu; hủy phiếu thu bỏ mọi khoản đối trừ. Trả lại hàng bán: nháp → xác nhận (nhập lại kho đúng vị trí, ghi sổ `tra_hang`) → hủy; bắt buộc gắn phiếu xuất; không vượt số đã bán; giá trị trả không gồm VAT và không được lớn hơn số còn nợ (đã thu đủ thì phải bỏ đối trừ hoặc hủy phiếu thu trước). Phiếu xuất đã có khoản đối trừ hiệu lực hoặc phiếu trả lại thì không hủy được.

## M7 — Báo cáo & file đính kèm (L)

**Tiến độ M7 (2026-10-08): xong.** `bao-cao` đã triển khai đủ 9 báo cáo (xem ghi chú lệch bên dưới) và `tep-dinh-kem` đã xong (lưu file trên đĩa theo `UPLOAD_DIR`, MySQL giữ đường dẫn; migration `m7_tep_dinh_kem`; xem [file-upload.md](../03-cross-cutting/file-upload.md)). **Lệch so với `bao-cao.md`:** doanh thu = tiền hàng − chiết khấu (chưa VAT) và có thêm giá trị hàng trả lại, doanh thu thuần; nhập–xuất–tồn thêm cột `traHang`; công nợ phải thu trừ cả hàng trả lại; công nợ tại ngày quá khứ chỉ là xấp xỉ (sổ đối trừ không lưu ngày bỏ); không có xuất Excel, chưa có giá vốn hàng bán và lợi nhuận.

`bao-cao` (tồn kho, cận date/hết hạn, nhập–xuất–tồn, doanh thu, aging công nợ) và `tep-dinh-kem` (lưu đĩa máy chủ: scan giấy phép, chứng từ nhập, ảnh sản phẩm). Báo cáo làm sau cùng vì đọc từ mọi module và cần dữ liệu thật để kiểm chứng số liệu.

## M8 — Hardening & triển khai (M)

Rà soát phân quyền toàn bộ endpoint theo [permissions.md](../03-cross-cutting/permissions.md), test tải nhẹ trên truy vấn báo cáo, chỉ mục DB, backup, kịch bản deploy PM2/Jenkins ([deployment.md](../05-ops/deployment.md)), runbook.

## Bảng phụ thuộc

| Module | Cần có trước |
|---|---|
| `roles` | auth (đã có) |
| `users` | `roles` |
| `loai-hang` | — |
| `hang-hoa` | `loai-hang` |
| `ty-le-quy-doi` | `hang-hoa` |
| `kho-vi-tri` | — |
| `khach-hang` | — |
| `nha-cung-cap` | — |
| `phuong-tien-van-chuyen` | — |
| `so-lo` | `hang-hoa` |
| `ton-kho` | `so-lo`, `kho-vi-tri`, `hang-hoa`, `ty-le-quy-doi` |
| `phieu-nhap-hang` | `nha-cung-cap`, `so-lo`, `ton-kho`, `kho-vi-tri`, `ty-le-quy-doi`, `phuong-tien-van-chuyen` |
| `phieu-thanh-toan` | `phieu-nhap-hang` |
| `phieu-xuat-hang` | `khach-hang`, `so-lo`, `ton-kho`, `ty-le-quy-doi` |
| `phieu-thu-cong-no` | `phieu-xuat-hang` |
| `bao-cao` | tất cả module dữ liệu |

## Điểm cắt nếu cần thu hẹp

Có thể hoãn sang sau MVP mà không phá luồng chính: `tep-dinh-kem`, export Excel, `phuong-tien-van-chuyen`, báo cáo doanh thu theo nhân viên, chuyển vị trí hàng. Không thể hoãn: M0–M6.

Migration `m10_bo_sung_hoan_thien` (chỉ thêm): `phieu_xuat_hang.phuong_thuc_thu` (phương thức của phiếu thu tự lập khi xuất kho phiếu `thu_tien_ngay`, truyền lúc xuất kho ghi đè được), unique `(chủ, số tài khoản, ngân hàng)` cho tài khoản ngân hàng của khách và của nhà cung cấp, `chi_tiet_bao_gia.thu_tu` (giữ thứ tự dòng báo giá). Chuyển báo giá thành phiếu xuất chạy trong một transaction có khóa dòng báo giá nên hai yêu cầu đồng thời chỉ tạo một phiếu.
