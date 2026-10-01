# Auth module — Plan

## 1. Scope

**In**
- Đăng nhập bằng `username` + `password`, cấp access token (15 phút) và refresh token (7 ngày).
- Refresh có xoay vòng (rotation), logout thu hồi refresh token.
- `GET /auth/me`.
- `JwtAuthGuard` và `RolesGuard` đăng ký global; `@Public()`, `@Roles()`, `@CurrentUser()`.
- `PrismaModule`, `UsersModule` (chỉ `findByUsername`, `findById`), `ConfigModule` với `AuthConfig` có kiểu.
- Seed lại role `ADMIN`, `NHAN_VIEN_KHO` và user admin.
- Unit test và e2e test, tài liệu.

**Out** — xem mục 10.

## 2. File tree

```
docs/auth/PLAN.md
docs/auth/README.md
prisma/schema.prisma                      (sửa: thêm RefreshToken)
prisma/seed.ts                            (viết lại)
prisma/migrations/<ts>_add_auth/          (sinh bởi migrate dev)
.env.example                              (sửa)
.env.test.example                         (mới)
src/main.ts                               (sửa: global ValidationPipe)
src/app.module.ts                         (sửa: import Config/Prisma/Users/Auth)
src/config/auth.config.ts
src/prisma/prisma.module.ts
src/prisma/prisma.service.ts
src/users/users.module.ts
src/users/users.service.ts
src/users/users.service.spec.ts
src/auth/auth.module.ts
src/auth/auth.controller.ts
src/auth/auth.service.ts
src/auth/auth.service.spec.ts
src/auth/strategies/jwt.strategy.ts
src/auth/guards/jwt-auth.guard.ts
src/auth/guards/jwt-auth.guard.spec.ts
src/auth/guards/roles.guard.ts
src/auth/guards/roles.guard.spec.ts
src/auth/decorators/public.decorator.ts
src/auth/decorators/roles.decorator.ts
src/auth/decorators/current-user.decorator.ts
src/auth/dto/login.dto.ts
src/auth/dto/refresh-token.dto.ts
src/auth/types/authenticated-user.type.ts
src/auth/types/jwt-payload.type.ts
test/auth.e2e-spec.ts
test/fixtures/protected-route.controller.ts
test/helpers/test-db.ts
```

## 3. Prisma schema changes

```prisma
model RefreshToken {
  id        String    @id @default(uuid())
  tokenHash String    @unique @map("token_hash")
  expiresAt DateTime  @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  createdAt DateTime  @default(now()) @map("created_at")

  userId String @map("user_id")
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("refresh_token")
}
```

và thêm `refreshTokens RefreshToken[]` vào `User`.

Lý do:
- `tokenHash` lưu SHA-256 của refresh token. Token là JWT ngẫu nhiên entropy cao, bcrypt không cần thiết và không tra cứu được theo hash. `@unique` cho phép tra cứu trực tiếp.
- `revokedAt` thay vì xóa dòng, để giữ vết và phát hiện dùng lại token cũ.
- `@@index([userId])` để thu hồi toàn bộ token của user.
- `onDelete: Cascade` theo yêu cầu.

Rotation: mỗi lần refresh, thu hồi token cũ và tạo token mới trong một transaction. Nếu token đã `revokedAt` mà bị dùng lại, coi là bị lộ và thu hồi toàn bộ token còn hiệu lực của user đó.

## 4. Biến môi trường

| Tên | Ví dụ | Ghi chú |
|---|---|---|
| `JWT_ACCESS_SECRET` | chuỗi ≥ 32 ký tự | thay `JWT_SECRET` cũ |
| `JWT_REFRESH_SECRET` | chuỗi ≥ 32 ký tự, khác access | |
| `JWT_ACCESS_TTL` | `15m` | |
| `JWT_REFRESH_TTL` | `7d` | |

`.env.example` hiện có `JWT_SECRET` và `JWT_EXPIRES_IN`; sẽ thay bằng 4 biến trên. `.env.test.example` có `DATABASE_URL` trỏ tới DB riêng cho e2e (`thienTamWMS_test`).
`AuthConfig` validate khi khởi động: thiếu secret thì app không chạy.

## 5. Dependencies

```
npm i @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt \
      class-validator class-transformer bcrypt @prisma/client
npm i -D prisma @types/bcrypt @types/passport-jwt vitest-mock-extended dotenv
```

