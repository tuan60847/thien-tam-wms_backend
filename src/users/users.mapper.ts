import type { UserResponseDto } from './dto/user-response.dto.js';
import type { UserWithRole } from './users.service.js';

export function toUserResponse(user: UserWithRole): UserResponseDto {
  return {
    id: user.id,
    maNV: user.maNV,
    username: user.username,
    hoTen: user.hoTen,
    email: user.email,
    trangThai: user.trangThai,
    role: user.role
      ? {
          id: user.role.id,
          maRole: user.role.maRole,
          tenRole: user.role.tenRole,
        }
      : null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
