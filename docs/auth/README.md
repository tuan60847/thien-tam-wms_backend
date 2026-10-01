# Auth module

> Từ M0 mọi route có prefix `/api/v1` (ví dụ `POST /api/v1/auth/login`) và lỗi trả body chuẩn có `code` — xem [../06-api/conventions.md](../06-api/conventions.md) và [../03-cross-cutting/error-handling.md](../03-cross-cutting/error-handling.md).

Đăng nhập bằng `username` + `password`, JWT access token (15 phút) và refresh token (7 ngày) có xoay vòng, phân quyền theo role. Thiết kế chi tiết: [PLAN.md](./PLAN.md).

## Endpoint

| Method | Path | Xác thực | Body | Thành công |
|---|---|---|---|---|
| POST | `/api/v1/auth/login` | Public | `{ username, password }` | 200 `{ accessToken, refreshToken, user }` |
| POST | `/api/v1/auth/refresh` | Public | `{ refreshToken }` | 200 `{ accessToken, refreshToken }` |
| POST | `/api/v1/auth/logout` | Public | `{ refreshToken }` | 204, không body |
| GET | `/api/v1/auth/me` | Bearer access token | — | 200 `AuthenticatedUser` |

Lỗi thường gặp:

| Mã | Message | Khi nào |
|---|---|---|
| 400 | danh sách lỗi validation | thiếu trường, hoặc có trường thừa (`forbidNonWhitelisted`) |
| 401 | `Sai tài khoản hoặc mật khẩu` | sai username hoặc password (hai trường hợp cùng một thông báo) |
| 401 | `Tài khoản đã bị khóa` | `trangThai = false`; áp dụng cả với access token cũ, ngay lập tức |
| 401 | `Phiên đăng nhập không hợp lệ` | thiếu/sai/hết hạn token, refresh token đã thu hồi |
| 403 | `Bạn không có quyền truy cập` | route có `@Roles(...)` mà role không khớp |

`user` trong response login và `/api/v1/auth/me`:

```json
{
  "id": "…",
  "maNV": "NV0001",
  "username": "admin",
  "hoTen": "Quản trị viên",
  "email": null,
  "role": { "maRole": "ADMIN", "tenRole": "Quản trị viên" }
}
```

`role` là `null` nếu user chưa gán role hoặc role đó đang bị vô hiệu hóa (`Role.trangThai = false`).

### Ví dụ curl

```bash
# Đăng nhập
curl -s -X POST localhost:3000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"Admin@123"}'

# Thông tin người dùng hiện tại
curl -s localhost:3000/api/v1/auth/me -H "authorization: Bearer $ACCESS_TOKEN"

# Lấy cặp token mới (refresh token cũ bị thu hồi)
curl -s -X POST localhost:3000/api/v1/auth/refresh \
  -H 'content-type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"

# Đăng xuất (thu hồi refresh token)
curl -i -X POST localhost:3000/api/v1/auth/logout \
  -H 'content-type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"
```

## Biến môi trường

| Tên | Ví dụ | Mô tả |
|---|---|---|
| `DATABASE_URL` | `mysql://root:password@localhost:3306/thienTamWMS` | kết nối MySQL |
| `JWT_ACCESS_SECRET` | chuỗi ≥ 32 ký tự | khóa ký access token |
| `JWT_REFRESH_SECRET` | chuỗi ≥ 32 ký tự, khác khóa access | khóa ký refresh token |
| `JWT_ACCESS_TTL` | `15m` | thời hạn access token |
| `JWT_REFRESH_TTL` | `7d` | thời hạn refresh token |

App từ chối khởi động nếu thiếu biến, secret ngắn hơn 32 ký tự, hoặc hai secret trùng nhau. Biến cũ `JWT_SECRET` / `JWT_EXPIRES_IN` không còn được dùng.

## Thêm route được bảo vệ

Mặc định mọi route đều cần access token (`JwtAuthGuard` global). `RolesGuard` global chạy sau đó và chỉ có tác dụng khi route có `@Roles`.

