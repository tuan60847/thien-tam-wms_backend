import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';
import { LoaiHangController } from '../loai-hang/loai-hang.controller.js';
import { TyLeQuyDoiController } from '../ty-le-quy-doi/ty-le-quy-doi.controller.js';
import { HangHoaController } from './hang-hoa.controller.js';

const rolesOf = (controller: { prototype: object }, method: string) =>
  Reflect.getMetadata(
    ROLES_KEY,
    (controller.prototype as Record<string, object>)[method]!,
  ) as string[] | undefined;

describe.each([
  ['LoaiHangController', LoaiHangController],
  ['HangHoaController', HangHoaController],
  ['TyLeQuyDoiController', TyLeQuyDoiController],
])('%s (metadata phân quyền)', (_name, controller) => {
  it('đọc: mọi role đã đăng nhập (không giới hạn)', () => {
    expect(rolesOf(controller, 'findAll')).toBeUndefined();
    expect(rolesOf(controller, 'findOne')).toBeUndefined();
  });

  it('tạo/sửa: ADMIN và QUAN_LY_KHO', () => {
    expect(rolesOf(controller, 'create')).toEqual(['ADMIN', 'QUAN_LY_KHO']);
    expect(rolesOf(controller, 'update')).toEqual(['ADMIN', 'QUAN_LY_KHO']);
  });

  it('xóa: chỉ ADMIN', () => {
    expect(rolesOf(controller, 'remove')).toEqual(['ADMIN']);
  });
});
