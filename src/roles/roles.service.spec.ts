import type { Role } from '@prisma/client';
import { mock } from 'vitest-mock-extended';
import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { RolesService } from './roles.service.js';

const NOW = new Date('2026-10-01T00:00:00Z');

const makeRole = (overrides: Partial<Role> = {}): Role => ({
  id: 'r-nvk',
  maRole: 'NHAN_VIEN_KHO',
  tenRole: 'Nhân viên kho',
  moTa: null,
  trangThai: true,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

function setup(
  initial: Role[],
  activeUsersByRole: Record<string, number> = {},
) {
  const roles = new Map(initial.map((r) => [r.id, { ...r }]));
  const record = vi.fn().mockResolvedValue({});
  const audit = mock<AuditService>();
  audit.record.mockImplementation(record);

  const roleClient = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      const r = roles.get(where.id);
      return r
        ? { ...r, _count: { users: activeUsersByRole[r.id] ?? 0 } }
        : null;
    }),
    findMany: vi.fn(async () =>
      [...roles.values()].map((r) => ({
        ...r,
        _count: { users: activeUsersByRole[r.id] ?? 0 },
      })),
    ),
    count: vi.fn(async () => roles.size),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<Role>;
      }) => {
        const current = roles.get(where.id)!;
        const next = { ...current };
        for (const [k, v] of Object.entries(data)) {
          if (v !== undefined) {
            (next as Record<string, unknown>)[k] = v;
          }
        }
        roles.set(where.id, next);
        return next;
      },
    ),
  };
  const client = {
    role: roleClient,
    user: {
      count: vi.fn(
        async ({ where }: { where: { roleId: string } }) =>
          activeUsersByRole[where.roleId] ?? 0,
      ),
    },
  };
  const prisma = {
    ...client,
    $transaction: vi.fn(async (fn: (tx: typeof client) => Promise<unknown>) =>
      fn(client),
    ),
  } as unknown as PrismaService;

  return {
    service: new RolesService(prisma, audit),
    roles,
    record,
    roleClient,
  };
}

const ADMIN = makeRole({
  id: 'r-admin',
  maRole: 'ADMIN',
  tenRole: 'Quản trị viên',
});
const NVK = makeRole();

describe('RolesService', () => {
  describe('findAll / findOne', () => {
    it('findAll trả soNguoiDung chỉ tính người đang hoạt động', async () => {
      const { service } = setup([ADMIN, NVK], { 'r-nvk': 2 });
      const result = await service.findAll({ page: 1, pageSize: 20 });
      expect(
        result.items.find((r) => r.maRole === 'NHAN_VIEN_KHO')?.soNguoiDung,
      ).toBe(2);
      expect(result.meta).toEqual({
        page: 1,
        pageSize: 20,
        total: 2,
        totalPages: 1,
      });
    });

    it('findAll từ chối sort ngoài whitelist', () => {
      const { service } = setup([ADMIN]);
      expect(() =>
        service.findAll({ page: 1, pageSize: 20, sort: 'password:asc' }),
      ).toThrow(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
    });

    it('findOne trả DTO không lộ trường thừa', async () => {
      const { service } = setup([NVK]);
      const dto = await service.findOne('r-nvk');
      expect(Object.keys(dto).sort()).toEqual(
        [
          'createdAt',
          'id',
          'maRole',
          'moTa',
          'soNguoiDung',
          'tenRole',
          'trangThai',
          'updatedAt',
        ].sort(),
      );
    });

    it('findOne không tồn tại → ROLE_NOT_FOUND', async () => {
      const { service } = setup([]);
      await expect(service.findOne('x')).rejects.toMatchObject({
        code: 'ROLE_NOT_FOUND',
      });
    });
  });

  describe('update', () => {
    it('đổi tên và mô tả, ghi nhật ký role.update với trước/sau', async () => {
      const { service, record } = setup([NVK]);
      const result = await service.update('r-nvk', {
        tenRole: 'Thủ kho',
        moTa: 'Mô tả mới',
      });
      expect(result).toMatchObject({ tenRole: 'Thủ kho', moTa: 'Mô tả mới' });
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          hanhDong: 'role.update',
          doiTuongId: 'r-nvk',
          truoc: { tenRole: 'Nhân viên kho', moTa: null, trangThai: true },
          sau: { tenRole: 'Thủ kho', moTa: 'Mô tả mới', trangThai: true },
        }),
        expect.anything(),
      );
    });

    it('moTa = null xóa mô tả', async () => {
      const { service } = setup([makeRole({ moTa: 'cũ' })]);
      await expect(
        service.update('r-nvk', { moTa: null }),
      ).resolves.toMatchObject({ moTa: null });
    });

    it('tắt role ADMIN → ROLE_SYSTEM_PROTECTED', async () => {
      const { service } = setup([ADMIN]);
      await expect(
        service.update('r-admin', { trangThai: false }),
      ).rejects.toMatchObject({
        code: 'ROLE_SYSTEM_PROTECTED',
      });
    });

    it('tắt role còn user hoạt động → ROLE_HAS_ACTIVE_USERS kèm số người', async () => {
      const { service } = setup([NVK], { 'r-nvk': 3 });
      await expect(
        service.update('r-nvk', { trangThai: false }),
      ).rejects.toMatchObject({
        code: 'ROLE_HAS_ACTIVE_USERS',
        details: { soNguoiDung: 3 },
      });
    });

    it('tắt role không còn user hoạt động → thành công', async () => {
      const { service } = setup([NVK], { 'r-nvk': 0 });
      await expect(
        service.update('r-nvk', { trangThai: false }),
      ).resolves.toMatchObject({
        trangThai: false,
      });
    });

    it('bật lại role đã tắt luôn được phép', async () => {
      const { service } = setup([makeRole({ trangThai: false })]);
      await expect(
        service.update('r-nvk', { trangThai: true }),
      ).resolves.toMatchObject({
        trangThai: true,
      });
    });

    it('role không tồn tại → ROLE_NOT_FOUND', async () => {
      const { service } = setup([]);
      await expect(service.update('x', { tenRole: 'A' })).rejects.toMatchObject(
        {
          code: 'ROLE_NOT_FOUND',
        },
      );
    });

    it('body rỗng → VALIDATION_FAILED, không ghi gì', async () => {
      const { service, roleClient } = setup([NVK]);
      await expect(service.update('r-nvk', {})).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
      });
      expect(roleClient.update).not.toHaveBeenCalled();
    });
  });

  describe('assertAssignable', () => {
    it('role đang hoạt động → trả role', async () => {
      const { service } = setup([NVK]);
      await expect(service.assertAssignable('r-nvk')).resolves.toMatchObject({
        maRole: 'NHAN_VIEN_KHO',
      });
    });

    it('role bị tắt hoặc không tồn tại → USER_ROLE_INVALID', async () => {
      const { service } = setup([makeRole({ trangThai: false })]);
      await expect(service.assertAssignable('r-nvk')).rejects.toMatchObject({
        code: 'USER_ROLE_INVALID',
      });
      await expect(service.assertAssignable('nope')).rejects.toMatchObject({
        code: 'USER_ROLE_INVALID',
      });
    });
  });
});