Cần lưu ý:
- Prisma client sinh code `prisma-client-js`; cần `prisma generate` sau khi cài.
- Vitest dùng esbuild/oxc nên **không emit decorator metadata**. Cần plugin (ví dụ `unplugin-swc`) trong cả hai file vitest config, nếu không DI theo kiểu constructor sẽ lỗi. Đây là một devDependency thêm: `unplugin-swc @swc/core`. Sẽ kiểm tra ở Step 2 xem config hiện có đã xử lý chưa.
- `bcrypt` cần build native; nếu lỗi trên máy này sẽ báo lại thay vì tự đổi sang `bcryptjs`.

## 6. Endpoint contract

| Method | Path | Auth | Body | 200/201 response | Lỗi |
|---|---|---|---|---|---|
| POST | `/auth/login` | Public | `{ username, password }` | `{ accessToken, refreshToken, user: { id, maNV, username, hoTen, email, role } }` | 400 DTO sai; 401 `Sai tài khoản hoặc mật khẩu`; 401 `Tài khoản đã bị khóa` |
| POST | `/auth/refresh` | Public | `{ refreshToken }` | `{ accessToken, refreshToken }` | 400; 401 token sai/hết hạn/đã thu hồi |
| POST | `/auth/logout` | Public | `{ refreshToken }` | `204` không body | 400 |
| GET | `/auth/me` | Access token | — | `AuthenticatedUser` | 401; 401 `Tài khoản đã bị khóa` |

Ghi chú:
- `role` trong response là `{ maRole, tenRole } | null`.
- `/auth/login` và `/auth/refresh` trả 200 (đặt `@HttpCode(200)`), logout trả 204.
- Logout nhận refresh token trong body và để `@Public()`: access token có thể đã hết hạn lúc người dùng muốn đăng xuất. Logout idempotent: token không tồn tại hoặc đã thu hồi vẫn trả 204.
- Sai username và sai password trả cùng một thông báo (không lộ username tồn tại). Khi username không tồn tại vẫn chạy một lần `bcrypt.compare` với hash giả để thời gian phản hồi gần nhau.
- Trình tự login: kiểm tra mật khẩu trước, sau đó mới kiểm tra `trangThai`. Chỉ người biết đúng mật khẩu mới thấy `Tài khoản đã bị khóa`.
- User có `roleId = null` vẫn đăng nhập được, nhưng `role = null` nên mọi route có `@Roles` sẽ trả 403. Role có `trangThai = false` cũng được coi như không có role (`role = null`).

## 7. Quy tắc guard

- Thứ tự `APP_GUARD` trong `AuthModule`: `JwtAuthGuard` rồi `RolesGuard`.
- `JwtAuthGuard` (extends `AuthGuard('jwt')`): nếu route/controller có `@Public()` thì cho qua, ngược lại bắt buộc access token hợp lệ.
- `JwtStrategy.validate(payload)` chỉ kiểm tra chữ ký và hạn, rồi gọi `AuthService.validateUser(payload.sub)`. Hàm này tải user kèm role từ DB, từ chối nếu không tồn tại hoặc `trangThai = false`, và trả `AuthenticatedUser`. Nhờ vậy user bị khóa mất quyền ngay, không đợi token hết hạn. Đổi lại mỗi request có một truy vấn DB.
- `RolesGuard`: không có `@Roles(...)` thì cho qua (kể cả route `@Public`). Có `@Roles` thì cần `request.user` và `user.role.maRole` nằm trong danh sách, không thì `ForbiddenException('Bạn không có quyền truy cập')`. Thiếu `request.user` cũng là 403 như yêu cầu của prompt.
- `@Roles` kết hợp `@Public` trên cùng route: `@Public` thắng ở `JwtAuthGuard`, rồi `RolesGuard` thấy không có user nên trả 403. Sẽ ghi vào README là không nên dùng cùng nhau.
- Metadata đọc bằng `Reflector.getAllAndOverride([handler, class])`.
- JWT payload: `{ sub, maNV, roleMa, roleTen }`. Payload chỉ để định danh; quyền thực tế lấy từ DB trong `validateUser`, nên đổi role có hiệu lực ngay.
- Access token và refresh token ký bằng hai secret khác nhau. Refresh token có thêm `jti` (uuid) để hai token cấp trong cùng một giây không trùng hash.

## 8. Test matrix

### `src/auth/auth.service.spec.ts` (Prisma mock bằng `vitest-mock-extended`)
1. login: đúng thông tin → trả access + refresh + user, lưu hash refresh token.
2. login: sai mật khẩu → 401 `Sai tài khoản hoặc mật khẩu`.
3. login: username không tồn tại → 401 cùng thông báo.
4. login: user `trangThai=false` (mật khẩu đúng) → 401 `Tài khoản đã bị khóa`.
5. refresh: token hợp lệ → access mới + refresh mới, token cũ bị thu hồi.
6. refresh: token đã thu hồi → 401 và thu hồi toàn bộ token của user.
7. refresh: token hết hạn (JWT hết hạn) → 401.
8. refresh: token hết hạn theo `expiresAt` trong DB → 401.
9. refresh: chữ ký sai / không có trong DB → 401.
10. refresh: user đã bị khóa → 401.
11. logout: thu hồi token (`revokedAt` được set).
12. logout: token không tồn tại → không lỗi (idempotent).
13. validateUser: user hợp lệ → `AuthenticatedUser`; không tồn tại hoặc bị khóa → 401.

