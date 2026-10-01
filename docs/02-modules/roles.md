# Module: roles

## 1. Mục đích
- Quản lý metadata của 4 role hệ thống (`ADMIN`, `QUAN_LY_KHO`, `NHAN_VIEN_KHO`, `KE_TOAN`): tên hiển thị, mô tả, bật/tắt. Quyền thực tế của từng role **nằm trong code** (`@Roles`), không nằm trong bảng `Role`.
- Actors: `ADMIN` (quản lý). Các role khác không truy cập module này.

## 2. Scope
### In scope
- Liệt kê, xem chi tiết, sửa `tenRole`, `moTa`, `trangThai` của role.
- Hằng số role dùng trong code (`ROLE`) và đồng bộ với bảng `Role` qua seed.
### Out of scope (phase 2)
- Tạo/xóa role tùy biến và gán permission động (bảng `Permission`, `RolePermission`): vì quyền đang cố định trong code nên role tạo thêm sẽ không có hiệu lực. Chỉ làm khi có yêu cầu RBAC động (xem Q-ROLES-1).
- Sửa `maRole` (khóa dùng trong code).

## 3. Dependencies
- Cần có trước: `auth` (đã có), `prisma`.
- Được dùng bởi: `users` (gán role, kiểm role hợp lệ).
- Thư viện ngoài: không thêm.

## 4. Data model
- Model: `Role`. Quan hệ `users User[]`.
- Quy tắc trường: `maRole` unique, bất biến, UPPER_SNAKE; `tenRole` 1–100 ký tự; `moTa` ≤ 255; `trangThai` mặc định `true`.
- Đề xuất schema: P-02 (đã có `createdAt/updatedAt`; không cần thêm). Không thêm bảng.
- Role hệ thống = 4 giá trị `maRole` cố định trong `roles.constants.ts`; không có cột `isSystem` (suy ra từ hằng số).

## 5. API endpoints
| Method | Path | Auth | Roles | Mô tả ngắn | DTO request | DTO response |
|---|---|---|---|---|---|---|
| GET | `/api/v1/roles` | JWT | ADMIN | Danh sách role | `QueryRoleDto` | `PagedResponse<RoleResponseDto>` |
| GET | `/api/v1/roles/:id` | JWT | ADMIN | Chi tiết role | — | `RoleResponseDto` |
| PATCH | `/api/v1/roles/:id` | JWT | ADMIN | Sửa tên/mô tả/trạng thái | `UpdateRoleDto` | `RoleResponseDto` |

Không có `POST` và `DELETE` (xem Out of scope; N/A vì role cố định theo code).

## 6. DTOs
### Request
- `UpdateRoleDto` (mọi field tùy chọn, ít nhất một field):
  - `tenRole?: string` — `@IsString @IsNotEmpty @MaxLength(100)`, trim.
  - `moTa?: string | null` — `@IsString @MaxLength(255)`; `null` xóa mô tả.
  - `trangThai?: boolean` — `@IsBoolean`.
### Response
- `RoleResponseDto { id; maRole; tenRole; moTa: string | null; trangThai; soNguoiDung: number; createdAt; updatedAt }` — `soNguoiDung` = số user đang `trangThai = true` thuộc role.
### Query
- `QueryRoleDto extends PaginationQueryDto { trangThai?: boolean }` — `q` tìm trên `maRole`, `tenRole`; sort whitelist: `maRole`, `tenRole`, `createdAt`; mặc định `maRole:asc`.

## 7. Business rules
- BR-01: `maRole` không đổi được (không có trong `UpdateRoleDto`).
- BR-02: Role `ADMIN` không được đặt `trangThai = false`.
- BR-03: Role khác chỉ được đặt `trangThai = false` khi **không còn user đang hoạt động** thuộc role đó (tránh làm user mất toàn bộ quyền ngầm vì `role` bị coi là `null`).
- BR-04: Đặt lại `trangThai = true` luôn được phép.
- BR-05: Mọi thay đổi ghi `NhatKyHeThong` với `hanhDong = role.update` (trước/sau các trường đổi).
- BR-06: Seed đảm bảo 4 role tồn tại; startup không tự tạo (chỉ seed).

## 8. Error cases
| Mã lỗi | HTTP | Khi nào | Message (VN) |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | DTO sai / không có field nào để cập nhật | Dữ liệu gửi lên không hợp lệ |
| `ROLE_NOT_FOUND` | 404 | id không tồn tại | Không tìm thấy vai trò |
| `ROLE_SYSTEM_PROTECTED` | 409 | tắt role `ADMIN` | Không thể vô hiệu hóa vai trò Quản trị viên |
| `ROLE_HAS_ACTIVE_USERS` | 409 | tắt role còn user hoạt động | Vai trò vẫn còn người dùng đang hoạt động, hãy chuyển họ sang vai trò khác trước |
| `AUTH_FORBIDDEN` | 403 | role không phải ADMIN | Bạn không có quyền truy cập |

