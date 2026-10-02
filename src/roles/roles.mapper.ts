import type { Role } from '@prisma/client';
import type { RoleResponseDto } from './dto/role-response.dto.js';

export type RoleWithCount = Role & { _count: { users: number } };

export function toRoleResponse(role: RoleWithCount): RoleResponseDto {
  return {
    id: role.id,
    maRole: role.maRole,
    tenRole: role.tenRole,
    moTa: role.moTa,
    trangThai: role.trangThai,
    soNguoiDung: role._count.users,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}
