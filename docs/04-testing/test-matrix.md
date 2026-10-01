# Test matrix (checklist tổng)

Nguồn sự thật về **từng case** là mục 12 của mỗi module doc. File này là bảng tổng để theo dõi tiến độ và để rà soát độ phủ. Khi module doc đổi, cập nhật con số ở đây.

Cách đếm: số gạch đầu dòng trong mục "Unit tests" / "E2E tests" của mục 12 (một dòng có thể gom vài biến thể nhỏ nên số này là cận dưới của số `it` thật). Với `auth`, bảng ghi số liệu **đã triển khai**: 17 case `auth.service` + 10 case guard (unit), 13 e2e.

## 1. Tổng hợp theo module

| Milestone | Module | Unit (mục) | E2E (mục) | BR | Endpoint | Câu hỏi mở | Trạng thái test |
|---|---|---|---|---|---|---|---|
| — | [auth](../02-modules/auth.md) | 27 (đã có) + 3 thêm ở M0/M1 | 13 (đã có) + 3 thêm | 9 | 4 | 4 | ✅ đã có (chờ retrofit M0) |
| M1 | [roles](../02-modules/roles.md) | 17 | 5 | 6 | 3 | 2 | ☐ |
| M1 | [users](../02-modules/users.md) | 30 | 9 | 11 | 7 | 5 | ☐ |
| M2 | [loai-hang](../02-modules/loai-hang.md) | 14 | 4 | 4 | 5 | 2 | ☐ |
| M2 | [hang-hoa](../02-modules/hang-hoa.md) | 28 | 7 | 11 | 5 | 7 | ☐ |
| M2 | [ty-le-quy-doi](../02-modules/ty-le-quy-doi.md) | 21 | 5 | 8 | 5 | 3 | ☐ |
| M3 | [kho-vi-tri](../02-modules/kho-vi-tri.md) | 19 | 5 | 8 | 10 | 4 | ☐ |
| M3 | [khach-hang](../02-modules/khach-hang.md) | 20 | 5 | 8 | 5 (+1 công nợ) | 5 | ☐ |
| M3 | [nha-cung-cap](../02-modules/nha-cung-cap.md) | 19 | 6 | 9 | 6 (+1 công nợ) | 5 | ☐ |
| M3 | [phuong-tien-van-chuyen](../02-modules/phuong-tien-van-chuyen.md) | 13 | 5 | 6 | 5 | 4 | ☐ |
| M4 | [so-lo](../02-modules/so-lo.md) | 24 | 7 | 11 | 5 | 5 | ☐ |
| M4 | [ton-kho](../02-modules/ton-kho.md) | 34 | 8 | 13 | 8 | 6 | ☐ |
| M5 | [phieu-nhap-hang](../02-modules/phieu-nhap-hang.md) | 44 | 9 | 13 | 7 | 8 | ☐ |
| M5 | [phieu-thanh-toan](../02-modules/phieu-thanh-toan.md) | 22 | 6 | 10 | 4 (+1 công nợ NCC) | 5 | ☐ |
| M6 | [phieu-xuat-hang](../02-modules/phieu-xuat-hang.md) | 45 | 10 | 16 | 8 | 9 | ☐ |
| M6 | [phieu-thu-cong-no](../02-modules/phieu-thu-cong-no.md) | 25 | 6 | 11 | 4 (+1 công nợ khách) | 6 | ☐ |
| M7 | [bao-cao](../02-modules/bao-cao.md) | 10 (logic thuần) | 10 (số liệu) | 12 | 9 | 6 | ☐ |
| | **Tổng (chưa kể auth)** | **385** | **107** | **157** | | **82** | |

Hạ tầng dùng chung (M0), tính riêng ở §2.

## 2. Test cho hạ tầng dùng chung (M0)

| Thành phần | Unit | E2E |
|---|---|---|
| `HttpExceptionFilter` + `AppException` + bảng `ERROR` | map từng loại exception → body chuẩn; không lộ message Prisma; mọi mã trong registry có status + message, không trùng | 1 case/module kiểm `code` |
| `PaginationQueryDto`, `paginate`, `parseSort`, `dateRangeFilter` | biên `page/pageSize`, sort ngoài whitelist, múi giờ, `totalPages` | `pageSize=1`, `page` vượt, sort lạ |
| `CodeGeneratorService` | tăng dần, reset theo ngày VN, đồng thời không trùng | hai phiếu cùng ngày không trùng mã |
| `ClockService` | `today()` theo VN quanh nửa đêm UTC | — |
| Validators dùng chung (`@IsMoney`, `@IsDateOnly`, `@IsVnPhone`, `@IsVnTaxCode`, `@IsVehiclePlate`, `@IsStrongPassword`, `@IsUsername`, `@IsQuantity`) | bảng hợp lệ/không hợp lệ | — |
| `AuditService` | ghi đúng trường, nhận `tx`, rollback theo transaction | các thao tác nhạy cảm tạo đúng 1 dòng |
| Logger/redact | `password`/token/email không lọt ra log | header `x-request-id` |
| `authConfig`, env validation | thiếu/yếu/trùng secret | — |
| Swagger setup | — | `/api/docs-json` hợp lệ khi bật; 404 khi tắt |
| Health | — | `/health` public, kiểm DB |
| Job `expiry-scan`, `stock-reconcile`, `refresh-token-cleanup`, `runExclusive` | xem [background-jobs.md](../03-cross-cutting/background-jobs.md) §7 | gọi service job, kiểm DB |
| Toàn bộ route | — | script đối chiếu metadata `@Roles`/`@Public` với catalog ([permissions.md](../03-cross-cutting/permissions.md) §5) |

