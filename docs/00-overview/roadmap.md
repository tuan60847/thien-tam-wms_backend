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

## M0 — Nền tảng chung (L)

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
| Migration thêm trường audit chung (xem [schema-notes.md](../01-data/schema-notes.md)) | Làm một lần ở đây để tránh migrate rải rác |
| Quyết định giữ/bỏ `@nestjs/observe` | |

Phụ thuộc: không. Là điều kiện cho mọi milestone sau.

## M1 — Định danh (M)

`roles` → `users`. Lý do làm trước: cần có user thật ở nhiều role để test phân quyền ở mọi module sau; Auth đã xong nên chỉ còn quản lý user/role. Thêm `@nestjs/throttler` cho login.

## M2 — Danh mục hàng hóa (M)

`loai-hang` → `hang-hoa` → `ty-le-quy-doi`. Lý do: là danh mục gốc của mọi chứng từ; không phụ thuộc kho/đối tác. `hang-hoa` và `ty-le-quy-doi` ràng buộc lẫn nhau (phải có đúng một đơn vị cơ bản), nên làm chung một milestone.

## M3 — Kho & đối tác (L)

`kho-vi-tri`, `khach-hang`, `nha-cung-cap`, `phuong-tien-van-chuyen` — bốn module độc lập nhau, làm song song được. Phải xong trước M4–M5 vì tồn kho cần vị trí, phiếu cần đối tác. `nha-cung-cap` có luồng "xác minh" ảnh hưởng phiếu nhập.

## M4 — Lô & tồn kho (L)

`so-lo` → `ton-kho`. Đây là **lõi rủi ro cao nhất** (tính đúng đắn của số liệu tồn): cập nhật có điều kiện, sổ biến động `BienDongTonKho`, chuyển vị trí, điều chỉnh, quy tắc kho lạnh, gợi ý FEFO. Cũng thêm job quét lô cận date/hết hạn ([background-jobs.md](../03-cross-cutting/background-jobs.md)). Phải xong và được test kỹ (kể cả test đồng thời) **trước** khi viết phiếu nhập/xuất.

## M5 — Nhập hàng & thanh toán NCC (L)

`phieu-nhap-hang` → `phieu-thanh-toan`. Làm nhập trước xuất vì tồn phải có hàng thì mới có gì để xuất, và e2e M6 dùng phiếu nhập để dựng dữ liệu. Thanh toán NCC làm ngay sau vì cần phiếu nhập đã xác nhận và có cùng khuôn với thu công nợ.

## M6 — Xuất hàng & thu công nợ (XL)

`phieu-xuat-hang` → `phieu-thu-cong-no`. Phức tạp nhất: FEFO, kiểm tra giấy phép khách, giá tối thiểu, hạn mức công nợ (nếu chốt), hoàn tác khi hủy. Sau milestone này hệ thống chạy được trọn vòng nhập → lưu kho → xuất → thu tiền: **đây là MVP**.

## M7 — Báo cáo & file đính kèm (L)

`bao-cao` (tồn kho, cận date/hết hạn, nhập–xuất–tồn, doanh thu, aging công nợ) và `tep-dinh-kem` (Cloudinary: scan giấy phép, chứng từ nhập, ảnh sản phẩm). Báo cáo làm sau cùng vì đọc từ mọi module và cần dữ liệu thật để kiểm chứng số liệu.

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
