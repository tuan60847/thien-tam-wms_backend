# Module: auth

> **Đã triển khai** (commit `c87242c` … `ef5d770`). File này tóm tắt hiện trạng và liệt kê phần cần chỉnh khi áp dụng quy ước chung (M0). Thiết kế gốc: [../auth/PLAN.md](../auth/PLAN.md); hướng dẫn sử dụng: [../auth/README.md](../auth/README.md). Không viết lại hai file đó.

## 1. Mục đích
- Đăng nhập bằng `username` + `password`, cấp access token (15 phút) và refresh token (7 ngày, xoay vòng, lưu hash), đăng xuất, cung cấp guard xác thực/phân quyền toàn cục.
- Actors: mọi người dùng (login/refresh/logout công khai; `/auth/me` cho mọi role đã đăng nhập). Không role cụ thể.

## 2. Scope
### In scope
- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`.
- `JwtAuthGuard` + `RolesGuard` global; `@Public()`, `@Roles()`, `@CurrentUser()`.
- Phát hiện dùng lại refresh token (thu hồi toàn bộ phiên của user).
- Kiểm tra user/role từ DB ở mỗi request (khóa tài khoản có hiệu lực ngay).
### Out of scope (phase 2)
- Quên / đặt lại mật khẩu bằng email, xác minh email, 2FA, OAuth/SSO.
- Đổi mật khẩu, reset mật khẩu do admin → thuộc [users.md](users.md).
- Khóa tài khoản sau nhiều lần sai; rate limit (đề xuất `@nestjs/throttler` ở M1).
- Cookie httpOnly, quản lý nhiều thiết bị/phiên.

## 3. Dependencies
- Module khác: `users` (tra user), `prisma`.
- Thư viện: đã có (`@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt`, `class-validator`). Thêm ở M1: `@nestjs/throttler`.
- Chỉnh kiến trúc ở M1: tách `RefreshTokenService` vào `RefreshTokenModule` để `users` gọi thu hồi token mà không tạo phụ thuộc vòng với `auth`.

## 4. Data model
- Model: `RefreshToken`, đọc `User` + `Role` (qua `UsersService`).
- Quy tắc trường: `tokenHash` = SHA-256 của refresh token, unique; `expiresAt` = `exp` của JWT; `revokedAt` đánh dấu thu hồi (không xóa dòng).
- Đề xuất bổ sung: `@@index([expiresAt])` (P-19) cho job dọn token hết hạn. Không đổi gì khác.

## 5. API endpoints
| Method | Path | Auth | Roles | Mô tả ngắn | DTO request | DTO response |
|---|---|---|---|---|---|---|
| POST | `/api/v1/auth/login` | Public | — | Đăng nhập | `LoginDto` | `LoginResult` |
| POST | `/api/v1/auth/refresh` | Public | — | Cấp cặp token mới, thu hồi token cũ | `RefreshTokenDto` | `IssuedTokens` |
| POST | `/api/v1/auth/logout` | Public | — | Thu hồi refresh token (204) | `RefreshTokenDto` | — |
| GET | `/api/v1/auth/me` | JWT | mọi role | Hồ sơ người dùng hiện tại | — | `AuthenticatedUser` |

(Hiện path không có prefix `/api/v1`; M0 thêm prefix.)

## 6. DTOs
- `LoginDto { username: string; password: string }` — `@IsString @IsNotEmpty` cả hai.
- `RefreshTokenDto { refreshToken: string }` — `@IsString @IsNotEmpty`.
- Response: `LoginResult { accessToken; refreshToken; user: AuthenticatedUser }`, `IssuedTokens { accessToken; refreshToken }`, `AuthenticatedUser { id; maNV; username; hoTen; email: string | null; role: { maRole; tenRole } | null }`. Không có `password`.
- Query DTO: N/A — không có endpoint danh sách.
- Đề xuất ở M0: thêm `@ApiProperty` (Swagger) và `@Transform` trim `username`, chuyển thường.

## 7. Business rules
- BR-01: Sai username và sai mật khẩu trả **cùng** thông báo; khi username không tồn tại vẫn chạy một lần `bcrypt.compare` với hash giả để thời gian phản hồi gần nhau.
- BR-02: Kiểm tra mật khẩu **trước**, kiểm tra `trangThai` sau — chỉ người biết đúng mật khẩu mới thấy "Tài khoản đã bị khóa".
- BR-03: Access token chỉ mang `{ sub, maNV, roleMa, roleTen }`; quyền thực tế luôn lấy từ DB ở mỗi request (`validateUser`).
- BR-04: Role `trangThai = false` được coi như user không có role (`role: null`).
- BR-05: Refresh token dùng một lần: refresh thành công thu hồi token cũ và phát token mới trong một transaction; điều kiện `revokedAt IS NULL` chặn hai refresh song song cùng thành công.
- BR-06: Dùng lại refresh token đã thu hồi ⇒ thu hồi **mọi** refresh token còn hiệu lực của user đó và trả 401.
- BR-07: Logout idempotent: token không tồn tại hoặc đã thu hồi vẫn trả 204.
- BR-08: Access và refresh token ký bằng hai secret khác nhau (≥ 32 ký tự); app không khởi động nếu thiếu hoặc trùng.
- BR-09 (thêm ở M1): đổi/reset mật khẩu hoặc khóa user ⇒ thu hồi mọi refresh token của user.

## 8. Error cases
| Mã lỗi | HTTP | Khi nào | Message (VN) |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | thiếu/thừa trường | Dữ liệu gửi lên không hợp lệ |
| `AUTH_INVALID_CREDENTIALS` | 401 | sai username hoặc mật khẩu | Sai tài khoản hoặc mật khẩu |
| `AUTH_ACCOUNT_LOCKED` | 401 | `trangThai = false` (login, refresh, hoặc mọi request có token) | Tài khoản đã bị khóa |
| `AUTH_SESSION_INVALID` | 401 | token sai/hết hạn/đã thu hồi/không có trong DB | Phiên đăng nhập không hợp lệ |
| `AUTH_UNAUTHORIZED` | 401 | thiếu access token | Vui lòng đăng nhập để tiếp tục |
| `AUTH_FORBIDDEN` | 403 | role không thỏa `@Roles` | Bạn không có quyền truy cập |
| `COMMON_TOO_MANY_REQUESTS` | 429 | vượt rate limit login (M1) | Bạn thao tác quá nhanh, vui lòng thử lại sau |

Hiện chưa có trường `code`; body hiện là `{ message, error, statusCode }`. M0 map sang `code` (giữ nguyên `message`).

## 9. Service layer design
`AuthService` (đã có):
- `login(dto: LoginDto): Promise<LoginResult>` — xác thực, phát token, lưu hash refresh token.
- `refresh(dto: RefreshTokenDto): Promise<IssuedTokens>` — xoay vòng (transaction), phát hiện dùng lại.
- `logout(dto: RefreshTokenDto): Promise<void>` — thu hồi token nếu có.
- `validateUser(userId: string): Promise<AuthenticatedUser>` — dùng bởi `JwtStrategy`.
- `hashToken(token: string): string` — SHA-256 (export, dùng trong test).

Bổ sung (M1/M8), chuyển vào `RefreshTokenService`:
- `revokeAllForUser(userId: string, tx?: Prisma.TransactionClient): Promise<number>` — dùng bởi `users` khi khóa/đổi mật khẩu.
- `purgeExpiredRefreshTokens(before: Date): Promise<number>` — dùng bởi job dọn ([background-jobs.md](../03-cross-cutting/background-jobs.md)).

Transaction: `refresh` (thu hồi cũ + tạo mới). Side effects: không phát event; ghi `NhatKyHeThong` cho `auth.login_failed`? Không (chỉ log mức warn, tránh phình bảng).

## 10. Controller layer
- `login`, `refresh`, `logout` → `@Public()`; `logout` `@HttpCode(204)`, `login`/`refresh` `@HttpCode(200)`.
- `me` → `JwtAuthGuard` global, không `@Roles` (mọi role).
- Guards toàn cục đăng ký trong `AuthModule` qua `APP_GUARD`: `JwtAuthGuard` rồi `RolesGuard`.
- Interceptors: không.

## 11. File layout
Đã có (không đổi trừ ghi chú):
```
src/auth/
  auth.module.ts
  auth.controller.ts
  auth.service.ts
  auth.service.spec.ts
  strategies/jwt.strategy.ts
  guards/{jwt-auth.guard,roles.guard}.ts  (+ .spec.ts)
  decorators/{public,roles,current-user}.decorator.ts
  dto/{login,refresh-token}.dto.ts
  types/{authenticated-user,jwt-payload}.type.ts
