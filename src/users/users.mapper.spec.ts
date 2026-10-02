import { toUserResponse } from './users.mapper.js';
import type { UserWithRole } from './users.service.js';

const base = {
  id: 'u1',
  maNV: 'NV0002',
  username: 'nv',
  password: '$2b$10$secrethash',
  hoTen: 'A',
  email: null,
  trangThai: true,
  roleId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('toUserResponse', () => {
  it('không bao giờ có password hay roleId', () => {
    const dto = toUserResponse({ ...base, role: null } as UserWithRole);
    expect(dto).not.toHaveProperty('password');
    expect(dto).not.toHaveProperty('roleId');
    expect(JSON.stringify(dto)).not.toContain('secrethash');
  });

  it('role null khi user chưa gán role; có role thì chỉ trả id, maRole, tenRole', () => {
    expect(
      toUserResponse({ ...base, role: null } as UserWithRole).role,
    ).toBeNull();
    const dto = toUserResponse({
      ...base,
      role: {
        id: 'r',
        maRole: 'ADMIN',
        tenRole: 'QT',
        moTa: 'x',
        trangThai: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as UserWithRole);
    expect(dto.role).toEqual({ id: 'r', maRole: 'ADMIN', tenRole: 'QT' });
  });
});
