# Biến môi trường

Nguồn: `.env.example` hiện có + các biến đề xuất theo tài liệu này. Cấu hình đọc qua `@nestjs/config`, có kiểu và **kiểm tra khi khởi động** (thiếu biến bắt buộc ⇒ app không chạy, thông báo nêu tên biến). `.env`, `.env.test` không commit; chỉ commit `*.example`.

Cột **Trạng thái**: `có` = đã dùng trong code; `đề xuất` = sẽ thêm ở milestone ghi trong ngoặc.

## 1. Lõi

| Tên | Ví dụ | Bắt buộc | Mô tả | Trạng thái |
|---|---|---|---|---|
| `NODE_ENV` | `development` / `test` / `production` | không (mặc định `development`) | Chế độ chạy; quyết định pretty log, seed demo, Swagger mặc định | đề xuất (M0) |
| `PORT` | `3000` | không (mặc định 3000) | Cổng HTTP | có |
| `DATABASE_URL` | `mysql://user:pass@localhost:3306/thienTamWMS` | **có** | Kết nối MySQL (qua `@prisma/adapter-mariadb`); e2e dùng DB tên kết thúc `_test` | có |
| `CORS_ORIGINS` | `https://wms.example.vn,http://localhost:5173` | không (mặc định: tắt CORS) | Danh sách origin được phép, phân tách phẩy; không dùng `*` ở production | đề xuất (M0) |
| `TRUST_PROXY` | `1` | không | Số tầng proxy tin cậy (để lấy IP thật khi chạy sau reverse proxy) | đề xuất (M0) |

## 2. Xác thực

| Tên | Ví dụ | Bắt buộc | Mô tả | Trạng thái |
|---|---|---|---|---|
| `JWT_ACCESS_SECRET` | chuỗi ngẫu nhiên ≥ 32 ký tự | **có** | Khóa ký access token | có |
| `JWT_REFRESH_SECRET` | chuỗi ngẫu nhiên ≥ 32 ký tự, **khác** khóa access | **có** | Khóa ký refresh token | có |
| `JWT_ACCESS_TTL` | `15m` | **có** | Thời hạn access token | có |
| `JWT_REFRESH_TTL` | `7d` | **có** | Thời hạn refresh token | có |
| `LOGIN_RATE_LIMIT` | `5` | không (mặc định 5) | Số lần `POST /auth/login` tối đa mỗi phút mỗi IP | đề xuất (M1) |

Sinh secret: `openssl rand -base64 48`. Đổi secret ⇒ mọi token hiện có mất hiệu lực.

## 3. Nghiệp vụ

| Tên | Ví dụ | Bắt buộc | Mô tả | Trạng thái |
|---|---|---|---|---|
| `EXPIRY_WARNING_DAYS` | `90` | không (mặc định 90) | Ngưỡng số ngày trước hạn tính là "cận date" | đề xuất (M4) |
| `MIN_SHELF_LIFE_DAYS_RECEIVE` | `0` | không (mặc định 0 = tắt) | Hạn dùng tối thiểu còn lại khi nhập kho | đề xuất (M4) |
| `MIN_SHELF_LIFE_DAYS_ISSUE` | `0` | không (mặc định 0 = tắt) | Hạn dùng tối thiểu còn lại khi xuất kho | đề xuất (M4) |
| `SEED_ADMIN_PASSWORD` | `…` | **có khi `NODE_ENV=production` lúc seed** | Mật khẩu admin cho seed nền; thiếu ở production ⇒ seed dừng | đề xuất (M0) |

## 4. Hạ tầng phụ

| Tên | Ví dụ | Bắt buộc | Mô tả | Trạng thái |
|---|---|---|---|---|
| `LOG_LEVEL` | `info` | không (mặc định `info`; `debug` ở dev) | Mức log pino | đề xuất (M0) |
| `JOBS_ENABLED` | `true` | không (mặc định `true`; `false` trong test) | Bật/tắt job nền | đề xuất (M4) |
| `JOBS_TIMEZONE` | `Asia/Ho_Chi_Minh` | không | Múi giờ lịch cron | đề xuất (M4) |
| `SWAGGER_ENABLED` | `true` | không (mặc định: bật ở dev/staging, tắt ở production) | Bật Swagger UI | đề xuất (M0) |
| `SWAGGER_USER` / `SWAGGER_PASSWORD` | `…` | chỉ khi bật Swagger ở production | Basic-auth cho Swagger | đề xuất (M0) |
| `CLOUDINARY_CLOUD_NAME` | `my-cloud` | chỉ khi dùng upload (M7) | Tên cloud | có trong `.env.example` (chưa dùng) |
| `CLOUDINARY_API_KEY` | `…` | như trên | API key | có trong `.env.example` (chưa dùng) |
| `CLOUDINARY_API_SECRET` | `…` | như trên | API secret (bí mật) | có trong `.env.example` (chưa dùng) |

## 5. Biến chỉ dành cho test

`.env.test` (xem `.env.test.example`): `DATABASE_URL` (DB `*_test`), bốn biến JWT, thêm `JOBS_ENABLED=false`, `LOG_LEVEL=silent`, `NODE_ENV=test`.

## 6. Thay đổi so với `.env.example` hiện tại

| Biến cũ | Trạng thái |
|---|---|
| `JWT_SECRET`, `JWT_EXPIRES_IN` | **đã bỏ** (thay bằng bốn biến `JWT_*` ở §2) |
| `PORT`, `DATABASE_URL`, `CLOUDINARY_*` | giữ nguyên |

`@nestjs/observe` hiện nhận `appKey`/`appSecret` **viết cứng placeholder** trong `app.module.ts`. Cần quyết định: bỏ module này, hoặc đưa thành `OBSERVE_APP_KEY`, `OBSERVE_APP_SECRET`, `OBSERVE_SERVICE_ID` (xem [observability.md](observability.md) và [open-questions.md](../open-questions.md)).

## 7. Quy tắc quản lý

1. Không commit giá trị thật; `*.example` chỉ chứa giá trị giả hoặc hướng dẫn.
2. Bí mật (`*_SECRET`, `*_PASSWORD`, `DATABASE_URL` có mật khẩu) lưu trong kho bí mật của CI/hosting, không in ra log.
3. Mỗi môi trường (dev, test, staging, production) dùng **secret JWT khác nhau**.
4. Thêm biến mới ⇒ cập nhật đồng thời: file này, `.env.example`, schema kiểm tra cấu hình, và `deployment.md` nếu cần cấu hình ở hosting.
