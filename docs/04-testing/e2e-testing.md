# E2E test — quy ước

Công cụ: Vitest + Supertest, MySQL thật. Cấu hình `vitest.config.e2e.ts` (`include: ['**/*.e2e-spec.ts']`, `setupFiles: ['./test/setup-env.ts']`, `fileParallelism: false`). Lệnh: `yarn test:e2e`. Hạ tầng đã có từ module Auth: `test/helpers/test-db.ts`, `test/setup-env.ts`, `test/fixtures/protected-route.controller.ts`.

## 1. Cơ sở dữ liệu test

- DB riêng `thienTamWMS_test` (tên **phải kết thúc `_test`**; helper từ chối chạy nếu không → không thể xóa nhầm DB dev).
- Cấu hình ở `.env.test` (không commit; mẫu `.env.test.example`). `setup-env.ts` nạp bằng `dotenv` với `override: true`.
- Schema: `prisma migrate deploy` trong `beforeAll` của mỗi file e2e (idempotent, nhanh khi không có migration mới). Không dùng `db push`.
- CI: dịch vụ MySQL 8 trong pipeline, tạo DB `*_test` trước khi chạy.

## 2. Song song hóa

- `fileParallelism: false`: các file e2e chạy **tuần tự** vì dùng chung một DB.
- Trong một file, các `it` chạy tuần tự (mặc định); riêng kịch bản đồng thời dùng `Promise.all` bên trong **một** `it`.
- Khi số file e2e làm thời gian > 5 phút: tách mỗi worker một schema (`thienTamWMS_test_<workerId>`) và bật song song; chưa cần ở phase 1.

## 3. Vòng đời

```
beforeAll : migrateTestDatabase() → dựng app (Test.createTestingModule({ imports: [AppModule], controllers: [fixture?] }))
            → áp dụng cùng ValidationPipe/Filter/prefix như main.ts → resetAndSeed()
beforeEach: (tùy file) reset nhóm bảng liên quan
afterAll  : app.close()
```

- Dựng app qua một hàm `createTestApp(overrides?)` (đề xuất `test/helpers/create-app.ts`) **áp dụng đúng cấu hình của `main.ts`** (prefix `api/v1`, `ValidationPipe`, `HttpExceptionFilter`, logger tắt) — tránh test chạy trên cấu hình khác production. Tách cấu hình dùng chung thành `configureApp(app)` trong `src/app.setup.ts` mà `main.ts` và test cùng gọi.
- `JOBS_ENABLED=false` trong `.env.test`.
- Provider giả được truyền qua `overrides`: `ClockService`; tệp đính kèm dùng thư mục tạm qua `UPLOAD_DIR`.

## 4. Fixture và factory (chạm DB)

`test/helpers/factories.ts` (đề xuất), nhận `PrismaService`:

```ts
createRoles(prisma)                         // 4 role
createUser(prisma, { role, trangThai? })    // mật khẩu cố định TEST_PASSWORD, bcrypt cost 4
loginAs(app, username)                      // → { accessToken, refreshToken }
createHangHoa(prisma, { lanh?, kePDon?, donVi: ['vien','vi','hop'] })
createKho(prisma, { viTri: ['A-01', { ten: 'LANH-01', capDong: true }] })
createNhaCungCap(prisma, { daXacMinh: true })
createKhachHang(prisma, { gpkdHetHan?: dateOnly })
nhapHang(app, token, {...})                 // gọi API thật để dựng tồn qua luồng nghiệp vụ
```

Quy tắc:
- Dữ liệu **nền** (hàng, kho, đối tác) dựng trực tiếp bằng Prisma cho nhanh; dữ liệu **nghiệp vụ** (tồn, phiếu) dựng bằng API thật để sổ biến động đúng và chứng minh luồng chạy.
- Mỗi `it` tự dựng dữ liệu cần thiết với mã/tên duy nhất (hậu tố ngẫu nhiên) để không phụ thuộc thứ tự; reset tổng ở `beforeAll`/`beforeEach` của file.
- Reset theo thứ tự phụ thuộc ngược: `NhatKyHeThong, BienDongTonKho` → chứng từ con → chứng từ → `TonKho` → `SoLo` → danh mục → `RefreshToken` → `User` → `Role`; hàm `resetDatabase(prisma)` dùng `deleteMany` (không `TRUNCATE`, tránh khóa FK) và **luôn gọi `assertTestDatabase()` đầu tiên**.
- Mật khẩu user test: `TEST_PASSWORD`, hash cost 4.

