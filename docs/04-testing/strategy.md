# Chiến lược kiểm thử

## 1. Nguyên tắc

1. **Mỗi quy tắc nghiệp vụ (BR-xx) và mỗi mã lỗi trong module doc phải có ít nhất một test** trỏ tới nó. Module không được coi là xong nếu còn BR hoặc mã lỗi chưa có test.
2. Kiểm thử đúng chỗ rẻ nhất: logic thuần → unit; luồng nhiều bảng/giao dịch/đồng thời/phân quyền → e2e trên DB thật. Không dùng mock để "chứng minh" tính đúng của truy vấn SQL.
3. Không có kiểm thử thủ công thay thế: nếu một case nằm trong plan thì nó nằm trong code.
4. Test phải xác định (deterministic): thời gian qua `ClockService` giả, không phụ thuộc thứ tự chạy, không phụ thuộc dữ liệu seed dùng chung.
5. Mọi bug sửa xong kèm một test hồi quy tái hiện bug.

## 2. Kim tự tháp và phân bổ

| Tầng | Công cụ | Chạm DB? | Vai trò | Tỉ lệ ước lượng |
|---|---|---|---|---|
| Unit — hàm thuần (`*.rules.ts`, mapper, helper) | Vitest | không | quy tắc, tính toán tiền/đơn vị/ngày, bảng chân trị | ~35% |
| Unit — service với Prisma giả | Vitest + stub/`vitest-mock-extended` | không | điều phối: gọi đúng collaborator, ném đúng lỗi, rollback logic | ~35% |
| Unit — DTO/validator/guard/filter | Vitest | không | cú pháp, phân quyền metadata | ~10% |
| E2E | Vitest + Supertest + MySQL test | có | luồng nghiệp vụ, giao dịch, đồng thời, phân quyền, bất biến tồn | ~20% |

Số case thực tế theo module: [test-matrix.md](test-matrix.md).

## 3. Cái gì ở unit, cái gì ở e2e

| Nội dung | Tầng | Lý do |
|---|---|---|
| Chuyển trạng thái hợp lệ/không hợp lệ (bảng) | unit (`rules`) | thuần |
| Tính tiền, quy đổi đơn vị, làm tròn, tuổi nợ, FEFO | unit (`rules`) | thuần, nhiều biên |
| Service gọi đúng `TonKhoService.increase/decrease` với đúng tham số | unit | điều phối |
| Rollback toàn bộ khi một dòng lỗi | **e2e** (và unit cho nhánh gọi) | cần transaction thật |
| Cập nhật đồng thời (hai xuất kho song song) | **e2e** | cần DB thật |
| Tính đúng của `groupBy`/`$queryRaw` ở báo cáo | **e2e** | SQL thật |
| Unique constraint, FK, CHECK | **e2e** | ràng buộc DB |
| Phân quyền theo role × endpoint | **e2e** | guard thật + JWT thật |
| Body lỗi chuẩn (`code`, `requestId`) | unit (filter) + e2e (1 case/module) | |
| Validation DTO | unit | không cần HTTP |
| Bất biến `TonKho = Σ BienDongTonKho` | e2e (sau mỗi luồng) | |

## 4. Mục tiêu coverage

Đo bằng `vitest run --coverage` (v8) trên **unit**; e2e không tính vào coverage.

| Phạm vi | Dòng | Nhánh | Ghi chú |
|---|---|---|---|
| `**/*.rules.ts`, `common/decimal`, `common/pagination` | ≥ 95% | ≥ 90% | logic thuần phải gần như đủ |
| `**/*.service.ts` | ≥ 85% | ≥ 80% | |
| `phieu-*.service.ts`, `ton-kho.service.ts` (tiền & tồn) | ≥ 90% | ≥ 85% | rủi ro cao |
| Toàn repo | ≥ 80% | ≥ 75% | cổng CI sau M6 |
| Controller, module, DTO response | không đặt mục tiêu | | kiểm bằng e2e |

Coverage là điều kiện cần, không đủ: ma trận BR/mã lỗi ở §1 mới là tiêu chí chính.

## 5. Cổng chất lượng (CI)

Mọi PR phải qua theo thứ tự, dừng ở lỗi đầu tiên:
1. `prisma validate`
2. `yarn lint` (oxlint type-aware) — 0 lỗi, 0 warning mới
3. `tsc --noEmit`
4. `yarn test` (unit) + coverage ≥ ngưỡng
5. `yarn test:e2e` trên MySQL service container (DB `*_test`)
6. `yarn build`

Cấm: `it.skip`/`describe.skip`/`it.only` được merge (lint rule), test phụ thuộc mạng ngoài, `console.log` còn sót.

## 6. Dữ liệu và thời gian

- Dữ liệu test dựng bằng **factory** ([unit-testing.md](unit-testing.md) §4, [e2e-testing.md](e2e-testing.md) §4), không bằng seed dùng chung.
- Thời gian: `ClockService` giả cho mọi logic phụ thuộc "hôm nay"; e2e cho phép đặt đồng hồ giả bằng provider override.
- Múi giờ: test chạy với `TZ=UTC` (process) để lộ lỗi chuyển múi giờ; cố ý có các case sát nửa đêm giờ VN.
- Dịch vụ ngoài: luôn stub; không gọi mạng. Tệp đính kèm ghi vào thư mục tạm, xóa sau test.

## 7. Test không-chức-năng (nhẹ, phase 1)

- **Đồng thời:** các case song song bằng `Promise.all` đã nêu trong module (xuất kho, thu/thanh toán, xác nhận).
- **Hiệu năng cơ bản (M8):** seed 50k dòng `BienDongTonKho`, 20k dòng phiếu; đo thời gian các báo cáo và danh sách có lọc; mục tiêu p95 < 1 giây cho danh sách phân trang, < 3 giây cho báo cáo tổng hợp. Chỉ là kiểm tra cảnh báo, không phải load test.
- **Bảo mật:** test hồi quy cho IDOR không áp dụng (mọi user cùng một công ty); test cho "không lộ `password`/`tokenHash`" trên mọi response mapper; test route không `@Public` mà không token → 401 chạy tự động trên toàn bộ route (script duyệt metadata).

## 8. Ngoài phạm vi

Test giao diện, test tải đầy đủ, fuzzing, kiểm thử xâm nhập, chaos/failover DB.
