# Module: users

## 1. Mục đích
- Quản lý tài khoản nhân viên: tạo, sửa, khóa/mở khóa, gán role, đặt lại mật khẩu; người dùng tự xem/sửa hồ sơ và đổi mật khẩu của mình.
- Actors: `ADMIN` (quản trị đầy đủ); `QUAN_LY_KHO` (xem danh sách/chi tiết); mọi role (hồ sơ của chính mình).

## 2. Scope
### In scope
- CRUD hạn chế (không xóa): list, read, create, update, khóa/mở khóa qua `trangThai`.
- Đặt lại mật khẩu bởi admin; đổi mật khẩu bởi chính người dùng (yêu cầu mật khẩu cũ).
- Thu hồi mọi refresh token khi khóa / đổi mật khẩu / đặt lại mật khẩu / đổi role.
- Hồ sơ cá nhân: `PATCH /users/me` (hoTen, email).
### Out of scope (phase 2)
- Xóa user (chỉ khóa), import user hàng loạt, ảnh đại diện.
- Quên mật khẩu qua email, buộc đổi mật khẩu lần đầu (có thể là câu hỏi mở).
- Lịch sử đăng nhập.

## 3. Dependencies
- Cần có trước: `roles` (gán role), `auth` (đã có; dùng `RefreshTokenService`), `audit` (`NhatKyHeThong`), `CodeGeneratorService` (sinh `maNV`).
- Thư viện ngoài: không thêm (`bcrypt` đã có).

## 4. Data model
- Model: `User` (+ `Role`, `RefreshToken`).
- Quy tắc trường: `maNV` sinh tự động `NV` + 4 số (không nhận từ client), unique; `username` unique, chữ thường, `^[a-z0-9._-]{3,32}$`; `email` tùy chọn, unique, chữ thường; `password` luôn bcrypt cost 10; `hoTen` 1–100 ký tự; `roleId` có thể `null` ở DB nhưng API tạo user **bắt buộc** có role; `trangThai` mặc định `true`.
- Đề xuất: P-02 (`createdById` tự tham chiếu `User` — không bắt buộc, bỏ qua cho `User`), P-15 (`BoDemMa` cho `NV`; seed khởi tạo bộ đếm `NV` = 1 để user mới là `NV0002`).

## 5. API endpoints
| Method | Path | Auth | Roles | Mô tả ngắn | DTO request | DTO response |
|---|---|---|---|---|---|---|
| GET | `/api/v1/users` | JWT | ADMIN, QUAN_LY_KHO | Danh sách user | `QueryUserDto` | `PagedResponse<UserResponseDto>` |
| GET | `/api/v1/users/:id` | JWT | ADMIN, QUAN_LY_KHO | Chi tiết user | — | `UserResponseDto` |
| POST | `/api/v1/users` | JWT | ADMIN | Tạo user | `CreateUserDto` | `UserResponseDto` (201) |
| PATCH | `/api/v1/users/:id` | JWT | ADMIN | Sửa hồ sơ/role/trạng thái | `UpdateUserDto` | `UserResponseDto` |
| POST | `/api/v1/users/:id/dat-lai-mat-khau` | JWT | ADMIN | Đặt mật khẩu mới cho user | `ResetPasswordDto` | 204 |
| PATCH | `/api/v1/users/me` | JWT | mọi role | Sửa hồ sơ của mình | `UpdateProfileDto` | `UserResponseDto` |
| POST | `/api/v1/users/me/doi-mat-khau` | JWT | mọi role | Đổi mật khẩu của mình | `ChangePasswordDto` | 204 |

Route `/users/me/*` khai báo **trước** `/users/:id` để không bị `:id` nuốt. `GET` hồ sơ của mình dùng `GET /auth/me` đã có.

## 6. DTOs
### Request
- `CreateUserDto`:
  - `username: string` — `@IsUsername`, trim, chuyển thường.
  - `password: string` — `@IsStrongPassword` (≥ 8, hoa/thường/số, ≤ 72 byte).
  - `hoTen: string` — `@IsNotEmpty @MaxLength(100)`, trim.
  - `email?: string | null` — `@IsEmail @MaxLength(150)`, chuyển thường.
  - `roleId: string` — `@IsUUID`.