## 9. Service layer design
`RolesService`:
- `findAll(query: QueryRoleDto): Promise<PagedResponse<RoleResponseDto>>` — danh sách kèm đếm user hoạt động.
- `findOne(id: string): Promise<RoleResponseDto>` — 404 nếu không có.
- `update(id: string, dto: UpdateRoleDto, actor: AuthenticatedUser): Promise<RoleResponseDto>` — kiểm BR-02/03, cập nhật, ghi nhật ký.
- `findActiveByMaRole(maRole: string): Promise<Role | null>` — cho `users`.
- `assertAssignable(roleId: string): Promise<Role>` — role tồn tại và `trangThai = true`, không thì ném `USER_ROLE_INVALID` (dùng bởi `users`).

Transaction: `update` — kiểm đếm user + cập nhật + ghi nhật ký trong một `$transaction`. Side effects: `AuditService.record`.

## 10. Controller layer
- `GET /roles`, `GET /roles/:id`, `PATCH /roles/:id` → `RolesService`.
- Guards: `JwtAuthGuard` global; `@Roles(ROLE.ADMIN)` ở mức controller.
- Interceptors: không. `:id` dùng `ParseUUIDPipe`.

## 11. File layout
```
src/roles/
  roles.module.ts
  roles.controller.ts
  roles.service.ts
  roles.service.spec.ts
  roles.controller.spec.ts
  dto/
    update-role.dto.ts
    query-role.dto.ts
    role-response.dto.ts
  roles.mapper.ts
src/auth/roles.constants.ts      # export const ROLE = { ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO, KE_TOAN } as const
```

## 12. Test plan
### Unit tests
- `findAll() — có role với 2 user hoạt động, 1 user khóa → soNguoiDung = 2`
- `findAll() — lọc trangThai=false → chỉ role bị tắt`
- `findAll() — sort theo field ngoài whitelist → VALIDATION_FAILED`
- `findOne() — id tồn tại → trả RoleResponseDto`
- `findOne() — id không tồn tại → ROLE_NOT_FOUND`
- `update() — đổi tenRole, moTa → cập nhật và ghi nhật ký`
- `update() — moTa = null → xóa mô tả`
- `update() — tắt role ADMIN → ROLE_SYSTEM_PROTECTED`
- `update() — tắt role còn user hoạt động → ROLE_HAS_ACTIVE_USERS`
- `update() — tắt role không còn user hoạt động → thành công`
- `update() — bật lại role → thành công`
- `update() — role không tồn tại → ROLE_NOT_FOUND`
- `update() — body rỗng → VALIDATION_FAILED`
- `assertAssignable() — role đang hoạt động → trả role`
- `assertAssignable() — role bị tắt hoặc không tồn tại → USER_ROLE_INVALID`
- `UpdateRoleDto — gửi maRole → bị từ chối (forbidNonWhitelisted)`
- `RolesController — metadata @Roles chỉ chứa ADMIN`
### E2E tests
- Seed 4 role; admin đăng nhập `GET /roles` → 4 mục, đúng `soNguoiDung`.
- `QUAN_LY_KHO` gọi `GET /roles` → 403; không token → 401.
- `PATCH /roles/:id` đổi `tenRole` → 200 và `GET` lại thấy giá trị mới; nhật ký có 1 dòng `role.update`.
- Tắt `ADMIN` → 409 `ROLE_SYSTEM_PROTECTED`.
- Tắt `NHAN_VIEN_KHO` khi còn user → 409; chuyển hết user đi rồi tắt → 200; user thuộc role bị tắt đăng nhập được nhưng `role = null` và `@Roles` → 403.

## 13. Permissions
| Action | ADMIN | QUAN_LY_KHO | NHAN_VIEN_KHO | KE_TOAN |
|---|---|---|---|---|
| list / read | ✓ | ✗ | ✗ | ✗ |
| update | ✓ | ✗ | ✗ | ✗ |
| create / delete | N/A | N/A | N/A | N/A |

## 14. Open questions
- **Q-ROLES-1**: Có cần tạo role tùy biến và phân quyền động (bảng permission) không, hay 4 role cố định là đủ? Nếu cần, module này mở rộng đáng kể (RBAC động) và mọi `@Roles` phải đổi cơ chế.
- **Q-ROLES-2**: Danh sách 4 role đã đủ chưa? (ví dụ cần `NHAN_VIEN_BAN_HANG`/`KINH_DOANH` để lập phiếu xuất, `THU_KHO`, `DUOC_SI` chịu trách nhiệm chuyên môn?) Xem thêm Q-XUAT-1.
