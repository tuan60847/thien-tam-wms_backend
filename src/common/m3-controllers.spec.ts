import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';
import { KhachHangController } from '../khach-hang/khach-hang.controller.js';
import { KhoController } from '../kho-vi-tri/kho.controller.js';
import { ViTriController } from '../kho-vi-tri/vi-tri.controller.js';
import { NhaCungCapController } from '../nha-cung-cap/nha-cung-cap.controller.js';
import { PhuongTienController } from '../phuong-tien-van-chuyen/phuong-tien.controller.js';

const rolesOf = (controller: { prototype: object }, method: string) =>
  Reflect.getMetadata(
    ROLES_KEY,
    (controller.prototype as Record<string, object>)[method]!,
  ) as string[] | undefined;

describe('Kho và Vị trí (metadata phân quyền)', () => {
  it.each([
    ['KhoController', KhoController],
    ['ViTriController', ViTriController],
  ])(
    '%s: đọc mọi role; tạo-sửa ADMIN/QUAN_LY_KHO; xóa ADMIN',
    (_n, controller) => {
      expect(rolesOf(controller, 'findAll')).toBeUndefined();
      expect(rolesOf(controller, 'findOne')).toBeUndefined();
      expect(rolesOf(controller, 'create')).toEqual(['ADMIN', 'QUAN_LY_KHO']);
      expect(rolesOf(controller, 'update')).toEqual(['ADMIN', 'QUAN_LY_KHO']);
      expect(rolesOf(controller, 'remove')).toEqual(['ADMIN']);
    },
  );
});

describe('Khách hàng và Nhà cung cấp (metadata phân quyền)', () => {
  it.each([
    ['KhachHangController', KhachHangController],
    ['NhaCungCapController', NhaCungCapController],
  ])(
    '%s: đọc mọi role; tạo-sửa có thêm KE_TOAN; xóa ADMIN',
    (_n, controller) => {
      expect(rolesOf(controller, 'findAll')).toBeUndefined();
      expect(rolesOf(controller, 'create')).toEqual([
        'ADMIN',
        'QUAN_LY_KHO',
        'KE_TOAN',
      ]);
      expect(rolesOf(controller, 'update')).toEqual([
        'ADMIN',
        'QUAN_LY_KHO',
        'KE_TOAN',
      ]);
      expect(rolesOf(controller, 'remove')).toEqual(['ADMIN']);
    },
  );

  it('xác minh nhà cung cấp chỉ ADMIN và QUAN_LY_KHO (kế toán không được)', () => {
    expect(rolesOf(NhaCungCapController, 'verify')).toEqual([
      'ADMIN',
      'QUAN_LY_KHO',
    ]);
  });
});

describe('Phương tiện vận chuyển (metadata phân quyền)', () => {
  it('đọc mọi role; tạo-sửa gồm NHAN_VIEN_KHO nhưng không KE_TOAN; xóa ADMIN', () => {
    expect(rolesOf(PhuongTienController, 'findAll')).toBeUndefined();
    expect(rolesOf(PhuongTienController, 'create')).toEqual([
      'ADMIN',
      'QUAN_LY_KHO',
      'NHAN_VIEN_KHO',
    ]);
    expect(rolesOf(PhuongTienController, 'update')).toEqual([
      'ADMIN',
      'QUAN_LY_KHO',
      'NHAN_VIEN_KHO',
    ]);
    expect(rolesOf(PhuongTienController, 'remove')).toEqual(['ADMIN']);
  });
});