## 5. Mẫu một kịch bản

1. Dựng nền: vai trò, người dùng 4 role, hàng (3 đơn vị), kho (1 vị trí thường + 1 cấp đông), NCC đã xác minh, khách đủ điều kiện.
2. Đăng nhập bằng từng role cần dùng.
3. Gọi API theo luồng nghiệp vụ; kiểm `status`, `code`, shape response.
4. Kiểm **DB** khi quan trọng (qua `prisma` trực tiếp): tồn, biến động, trạng thái.
5. Kiểm bất biến cuối: `GET /ton-kho/doi-soat` → `soDongLech = 0`.

## 6. Ma trận phân quyền tự động

Helper `expectRoleMatrix(app, tokens, { method, path, body? }, { allowed: [...] })`: gọi endpoint với token của cả 4 role + không token; assert role trong `allowed` **không** nhận 401/403, role còn lại nhận 403, không token nhận 401. Mỗi module e2e dùng cho từng nhóm hành động trong mục 13 của module doc, nên ma trận role luôn được kiểm bằng máy, không bằng mắt.

Test tổng hợp (M8): duyệt tất cả route trong app (`app.getHttpAdapter().getInstance()._router` / Swagger document), đối chiếu với [endpoints-catalog.md](../06-api/endpoints-catalog.md) và [permissions.md](../03-cross-cutting/permissions.md).

## 7. Kịch bản đồng thời

- Dùng `Promise.all([req1, req2])` cho cùng tài nguyên; assert **tập kết quả** (`[200, 409]` sắp xếp) chứ không phụ thuộc request nào thắng.
- Sau đó assert trạng thái DB cuối (tồn giảm đúng một lần, chỉ một phiếu thu thành công).
- Chạy mỗi kịch bản đồng thời lặp 5 lần trong một `it` (vòng for) để tăng xác suất lộ race, với dữ liệu dựng mới mỗi vòng.
- Pool kết nối của adapter MariaDB phải ≥ 4 trong môi trường test để race có thật.

## 8. Dữ liệu thời gian

- Cần "hôm nay" cố định → override `ClockService` bằng đồng hồ có thể đặt (`setNow()`).
- Cần dữ liệu quá khứ (phiếu xuất cách đây 100 ngày để test tuổi nợ) → dựng bản ghi bằng Prisma với các trường ngày đặt trực tiếp (`ngayXuatKho`), không bằng cách chờ.
- Nhắm các case sát nửa đêm VN (`2026-09-30T16:59:59Z` vs `17:00:00Z`).

## 9. Chẩn đoán lỗi

- Khi `it` fail, in `res.body` (có `requestId`, `code`); helper `expectStatus(res, 201)` ném lỗi kèm body.
- Log ứng dụng tắt trong test; bật bằng `LOG_LEVEL=debug` khi cần.

## 10. Danh sách kịch bản xuyên module (bổ sung vào module e2e)

Tập "smoke theo luồng" chạy trong CI trước khi merge (file `test/flows.e2e-spec.ts`, đề xuất; bám [test-matrix.md](test-matrix.md) §3):

| ID | Luồng |
|---|---|
| F-01 | NCC xác minh → nhập hàng (lô mới, vị trí lạnh) → xác nhận → tồn đúng → thanh toán một phần → hết nợ |
| F-02 | Nhập 2 lô → xuất theo FEFO → thu tiền → báo cáo nhập–xuất–tồn và công nợ khớp |
| F-03 | Hủy phiếu xuất sau xuất kho → tồn hoàn → đối soát không lệch |
| F-04 | Hai phiếu nháp tranh một lô → phiếu hai xuất sau bị chặn → tồn không âm |
| F-05 | Khóa user giữa phiên → access/refresh token đều bị từ chối |
| F-06 | Lô hết hạn: không nhập/xuất được; điều chỉnh về 0 → biến mất khỏi báo cáo hết hạn |