- `UpdateUserDto` (mọi field tùy chọn): `hoTen?`, `email?: string | null`, `roleId?: string`, `trangThai?: boolean`. Không có `username`, `maNV`, `password`.
- `ResetPasswordDto { newPassword: string }` — `@IsStrongPassword`.
- `ChangePasswordDto { oldPassword: string; newPassword: string }` — `newPassword` `@IsStrongPassword` và khác `oldPassword`.
- `UpdateProfileDto { hoTen?; email?: string | null }`.
### Response
- `UserResponseDto { id; maNV; username; hoTen; email: string | null; trangThai; role: { id; maRole; tenRole } | null; createdAt; updatedAt }`. **Không bao giờ có `password`.**
### Query
- `QueryUserDto extends PaginationQueryDto { roleId?: uuid; trangThai?: boolean }`; `q` tìm trên `maNV`, `username`, `hoTen`, `email`; sort whitelist: `maNV`, `username`, `hoTen`, `createdAt`; mặc định `maNV:asc`.

## 7. Business rules
- BR-01: `maNV` sinh server-side, tăng dần, không tái sử dụng.
- BR-02: `username` và `email` unique không phân biệt hoa/thường (đã chuẩn hóa thường).
- BR-03: Role được gán phải tồn tại và `trangThai = true` (`RolesService.assertAssignable`).
- BR-04: Không tự đổi role của chính mình, không tự khóa chính mình (`USER_CANNOT_MODIFY_SELF`).
- BR-05: Luôn còn ít nhất **một** user `ADMIN` đang hoạt động: chặn khóa / hạ role user admin cuối cùng (`USER_LAST_ADMIN`). Đếm trong transaction.
- BR-06: Khóa user, đổi role, đặt lại mật khẩu, đổi mật khẩu ⇒ thu hồi toàn bộ refresh token của user đó (cùng transaction). Access token cũ chết ngay ở request kế (vì `validateUser` đọc DB).
- BR-07: Đổi mật khẩu của mình cần `oldPassword` đúng; sai → `USER_OLD_PASSWORD_WRONG`. Mật khẩu mới ≠ cũ.
- BR-08: Không có xóa user; muốn ngừng dùng thì khóa.
- BR-09: Ghi `NhatKyHeThong`: `user.create`, `user.lock`, `user.unlock`, `user.role_change`, `user.password_reset` (không ghi mật khẩu, kể cả hash).
- BR-10: `ADMIN` có thể đặt lại mật khẩu cho bất kỳ ai kể cả chính mình; đổi mật khẩu của mình qua `/me/doi-mat-khau` thì cần mật khẩu cũ.
- BR-11: Email trùng với user đã khóa vẫn bị coi là trùng.

## 8. Error cases
| Mã lỗi | HTTP | Khi nào | Message (VN) |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | DTO sai (kể cả mật khẩu yếu) | Dữ liệu gửi lên không hợp lệ |
| `USER_NOT_FOUND` | 404 | id không tồn tại | Không tìm thấy người dùng |
| `USER_USERNAME_TAKEN` | 409 | trùng username | Tên đăng nhập đã được sử dụng |
| `USER_EMAIL_TAKEN` | 409 | trùng email | Email đã được sử dụng |
| `USER_ROLE_INVALID` | 422 | role không tồn tại hoặc bị tắt | Vai trò không hợp lệ hoặc đã bị vô hiệu hóa |
| `USER_CANNOT_MODIFY_SELF` | 409 | tự đổi role / tự khóa | Bạn không thể tự thay đổi vai trò hoặc khóa chính mình |
| `USER_LAST_ADMIN` | 409 | khóa/hạ quyền admin cuối cùng | Phải còn ít nhất một quản trị viên đang hoạt động |
| `USER_OLD_PASSWORD_WRONG` | 422 | sai mật khẩu cũ | Mật khẩu hiện tại không đúng |
| `AUTH_FORBIDDEN` | 403 | role không đủ quyền | Bạn không có quyền truy cập |