src/config/auth.config.ts
```
Thêm ở M1: `src/auth/roles.constants.ts`, `src/auth/refresh-token/refresh-token.module.ts`, `refresh-token.service.ts` (+ spec).

## 12. Test plan
### Unit tests (đã có: 17 + guard 10)
- `login() — đúng thông tin → trả token và lưu hash refresh token` ; `— sai mật khẩu → 401` ; `— username không tồn tại → 401 cùng thông báo` ; `— tài khoản khóa → 401 "Tài khoản đã bị khóa"` ; `— role vô hiệu → role null`.
- `refresh() — hợp lệ → token mới, token cũ bị thu hồi` ; `— token đã thu hồi → 401 và thu hồi cả phiên` ; `— JWT hết hạn → 401` ; `— hết hạn theo DB → 401` ; `— sai chữ ký → 401` ; `— không có trong DB → 401` ; `— user bị khóa → 401`.
- `logout() — thu hồi token` ; `— token không tồn tại → không lỗi`.
- `validateUser() — hợp lệ / không tồn tại / bị khóa`.
- `RolesGuard` (6 case), `JwtAuthGuard` (4 case).
### Unit tests thêm ở M0/M1
- `HttpExceptionFilter` map lỗi Auth sang `code` đúng (`AUTH_*`).
- `RefreshTokenService.revokeAllForUser() — thu hồi mọi token còn hiệu lực, bỏ qua token đã thu hồi → trả số dòng`.
- `RefreshTokenService.purgeExpiredRefreshTokens() — chỉ xóa token hết hạn quá ngưỡng`.
- Cấu hình: `authConfig — thiếu secret / secret ngắn / hai secret trùng → ném lỗi khi khởi động`.
### E2E tests (đã có: 13 trong `auth.e2e-spec.ts`)
- login thành công, sai mật khẩu, khóa, body sai; `/auth/me` có/không token, user khóa sau khi đã có token; `@Roles` 200/403/401; refresh xoay vòng + dùng lại token cũ; logout; refresh token rác.
### E2E thêm ở M0/M1
- Cập nhật path `/api/v1/auth/*` và kiểm `code` trong body lỗi.
- Rate limit: vượt ngưỡng login → 429.
- Khóa user qua `users` ⇒ refresh token cũ bị từ chối.

## 13. Permissions
| Action | ADMIN | QUAN_LY_KHO | NHAN_VIEN_KHO | KE_TOAN |
|---|---|---|---|---|
| login / refresh / logout | public | public | public | public |
| me | ✓ | ✓ | ✓ | ✓ |

## 14. Open questions
- **Q-AUTH-1**: Có cần giới hạn tốc độ `POST /auth/login` (đề xuất 5 lần/phút/IP) và khóa tạm sau N lần sai không?
- **Q-AUTH-2**: Thời hạn token hiện 15 phút / 7 ngày — giữ nguyên hay đổi (ví dụ kho dùng thiết bị chung cần phiên ngắn hơn)?
- **Q-AUTH-3**: Mỗi user được đăng nhập đồng thời mấy thiết bị? (hiện không giới hạn; mỗi lần login tạo thêm một refresh token).
- **Q-AUTH-4**: Giữ dùng chung `Authorization: Bearer` hay chuyển refresh token sang cookie httpOnly (phụ thuộc loại client: web/mobile)?
