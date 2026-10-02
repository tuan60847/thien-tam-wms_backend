import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';
import { RolesController } from '../roles/roles.controller.js';
import { UsersController } from './users.controller.js';

const rolesOf = (target: object, key?: string): string[] | undefined =>
  Reflect.getMetadata(
    ROLES_KEY,
    key ? (target as Record<string, object>)[key]! : target,
  );

describe('UsersController (metadata phân quyền)', () => {
  const proto = UsersController.prototype as unknown as Record<string, object>;

  it('list/chi tiết: ADMIN và QUAN_LY_KHO', () => {
    expect(rolesOf(proto, 'findAll')).toEqual(['ADMIN', 'QUAN_LY_KHO']);
    expect(rolesOf(proto, 'findOne')).toEqual(['ADMIN', 'QUAN_LY_KHO']);
  });

  it('tạo, sửa, đặt lại mật khẩu: chỉ ADMIN', () => {
    expect(rolesOf(proto, 'create')).toEqual(['ADMIN']);
    expect(rolesOf(proto, 'update')).toEqual(['ADMIN']);
    expect(rolesOf(proto, 'resetPassword')).toEqual(['ADMIN']);
  });

  it('các route /me không giới hạn role (mọi người dùng đã đăng nhập)', () => {
    expect(rolesOf(proto, 'updateProfile')).toBeUndefined();
    expect(rolesOf(proto, 'changePassword')).toBeUndefined();
  });

  it('route /me khai báo trước /:id để không bị nuốt', () => {
    const names = Object.getOwnPropertyNames(UsersController.prototype);
    expect(names.indexOf('updateProfile')).toBeLessThan(
      names.indexOf('update'),
    );
  });
});

describe('RolesController (metadata phân quyền)', () => {
  it('toàn bộ controller chỉ cho ADMIN', () => {
    expect(rolesOf(RolesController)).toEqual(['ADMIN']);
  });
});