## 9. Service layer design
`UsersService` (mở rộng service đã có `findByUsername`, `findById`):
- `findAll(query: QueryUserDto): Promise<PagedResponse<UserResponseDto>>`
- `findOne(id: string): Promise<UserResponseDto>`
- `create(dto: CreateUserDto, actor: AuthenticatedUser): Promise<UserResponseDto>` — sinh `maNV`, băm mật khẩu, kiểm trùng, kiểm role.
- `update(id: string, dto: UpdateUserDto, actor: AuthenticatedUser): Promise<UserResponseDto>` — BR-04/05/06.
- `resetPassword(id: string, dto: ResetPasswordDto, actor: AuthenticatedUser): Promise<void>`
- `changeOwnPassword(actor: AuthenticatedUser, dto: ChangePasswordDto): Promise<void>`
- `updateOwnProfile(actor: AuthenticatedUser, dto: UpdateProfileDto): Promise<UserResponseDto>`
- `findByUsername(username: string): Promise<UserWithRole | null>`, `findById(id: string): Promise<UserWithRole | null>` — giữ nguyên cho `auth`.

Transaction: `create` (sinh mã + tạo + nhật ký), `update` (đếm admin + cập nhật + thu hồi token + nhật ký), `resetPassword`, `changeOwnPassword` (cập nhật hash + thu hồi token). Side effects: `RefreshTokenService.revokeAllForUser(userId, tx)`, `AuditService.record(…, tx)`, `CodeGeneratorService.next('NV', tx)`.

## 10. Controller layer
- `GET /users`, `GET /users/:id` → `findAll`/`findOne` — `@Roles(ADMIN, QUAN_LY_KHO)`.
- `POST /users` → `create`; `PATCH /users/:id` → `update`; `POST /users/:id/dat-lai-mat-khau` → `resetPassword` (`@HttpCode(204)`) — `@Roles(ADMIN)`.
- `PATCH /users/me` → `updateOwnProfile`; `POST /users/me/doi-mat-khau` → `changeOwnPassword` (`@HttpCode(204)`) — chỉ cần đăng nhập; lấy `actor` bằng `@CurrentUser()`.
- Controller đặt `me` trước `:id`. `:id` dùng `ParseUUIDPipe`.

## 11. File layout
```
src/users/
  users.module.ts
  users.controller.ts
  users.service.ts
  users.service.spec.ts
  users.controller.spec.ts
  users.mapper.ts
  dto/
    create-user.dto.ts
    update-user.dto.ts
    reset-password.dto.ts
    change-password.dto.ts
    update-profile.dto.ts
    query-user.dto.ts
    user-response.dto.ts
```

