# Triển khai

> **Phạm vi và độ tin cậy.** Yêu cầu nêu: PM2 trên hosting dùng chung `m3xs.net`, Jenkins CI/CD, M3Admin, "điều chỉnh theo quy trình chuẩn của bạn". Tôi **không có** tài liệu quy trình chuẩn đó trong repo. Vì vậy phần dưới là **khung kỹ thuật chung cho NestJS + PM2 + Jenkins**, mọi chỗ phụ thuộc hạ tầng cụ thể được đánh dấu **[GIẢ ĐỊNH]** và liệt kê ở §9 để bạn xác nhận/bổ sung. Không cấu hình nào ở đây là đã kiểm chứng trên `m3xs.net`.

## 1. Môi trường

| Môi trường | Mục đích | Dữ liệu | Ghi chú |
|---|---|---|---|
| local | dev | demo | [local-dev.md](local-dev.md) |
| CI (Jenkins) | build + test | DB `*_test` tạm | MySQL 8 service |
| staging **[GIẢ ĐỊNH: có]** | thử trước khi lên production | demo | câu hỏi mở: có staging không |
| production | chạy thật | thật | chỉ seed nền |

## 2. Kiến trúc chạy

```
Internet ──► (reverse proxy / web server của hosting, HTTPS) ──► Node (PM2, fork, 1 instance) ──► MySQL
                                                                      │
                                                                      └─► Cloudinary (M7)
```

- **[GIẢ ĐỊNH]** Hosting cho chạy tiến trình Node dài hạn qua PM2 và có reverse proxy tới một cổng nội bộ; MySQL do hosting cung cấp.
- Một instance, chế độ `fork` (job nền không cần phối hợp; xem [background-jobs.md](../03-cross-cutting/background-jobs.md) §5).
- HTTPS kết thúc tại reverse proxy; app đặt `TRUST_PROXY` để lấy IP thật.

## 3. Bản dựng (artifact)

Quy trình trong Jenkins (pipeline khai báo, các stage dừng ở lỗi đầu tiên):

1. **Checkout** nhánh/tag.
2. **Cài phụ thuộc:** `yarn install --frozen-lockfile` **chỉ khả thi nếu `yarn.lock` được theo dõi lại** (hiện đã gỡ). Nếu giữ nguyên không theo dõi lockfile: dùng `yarn install` (không đóng băng) — bản dựng có thể khác nhau giữa các lần. **Khuyến nghị theo dõi lại `yarn.lock`** (quyết định ở §9).
3. **Chất lượng:** `npx prisma validate`, `yarn lint`, `npx tsc --noEmit`.
4. **Test:** `yarn test`; khởi MySQL tạm, tạo DB `*_test`, `yarn test:e2e`.
5. **Build:** `npx prisma generate` rồi `yarn build` (ra `dist/`).
6. **Đóng gói:** tarball gồm `dist/`, `prisma/` (schema + migrations + seed), `prisma.config.ts`, `package.json`, `yarn.lock` (nếu có), `ecosystem.config.cjs`; **không** gồm `.env`, `node_modules`, test.
7. **Lưu artifact** gắn mã commit.

Phiên bản Node trên Jenkins phải trùng phiên bản chạy thật **[GIẢ ĐỊNH: hosting hỗ trợ Node 24]** — câu hỏi mở.

## 4. PM2

`ecosystem.config.cjs` (đề xuất):

```js
module.exports = {
  apps: [{
    name: 'thien-tam-wms-api',
    script: 'dist/main.js',
    exec_mode: 'fork',
    instances: 1,
    env: { NODE_ENV: 'production' },
    max_memory_restart: '512M',
    kill_timeout: 10000,        // cho phép đóng kết nối DB và hoàn tất request đang chạy
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    merge_logs: true,
  }],
};
```

- App bật `app.enableShutdownHooks()` để `PrismaService.onModuleDestroy` chạy khi PM2 gửi `SIGINT`.
- Dự án dùng ESM (`"type": "module"`): `ecosystem.config.cjs` phải là `.cjs`; `script` trỏ `dist/main.js` (tên có đuôi).
- Biến môi trường nạp từ file `.env` đặt cạnh `dist` **[GIẢ ĐỊNH]** hoặc từ giao diện quản trị hosting (**M3Admin** — chưa rõ khả năng, §9). Không đặt bí mật trong `ecosystem.config.cjs`.
- Khởi động lại sau reboot: `pm2 startup` + `pm2 save` **[GIẢ ĐỊNH: hosting cho phép]**.

## 5. Các bước deploy (production)

Chạy bởi Jenkins stage `Deploy` (sau phê duyệt thủ công):