### `src/auth/guards/roles.guard.spec.ts`
1. role khớp → cho qua.
2. role không khớp → 403.
3. không có metadata `@Roles` → cho qua.
4. có `@Roles` nhưng thiếu `request.user` → 403.
5. user không có role (`role=null`) → 403.

### `src/auth/guards/jwt-auth.guard.spec.ts`
1. `@Public()` trên handler → bypass.
2. `@Public()` trên class → bypass.
3. không public → gọi vào `AuthGuard('jwt')`.

### `src/users/users.service.spec.ts`
1. `findByUsername` và `findById` có include role; trả null khi không có.

### `test/auth.e2e-spec.ts` (MySQL thật, `.env.test`, `prisma migrate deploy` trong `beforeAll`, seed 1 admin + 1 user bị khóa + 1 user thường)
1. login thành công trả đủ token và shape user.
2. sai mật khẩu → 401, message tiếng Việt.
3. user bị khóa → 401.
4. body thiếu hoặc thừa trường → 400 (kiểm tra `whitelist`/`forbidNonWhitelisted`).
5. `GET /auth/me` không token → 401.
6. `GET /auth/me` có token → 200, đúng shape, không lộ `password`.
7. route fixture `@Roles('ADMIN')`: admin 200, user thường 403.
8. refresh cấp access mới và xoay refresh; refresh cũ bị từ chối khi dùng lại.
9. logout xong, refresh token cũ bị từ chối.
10. user bị khóa sau khi đã có access token → `/auth/me` trả 401.

`test/fixtures/protected-route.controller.ts` chỉ được import trong e2e; module test của e2e thêm controller này vào.

## 9. Commit sequence (sau khi plan được duyệt)

1. `docs(auth): add auth module plan` (file này)
2. `chore(auth): add deps, env, refresh-token schema`
3. `chore(seed): sync seed with current schema`
4. `feat(prisma): add PrismaService`
5. `feat(users): add users service`
6. `feat(auth): login + jwt strategy`
7. `feat(auth): refresh + logout`
8. `feat(auth): roles guard + decorators`
9. `test(auth): unit + e2e coverage`
10. `docs(auth): module README and endpoint reference`

## 10. Out of scope

Reset mật khẩu, quên mật khẩu, đổi mật khẩu, xác minh email, 2FA, OAuth/SSO, rate limiting và khóa tài khoản sau nhiều lần sai, CRUD user/role, audit log đăng nhập, cookie httpOnly (token trả trong body), dọn dẹp định kỳ refresh token hết hạn, quản lý nhiều thiết bị/phiên.

## 11. Điểm lệch so với prompt / cần bạn xác nhận

1. **Tên file config e2e:** repo đang là `vitest.config.e2e.ts`, prompt ghi `vitest.e2e.config.ts`. Tôi giữ tên hiện có và sửa script cho khớp, không đổi tên file. Nếu bạn muốn đổi tên theo prompt thì nói.
2. **Script `test:e2e`:** đã có sẵn trong `package.json`, chỉ chỉnh nếu cần.
3. **`JWT_SECRET` → `JWT_ACCESS_SECRET`:** đổi tên biến trong `.env.example` (breaking với `.env` cục bộ cũ).
4. **Entropy refresh token:** dùng SHA-256 thay bcrypt cho `tokenHash` (lý do ở mục 3).
5. **Truy vấn DB mỗi request** trong `validateUser` để khóa tài khoản có hiệu lực tức thì (mục 7).
6. **Plugin decorator metadata cho Vitest** (`unplugin-swc`) có thể cần thêm (mục 5).
7. **Database:** cần một MySQL đang chạy cho `migrate dev` và e2e. Cần DB `thienTamWMS` và `thienTamWMS_test` với user có quyền tạo shadow database.
8. **Dữ liệu seed:** mật khẩu admin mặc định `Admin@123` là mật khẩu yếu, chỉ dùng cho dev; README sẽ ghi cần đổi trước khi lên production.
9. **Ngoài phạm vi thư mục cho phép:** chưa thấy file nào phải sửa ngoài danh sách bạn cho phép.