## 12. Test plan
### Unit tests
- `create() — dữ liệu hợp lệ → sinh maNV NV0002, băm mật khẩu, trả UserResponseDto không có password`
- `create() — username trùng (khác hoa/thường) → USER_USERNAME_TAKEN`
- `create() — email trùng → USER_EMAIL_TAKEN`
- `create() — role bị tắt hoặc không tồn tại → USER_ROLE_INVALID`
- `create() — hai lần tạo liên tiếp → maNV tăng dần, không trùng`
- `create() — ghi nhật ký user.create không chứa mật khẩu`
- `findAll() — lọc theo roleId, trangThai, q → đúng tập`
- `findAll() — phân trang meta đúng`
- `findOne() — không tồn tại → USER_NOT_FOUND`
- `update() — đổi hoTen, email → cập nhật`
- `update() — đổi roleId → cập nhật, thu hồi refresh token, ghi user.role_change`
- `update() — khóa user → trangThai=false, thu hồi refresh token, ghi user.lock`
- `update() — mở khóa → ghi user.unlock`
- `update() — tự đổi role của mình → USER_CANNOT_MODIFY_SELF`
- `update() — tự khóa mình → USER_CANNOT_MODIFY_SELF`
- `update() — khóa admin cuối cùng → USER_LAST_ADMIN`
- `update() — hạ role admin cuối cùng → USER_LAST_ADMIN`
- `update() — khóa admin khi còn admin khác → thành công`
- `update() — email = null → xóa email`
- `update() — role bị tắt → USER_ROLE_INVALID`
- `resetPassword() — hợp lệ → hash mới, thu hồi refresh token, ghi user.password_reset`
- `resetPassword() — user không tồn tại → USER_NOT_FOUND`
- `changeOwnPassword() — mật khẩu cũ đúng → đổi hash, thu hồi token`
- `changeOwnPassword() — mật khẩu cũ sai → USER_OLD_PASSWORD_WRONG`
- `changeOwnPassword() — mật khẩu mới trùng cũ → VALIDATION_FAILED`
- `updateOwnProfile() — đổi hoTen/email của chính mình → cập nhật; email trùng → USER_EMAIL_TAKEN`
- `CreateUserDto — mật khẩu yếu (thiếu hoa/thường/số/ngắn/quá 72 byte) → lỗi`
- `CreateUserDto — username sai định dạng → lỗi`
- `UpdateUserDto — gửi password/username/maNV → bị từ chối`
- `UsersMapper — không bao giờ chứa password/tokenHash`
### E2E tests
- Admin tạo user → 201; user mới đăng nhập được; `GET /users` thấy user (đúng `maNV`).
- Tạo user trùng username → 409 `USER_USERNAME_TAKEN`.
- Admin khóa user → user đó (đang có access token) gọi `GET /auth/me` → 401 "Tài khoản đã bị khóa"; refresh token cũ bị từ chối.
- Admin đặt lại mật khẩu → mật khẩu cũ không đăng nhập được, mật khẩu mới được; refresh token cũ bị thu hồi.
- User đổi mật khẩu của mình với mật khẩu cũ sai → 422; đúng → 204; đăng nhập lại bằng mật khẩu mới.
- Admin duy nhất tự khóa / hạ quyền mình → 409; khi có 2 admin, khóa admin kia → 200.
- Ma trận role: `NHAN_VIEN_KHO`/`KE_TOAN` gọi `GET /users` và `POST /users` → 403; `QUAN_LY_KHO` `GET /users` → 200, `POST /users` → 403; mọi role gọi `PATCH /users/me` → 200.
- Không token → 401; sai UUID → 400 `COMMON_INVALID_ID`.
- Response không chứa `password`.

## 13. Permissions
| Action | ADMIN | QUAN_LY_KHO | NHAN_VIEN_KHO | KE_TOAN |
|---|---|---|---|---|
| list / read | ✓ | ✓ | ✗ | ✗ |
| create / update / khóa / đổi role | ✓ | ✗ | ✗ | ✗ |
| đặt lại mật khẩu người khác | ✓ | ✗ | ✗ | ✗ |
| sửa hồ sơ của mình (`/me`) | ✓ | ✓ | ✓ | ✓ |
| đổi mật khẩu của mình | ✓ | ✓ | ✓ | ✓ |

## 14. Open questions
- **Q-USERS-1**: `maNV` đã có hệ thống mã riêng cần giữ (ví dụ nhập tay) hay để hệ thống tự sinh `NV0002…`?
- **Q-USERS-2**: Có cần buộc user đổi mật khẩu ở lần đăng nhập đầu sau khi admin tạo/đặt lại mật khẩu (cần thêm cờ `phaiDoiMatKhau` trong `User`)?
- **Q-USERS-3**: Quy tắc mật khẩu (≥ 8, hoa/thường/số) có phù hợp? Có hết hạn mật khẩu định kỳ không?
- **Q-USERS-4**: `QUAN_LY_KHO` có được tạo/khóa tài khoản nhân viên kho không, hay chỉ `ADMIN`?
- **Q-USERS-5**: Email có bắt buộc không (hiện tùy chọn)?