1. **Thông báo/cửa sổ bảo trì** nếu migration có khóa bảng ([migrations-policy.md](../01-data/migrations-policy.md) §4).
2. **Backup DB:** `mysqldump --single-transaction` ra file có mã commit + giờ; kiểm tra file không rỗng.
3. **Chuyển artifact** lên máy chạy (**[GIẢ ĐỊNH: SSH/rsync hoặc cơ chế M3Admin]**), giải nén vào thư mục phát hành mới `releases/<commit>`.
4. **Cài phụ thuộc production:** `yarn install --production` trong thư mục phát hành (hoặc copy `node_modules` đã build nếu cùng hệ điều hành/kiến trúc — `bcrypt` là native, cần build đúng nền tảng).
5. **Áp migration:** `npx prisma migrate deploy` (dùng `DATABASE_URL` production). Dừng toàn bộ nếu lỗi.
6. **Seed nền (lần đầu hoặc khi đổi seed):** `npx prisma db seed` với `SEED_ADMIN_PASSWORD`.
7. **Chuyển liên kết** `current -> releases/<commit>` (symlink).
8. **Reload:** `pm2 reload ecosystem.config.cjs --update-env` (một instance `fork` sẽ có khoảng gián đoạn ngắn).
9. **Health check:** `GET /api/v1/health` trả `200` trong 60 giây; nếu không → rollback (§6).
10. **Smoke test:** đăng nhập tài khoản kiểm thử, `GET /auth/me`, một truy vấn danh sách.
11. Ghi nhận phiên bản đã triển khai (commit, thời điểm, người duyệt).

## 6. Rollback

- **Code:** đổi symlink `current` về bản phát hành trước + `pm2 reload`. Giữ tối thiểu 3 bản phát hành gần nhất.
- **Schema:** migration Prisma không có "down". Ưu tiên migration **tương thích ngược** để rollback code vẫn chạy trên schema mới. Nếu migration gây hỏng dữ liệu: khôi phục từ dump bước 2 (mất dữ liệu phát sinh sau backup — cân nhắc chấp nhận hay forward-fix).
- Quy tắc: không deploy migration phá hủy (drop cột) cùng lúc với code ngừng dùng cột đó — tách hai lần phát hành.

## 7. Cấu hình bí mật

- Lưu ở kho bí mật Jenkins (credentials) và/hoặc cấu hình hosting **[GIẢ ĐỊNH]**; không nằm trong repo/artifact.
- Danh sách biến: [env-vars.md](env-vars.md). Mỗi môi trường secret JWT khác nhau.
- Xoay vòng secret: đổi `JWT_*_SECRET` ⇒ mọi người dùng phải đăng nhập lại (chấp nhận được; thông báo trước).

## 8. Backup và khôi phục

| Hạng mục | Đề xuất |
|---|---|
| DB | dump hằng ngày + trước mỗi lần migrate; giữ 14 ngày hằng ngày, 12 tháng hằng tháng |
| Lưu ở đâu | tối thiểu một nơi **ngoài** máy chạy ứng dụng **[GIẢ ĐỊNH: hosting cung cấp backup — cần xác nhận]** |
| Kiểm khôi phục | mỗi quý restore thử vào DB trống và chạy `GET /ton-kho/doi-soat` |
| File Cloudinary | do nhà cung cấp lưu; sao lưu metadata trong DB |

Dữ liệu tồn kho và chứng từ là dữ liệu tuân thủ ngành dược — **thời gian lưu trữ bắt buộc** (thường nhiều năm) cần xác nhận với bên pháp lý (câu hỏi mở).

## 9. Việc cần bạn xác nhận (hạ tầng)

1. Hosting `m3xs.net`: phiên bản Node có sẵn? Có quyền cài `bcrypt` (native build) và chạy `pm2`? Có Redis không (liên quan job nền)?
2. **M3Admin** làm gì chính xác: quản lý biến môi trường, deploy, vhost/cổng, DB, hay cả bốn?
3. Jenkins: chạy ở đâu, deploy bằng cách nào (SSH/rsync/API M3Admin), có agent MySQL cho e2e không?
4. Có môi trường **staging** không, hay chỉ production?
5. Theo dõi lại `yarn.lock` hay không (ảnh hưởng tính tái lập của bản dựng)?
6. Chính sách backup/lưu giữ dữ liệu của hosting và yêu cầu lưu giữ dữ liệu dược.
7. Tên miền, chứng chỉ HTTPS, và origin của frontend (cho `CORS_ORIGINS`).

## 10. Checklist trước khi lên production lần đầu

- [ ] M0–M6 xong, test xanh, đối soát không lệch.
- [ ] Squash migration thành `init` một lần ([migrations-policy.md](../01-data/migrations-policy.md) §3).
- [ ] `SEED_ADMIN_PASSWORD` đặt; đổi mật khẩu admin sau lần đăng nhập đầu.
- [ ] Swagger tắt hoặc có basic-auth.
- [ ] `CORS_ORIGINS` đúng; HTTPS bật; `TRUST_PROXY` đúng.
- [ ] Rate limit đăng nhập bật.
- [ ] Backup tự động chạy và đã thử restore một lần.
- [ ] Import dữ liệu ban đầu (danh mục, đối tác, tồn đầu kỳ) đã kiểm bởi người nghiệp vụ.
- [ ] Runbook sự cố và người trực.