```ts
import { Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

@Controller('hang-hoa')
export class HangHoaController {
  // Chỉ cần đăng nhập
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) { /* … */ }

  // Cần đăng nhập và role ADMIN hoặc NHAN_VIEN_KHO (so khớp theo maRole)
  @Roles('ADMIN', 'NHAN_VIEN_KHO')
  @Post()
  create() { /* … */ }

  // Không cần đăng nhập
  @Public()
  @Get('health')
  health() { /* … */ }
}
```

`@Roles` và `@Public` đặt được ở cả method lẫn class (method ưu tiên). Không dùng `@Public` cùng `@Roles` trên một route: route không có user nên `RolesGuard` luôn trả 403.

## Vòng đời token

```mermaid
sequenceDiagram
    participant C as Client
    participant A as Auth API
    participant DB as refresh_token

    C->>A: POST /api/v1/auth/login
    A->>DB: lưu SHA-256(refresh token)
    A-->>C: access (15m) + refresh (7d)
    C->>A: GET /… + Bearer access
    Note over A: kiểm chữ ký → tải user từ DB → kiểm trangThai
    C->>A: POST /api/v1/auth/refresh (refresh cũ)
    A->>DB: thu hồi token cũ, lưu token mới (1 transaction)
    A-->>C: access mới + refresh mới
    C->>A: POST /api/v1/auth/refresh (refresh cũ, dùng lại)
    A->>DB: thu hồi toàn bộ token của user
    A-->>C: 401
    C->>A: POST /api/v1/auth/logout (refresh)
    A->>DB: revokedAt = now
    A-->>C: 204
```

- Access token mang `{ sub, maNV, roleMa, roleTen }` nhưng quyền thực tế luôn lấy từ DB ở mỗi request, nên khóa user hoặc đổi role có hiệu lực ngay.
- Refresh token chỉ được lưu dưới dạng hash. Mỗi refresh token dùng được một lần.
- Dùng lại refresh token đã xoay vòng được coi là dấu hiệu bị lộ: mọi refresh token còn hiệu lực của user bị thu hồi.

## Chạy lần đầu

Cần MySQL đang chạy và hai database `thienTamWMS`, `thienTamWMS_test`. Repo dùng yarn (`yarn.lock`); có thể thay bằng `npm run` / `npx`.

```bash
cp .env.example .env            # chỉnh DATABASE_URL và hai JWT secret
yarn install
npx prisma migrate dev
npx prisma db seed
yarn start:dev
```

Seed tạo hai role `ADMIN`, `NHAN_VIEN_KHO` và tài khoản mặc định `admin` / `Admin@123` (`NV0001`). Seed chạy lại được an toàn và không ghi đè mật khẩu đã đổi. **Mật khẩu mặc định chỉ dành cho dev, đổi trước khi đưa lên môi trường thật.**

## Chạy test

```bash
yarn test       # unit, không cần DB
```

E2E dùng MySQL thật:

```bash
cp .env.test.example .env.test   # DATABASE_URL phải trỏ tới DB tên kết thúc bằng _test
yarn test:e2e
```

E2E tự chạy `prisma migrate deploy`, xóa sạch rồi seed lại DB test mỗi lần chạy. Helper từ chối chạy nếu tên DB không kết thúc bằng `_test`.

## Giới hạn đã biết

- Mỗi request có xác thực tốn thêm một truy vấn DB để kiểm tra user và role.
- Token trả trong body, chưa dùng cookie httpOnly.
- Chưa dọn định kỳ các refresh token hết hạn trong bảng `refresh_token`.
- Chưa giới hạn số lần đăng nhập sai.
- Chưa có API quản lý user/role; user mới hiện chỉ tạo qua seed hoặc trực tiếp trong DB.

Ngoài phạm vi: reset/đổi mật khẩu, xác minh email, 2FA, OAuth/SSO, rate limiting, khóa tài khoản sau nhiều lần sai, CRUD user/role, audit log đăng nhập, quản lý nhiều thiết bị.