## 3. Kịch bản xuyên module (luồng)

Chạy trong `test/flows.e2e-spec.ts`; mỗi luồng kết thúc bằng `GET /ton-kho/doi-soat` (`soDongLech = 0`).

| ID | Luồng | Module liên quan |
|---|---|---|
| F-01 | NCC chưa xác minh → xác minh → nhập lô mới (hàng lạnh vào vị trí cấp đông) → xác nhận → tồn đúng → thanh toán một phần → thanh toán nốt → hết nợ | nha-cung-cap, hang-hoa, so-lo, kho-vi-tri, phieu-nhap-hang, ton-kho, phieu-thanh-toan |
| F-02 | Nhập hai lô (hạn gần/xa) → `goi-y-xuat` → lập phiếu xuất theo FEFO → xuất kho → giao → thu tiền → báo cáo nhập–xuất–tồn, doanh thu, công nợ khớp | phieu-xuat-hang, phieu-thu-cong-no, bao-cao |
| F-03 | Hủy phiếu xuất sau xuất kho (QL) → tồn hoàn; có phiếu thu thì bị chặn đến khi hủy phiếu thu | phieu-xuat-hang, phieu-thu-cong-no |
| F-04 | Hai phiếu nháp tranh một lô → xuất phiếu 1 → phiếu 2 bị `TON_KHO_INSUFFICIENT` → tồn không âm | phieu-xuat-hang, ton-kho |
| F-05 | Khóa user giữa phiên → access token và refresh token đều bị từ chối | users, auth |
| F-06 | Lô hết hạn: nhập/xuất bị chặn; điều chỉnh về 0 → biến mất khỏi báo cáo hết hạn | so-lo, ton-kho, bao-cao |
| F-07 | Chuyển vị trí hợp lệ/sai chuỗi lạnh; sổ biến động hai dòng cùng tham chiếu | ton-kho |
| F-08 | Hủy phiếu nhập đã nhập kho: thành công khi tồn còn nguyên; bị chặn khi đã xuất bớt hoặc còn thanh toán | phieu-nhap-hang, phieu-thanh-toan |
| F-09 | Đồng thời: hai `xuat-kho` cùng phiếu; hai thu tiền cùng nợ; hai xác nhận nhập cùng phiếu | phieu-xuat-hang, phieu-thu-cong-no, phieu-nhap-hang |
| F-10 | Khách hết hạn GPKD giữa lúc lập và lúc xuất kho → xuất kho bị chặn, không đổi tồn | khach-hang, phieu-xuat-hang |

## 4. Ma trận phân quyền (tự động)

Mỗi module e2e gọi `expectRoleMatrix` cho từng nhóm hành động trong mục 13. Tổng số nhóm hành động ≈ số dòng của [permissions.md](../03-cross-cutting/permissions.md) §3 (≈ 90 dòng). Test tổng hợp M8 đảm bảo **không có endpoint nào** thiếu dòng quyền tương ứng.

## 5. Truy vết BR → test

Quy ước để rà soát: trong file spec, đặt mã BR/mã lỗi vào tên `it` hoặc comment đầu `it`, ví dụ `it('xác nhận phiếu rỗng → PHIEU_NHAP_EMPTY (BR-09)', …)`. Script kiểm (đề xuất, chạy ở CI) quét module doc lấy danh sách `BR-xx` và mã lỗi mục 8, quét `*.spec.ts` và `*.e2e-spec.ts`, báo mọi BR/mã lỗi **chưa xuất hiện** trong tên test. Mục tiêu: 0 thiếu sót trước khi đóng module.

## 6. Cách dùng bảng

1. Bắt đầu module: sao chép mục 12 vào checklist PR.
2. Viết test **trước hoặc cùng** code; đánh dấu từng dòng khi pass.
3. Đóng module khi: tất cả dòng mục 12 đã có test, BR/mã lỗi truy vết đủ, ma trận role xanh, bất biến đối soát giữ, coverage đạt ngưỡng ([strategy.md](strategy.md) §4).
4. Cập nhật cột "Trạng thái test" ở §1 (☐ → ✅).
