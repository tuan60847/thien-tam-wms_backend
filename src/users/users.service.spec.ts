import type { Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { mock } from 'vitest-mock-extended';
import type { AuditService } from '../audit/audit.service.js';
import type { RefreshTokenService } from '../auth/refresh-token/refresh-token.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import type { CodeGeneratorService } from '../common/code-generator/code-generator.service.js';
import { AppException } from '../common/errors/app.exception.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RolesService } from '../roles/roles.service.js';
import { UsersService, type UserWithRole } from './users.service.js';

const NOW = new Date('2026-10-01T00:00:00Z');

const role = (id: string, maRole: string, trangThai = true): Role => ({
  id,
  maRole,
  tenRole: maRole,
  moTa: null,
  trangThai,
  createdAt: NOW,
  updatedAt: NOW,
});
const ADMIN = role('r-admin', 'ADMIN');
const NVK = role('r-nvk', 'NHAN_VIEN_KHO');
const KE_TOAN = role('r-kt', 'KE_TOAN');
const OFF = role('r-off', 'OFF', false);

let hashOf: (plain: string) => string;

const makeUser = (
  id: string,
  r: Role | null,
  over: Partial<UserWithRole> = {},
): UserWithRole => ({
  id,
  maNV: `NV${id.toUpperCase()}`,
  username: id,
  password: hashOf('Matkhau@1'),
  hoTen: `User ${id}`,
  email: null,
  trangThai: true,
  roleId: r?.id ?? null,
  role: r,
  createdAt: NOW,
  updatedAt: NOW,
  ...over,
});

function actorOf(id: string, maRole = 'ADMIN'): AuthenticatedUser {
  return {
    id,
    maNV: id,
    username: id,
    hoTen: id,
    email: null,
    role: { maRole, tenRole: maRole },
  };
}

function setup(
  seedUsers: UserWithRole[],
  roles: Role[] = [ADMIN, NVK, KE_TOAN, OFF],
) {
  const store = new Map(seedUsers.map((u) => [u.id, { ...u }]));
  const roleById = new Map(roles.map((r) => [r.id, r]));
  let counter = 100;

  const matches = (
    u: UserWithRole,
    where: Record<string, unknown>,
  ): boolean => {
    for (const [key, cond] of Object.entries(where)) {
      if (cond === undefined || key === 'OR') continue;
      if (key === 'id' && typeof cond === 'object' && cond && 'not' in cond) {
        if (u.id === (cond as { not: string }).not) return false;
      } else if (key === 'role') {
        const is = (cond as { is: { maRole: string; trangThai: boolean } }).is;
        if (u.role?.maRole !== is.maRole || u.role?.trangThai !== is.trangThai)
          return false;
      } else if ((u as Record<string, unknown>)[key] !== cond) {
        return false;
      }
    }
    return true;
  };

  const user = {
    findUnique: vi.fn(
      async ({ where }: { where: Record<string, string> }) =>
        [...store.values()].find((u) =>
          Object.entries(where).every(
            ([k, v]) => (u as Record<string, unknown>)[k] === v,
          ),
        ) ?? null,
    ),
    count: vi.fn(
      async ({ where }: { where: Record<string, unknown> }) =>
        [...store.values()].filter((u) => matches(u, where)).length,
    ),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const id = `new${++counter}`;
      const created = makeUser(
        id,
        roleById.get(data.roleId as string) ?? null,
        {
          ...(data as Partial<UserWithRole>),
          password: data.password as string,
        },
      );
      store.set(id, created);
      return created;
    }),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const current = store.get(where.id)!;
        const next = { ...current } as Record<string, unknown>;
        for (const [k, v] of Object.entries(data)) {
          if (v !== undefined) next[k] = v;
        }
        const roleNext = roleById.get(next.roleId as string) ?? null;
        next.role = roleNext;
        store.set(where.id, next as unknown as UserWithRole);
        return next as unknown as UserWithRole;
      },
    ),
    findMany: vi.fn(async () => [...store.values()]),
  };
  const queryRaw = vi.fn(async () => []);
  const client = { user, $queryRaw: queryRaw };
  const prisma = {
    ...client,
    $transaction: vi.fn(async (fn: (tx: typeof client) => Promise<unknown>) =>
      fn(client),
    ),
  } as unknown as PrismaService;

  const roles$ = mock<RolesService>();
  roles$.assertAssignable.mockImplementation(async (id: string) => {
    const r = roleById.get(id);
    if (!r?.trangThai) throw new AppException('USER_ROLE_INVALID');
    return r;
  });
  const revoke = vi.fn().mockResolvedValue(1);
  const refreshTokens = {
    revokeAllForUser: revoke,
  } as unknown as RefreshTokenService;
  const nextCode = vi.fn(async () => `NV${String(++counter).padStart(4, '0')}`);
  const codes = { next: nextCode } as unknown as CodeGeneratorService;
  const record = vi.fn().mockResolvedValue({});
  const audit = { record } as unknown as AuditService;

  return {
    service: new UsersService(prisma, roles$, refreshTokens, codes, audit),
    store,
    user,
    queryRaw,
    revoke,
    record,
    nextCode,
  };
}

const actions = (record: ReturnType<typeof vi.fn>) =>
  record.mock.calls.map((c) => (c[0] as { hanhDong: string }).hanhDong);

beforeAll(() => {
  const hash = bcrypt.hashSync('Matkhau@1', 4);
  hashOf = () => hash;
});

describe('UsersService', () => {
  describe('create', () => {
    const dto = {
      username: 'nv01',
      password: 'Matkhau@123',
      hoTen: 'Nguyễn A',
      email: 'a@b.vn',
      roleId: NVK.id,
    };

    it('sinh maNV, băm mật khẩu, trả DTO không có password, ghi nhật ký không chứa mật khẩu', async () => {
      const { service, user, record } = setup([makeUser('boss', ADMIN)]);
      const result = await service.create(dto);

      expect(result).toMatchObject({
        username: 'nv01',
        hoTen: 'Nguyễn A',
        role: { maRole: 'NHAN_VIEN_KHO' },
      });
      expect(JSON.stringify(result)).not.toContain('password');
      const saved = user.create.mock.calls[0]![0].data as {
        password: string;
        maNV: string;
      };
      expect(saved.maNV).toMatch(/^NV\d{4}$/);
      expect(saved.password).not.toBe(dto.password);
      expect(await bcrypt.compare(dto.password, saved.password)).toBe(true);
      expect(JSON.stringify(record.mock.calls)).not.toContain('Matkhau');
      expect(actions(record)).toEqual(['user.create']);
    });

    it('hai lần tạo liên tiếp → maNV khác nhau', async () => {
      const { service } = setup([]);
      const a = await service.create(dto);
      const b = await service.create({
        ...dto,
        username: 'nv02',
        email: 'b@b.vn',
      });
      expect(a.maNV).not.toBe(b.maNV);
    });

    it('username trùng → USER_USERNAME_TAKEN, không tạo gì', async () => {
      const { service, user } = setup([makeUser('nv01', NVK)]);
      await expect(service.create(dto)).rejects.toMatchObject({
        code: 'USER_USERNAME_TAKEN',
      });
      expect(user.create).not.toHaveBeenCalled();
    });

    it('email trùng → USER_EMAIL_TAKEN', async () => {
      const { service } = setup([makeUser('x', NVK, { email: 'a@b.vn' })]);
      await expect(service.create(dto)).rejects.toMatchObject({
        code: 'USER_EMAIL_TAKEN',
      });
    });

    it('không có email → tạo được, email null', async () => {
      const { service } = setup([]);
      await expect(
        service.create({ ...dto, email: undefined }),
      ).resolves.toMatchObject({ email: null });
    });

    it('role bị tắt hoặc không tồn tại → USER_ROLE_INVALID', async () => {
      const { service } = setup([]);
      await expect(
        service.create({ ...dto, roleId: OFF.id }),
      ).rejects.toMatchObject({ code: 'USER_ROLE_INVALID' });
      await expect(
        service.create({ ...dto, roleId: 'khong-co' }),
      ).rejects.toMatchObject({ code: 'USER_ROLE_INVALID' });
    });
  });

  describe('findAll / findOne', () => {
    it('findOne không tồn tại → USER_NOT_FOUND', async () => {
      const { service } = setup([]);
      await expect(service.findOne('x')).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
      });
    });

    it('findOne không lộ password', async () => {
      const { service } = setup([makeUser('u1', NVK)]);
      expect(JSON.stringify(await service.findOne('u1'))).not.toContain(
        'password',
      );
    });

    it('findAll phân trang và map DTO', async () => {
      const { service } = setup([makeUser('u1', NVK), makeUser('u2', ADMIN)]);
      const result = await service.findAll({ page: 1, pageSize: 20 });
      expect(result.items).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(JSON.stringify(result)).not.toContain('"password"');
    });

    it('findAll từ chối sort ngoài whitelist (không cho sắp theo password)', () => {
      const { service } = setup([]);
      expect(() =>
        service.findAll({ page: 1, pageSize: 20, sort: 'password:asc' }),
      ).toThrow(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
    });
  });

  describe('update', () => {
    it('đổi hoTen và email → cập nhật, không thu hồi token', async () => {
      const { service, revoke } = setup([
        makeUser('boss', ADMIN),
        makeUser('u1', NVK),
      ]);
      const result = await service.update(
        'u1',
        { hoTen: 'Tên mới', email: 'moi@b.vn' },
        actorOf('boss'),
      );
      expect(result).toMatchObject({ hoTen: 'Tên mới', email: 'moi@b.vn' });
      expect(revoke).not.toHaveBeenCalled();
    });

    it('email = null → xóa email', async () => {
      const { service } = setup([
        makeUser('boss', ADMIN),
        makeUser('u1', NVK, { email: 'a@b.vn' }),
      ]);
      await expect(
        service.update('u1', { email: null }, actorOf('boss')),
      ).resolves.toMatchObject({ email: null });
    });

    it('email trùng người khác → USER_EMAIL_TAKEN; giữ nguyên email của chính mình → OK', async () => {
      const { service } = setup([
        makeUser('boss', ADMIN),
        makeUser('u1', NVK, { email: 'a@b.vn' }),
        makeUser('u2', NVK, { email: 'c@b.vn' }),
      ]);
      await expect(
        service.update('u1', { email: 'c@b.vn' }, actorOf('boss')),
      ).rejects.toMatchObject({
        code: 'USER_EMAIL_TAKEN',
      });
      await expect(
        service.update('u1', { email: 'a@b.vn' }, actorOf('boss')),
      ).resolves.toBeDefined();
    });

    it('đổi role → cập nhật, thu hồi refresh token, ghi user.role_change', async () => {
      const { service, revoke, record } = setup([
        makeUser('boss', ADMIN),
        makeUser('u1', NVK),
      ]);
      const result = await service.update(
        'u1',
        { roleId: KE_TOAN.id },
        actorOf('boss'),
      );
      expect(result.role?.maRole).toBe('KE_TOAN');
      expect(revoke).toHaveBeenCalledWith('u1', expect.anything());
      expect(actions(record)).toEqual(['user.role_change']);
    });

    it('role bị tắt → USER_ROLE_INVALID', async () => {
      const { service } = setup([makeUser('boss', ADMIN), makeUser('u1', NVK)]);
      await expect(
        service.update('u1', { roleId: OFF.id }, actorOf('boss')),
      ).rejects.toMatchObject({
        code: 'USER_ROLE_INVALID',
      });
    });

    it('khóa user → trangThai=false, thu hồi token, ghi user.lock', async () => {
      const { service, revoke, record } = setup([
        makeUser('boss', ADMIN),
        makeUser('u1', NVK),
      ]);
      const result = await service.update(
        'u1',
        { trangThai: false },
        actorOf('boss'),
      );
      expect(result.trangThai).toBe(false);
      expect(revoke).toHaveBeenCalledOnce();
      expect(actions(record)).toEqual(['user.lock']);
    });

    it('mở khóa → ghi user.unlock, không cần thu hồi token', async () => {
      const { service, revoke, record } = setup([
        makeUser('boss', ADMIN),
        makeUser('u1', NVK, { trangThai: false }),
      ]);
      await service.update('u1', { trangThai: true }, actorOf('boss'));
      expect(actions(record)).toEqual(['user.unlock']);
      expect(revoke).not.toHaveBeenCalled();
    });

    it('tự đổi role của mình → USER_CANNOT_MODIFY_SELF', async () => {
      const { service } = setup([
        makeUser('boss', ADMIN),
        makeUser('boss2', ADMIN),
      ]);
      await expect(
        service.update('boss', { roleId: NVK.id }, actorOf('boss')),
      ).rejects.toMatchObject({
        code: 'USER_CANNOT_MODIFY_SELF',
      });
    });

    it('tự khóa mình → USER_CANNOT_MODIFY_SELF', async () => {
      const { service } = setup([
        makeUser('boss', ADMIN),
        makeUser('boss2', ADMIN),
      ]);
      await expect(
        service.update('boss', { trangThai: false }, actorOf('boss')),
      ).rejects.toMatchObject({
        code: 'USER_CANNOT_MODIFY_SELF',
      });
    });

    it('tự sửa hoTen của mình qua PATCH /users/:id → được', async () => {
      const { service } = setup([makeUser('boss', ADMIN)]);
      await expect(
        service.update('boss', { hoTen: 'Sếp' }, actorOf('boss')),
      ).resolves.toMatchObject({ hoTen: 'Sếp' });
    });

    it('khóa admin cuối cùng → USER_LAST_ADMIN', async () => {
      const { service, store } = setup([
        makeUser('boss', ADMIN),
        makeUser('ad1', ADMIN),
      ]);
      // 'boss' is the actor; ad1 is the only OTHER admin -> locking ad1 leaves boss: allowed.
      await expect(
        service.update('ad1', { trangThai: false }, actorOf('boss')),
      ).resolves.toBeDefined();
      // now boss is the last active admin; another admin-actor cannot lock him
      store.set('ad2', makeUser('ad2', NVK));
      await expect(
        service.update('boss', { trangThai: false }, actorOf('ad2')),
      ).rejects.toMatchObject({
        code: 'USER_LAST_ADMIN',
      });
    });

    it('khóa dòng role ADMIN ngay câu lệnh đầu tiên, trước mọi lần đọc user', async () => {
      const { service, user, queryRaw } = setup([
        makeUser('boss', ADMIN),
        makeUser('u1', NVK),
      ]);
      await service.update('u1', { hoTen: 'A' }, actorOf('boss'));
      expect(queryRaw).toHaveBeenCalledOnce();
      expect(queryRaw.mock.invocationCallOrder[0]!).toBeLessThan(
        user.findUnique.mock.invocationCallOrder[0]!,
      );
    });

    it('hạ role admin cuối cùng → USER_LAST_ADMIN', async () => {
      const { service } = setup([
        makeUser('ad1', ADMIN),
        makeUser('actor', NVK),
      ]);
      await expect(
        service.update('ad1', { roleId: NVK.id }, actorOf('actor')),
      ).rejects.toMatchObject({
        code: 'USER_LAST_ADMIN',
      });
    });

    it('admin đã bị khóa không được tính là admin còn lại', async () => {
      const { service } = setup([
        makeUser('ad1', ADMIN),
        makeUser('ad-locked', ADMIN, { trangThai: false }),
        makeUser('actor', NVK),
      ]);
      await expect(
        service.update('ad1', { trangThai: false }, actorOf('actor')),
      ).rejects.toMatchObject({
        code: 'USER_LAST_ADMIN',
      });
    });

    it('khóa user thường khi chỉ có một admin → bình thường (không đụng ràng buộc admin)', async () => {
      const { service, user } = setup([
        makeUser('ad1', ADMIN),
        makeUser('u1', NVK),
      ]);
      await expect(
        service.update('u1', { trangThai: false }, actorOf('ad1')),
      ).resolves.toBeDefined();
      expect(user.count).not.toHaveBeenCalled();
    });

    it('user không tồn tại → USER_NOT_FOUND', async () => {
      const { service } = setup([makeUser('boss', ADMIN)]);
      await expect(
        service.update('x', { hoTen: 'A' }, actorOf('boss')),
      ).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
      });
    });
  });

  describe('resetPassword', () => {
    it('đổi hash, thu hồi token, ghi user.password_reset không chứa mật khẩu', async () => {
      const { service, store, revoke, record } = setup([makeUser('u1', NVK)]);
      const before = store.get('u1')!.password;
      await service.resetPassword('u1', { newPassword: 'MoiMoi@123' });
      const after = store.get('u1')!.password;
      expect(after).not.toBe(before);
      expect(await bcrypt.compare('MoiMoi@123', after)).toBe(true);
      expect(revoke).toHaveBeenCalledWith('u1', expect.anything());
      expect(actions(record)).toEqual(['user.password_reset']);
      expect(JSON.stringify(record.mock.calls)).not.toContain('MoiMoi');
    });

    it('user không tồn tại → USER_NOT_FOUND', async () => {
      const { service } = setup([]);
      await expect(
        service.resetPassword('x', { newPassword: 'MoiMoi@123' }),
      ).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
      });
    });
  });

  describe('changeOwnPassword', () => {
    it('mật khẩu cũ đúng → đổi hash và thu hồi mọi token', async () => {
      const { service, store, revoke } = setup([makeUser('u1', NVK)]);
      await service.changeOwnPassword(actorOf('u1', 'NHAN_VIEN_KHO'), {
        oldPassword: 'Matkhau@1',
        newPassword: 'MoiMoi@123',
      });
      expect(
        await bcrypt.compare('MoiMoi@123', store.get('u1')!.password),
      ).toBe(true);
      expect(revoke).toHaveBeenCalledWith('u1', expect.anything());
    });

    it('mật khẩu cũ sai → USER_OLD_PASSWORD_WRONG, không đổi gì', async () => {
      const { service, user, revoke } = setup([makeUser('u1', NVK)]);
      await expect(
        service.changeOwnPassword(actorOf('u1'), {
          oldPassword: 'Sai@12345',
          newPassword: 'MoiMoi@123',
        }),
      ).rejects.toMatchObject({ code: 'USER_OLD_PASSWORD_WRONG' });
      expect(user.update).not.toHaveBeenCalled();
      expect(revoke).not.toHaveBeenCalled();
    });

    it('mật khẩu mới trùng mật khẩu cũ → VALIDATION_FAILED', async () => {
      const { service } = setup([makeUser('u1', NVK)]);
      await expect(
        service.changeOwnPassword(actorOf('u1'), {
          oldPassword: 'Matkhau@1',
          newPassword: 'Matkhau@1',
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    });
  });

  describe('updateOwnProfile', () => {
    it('đổi hoTen và email của chính mình', async () => {
      const { service } = setup([makeUser('u1', NVK)]);
      await expect(
        service.updateOwnProfile(actorOf('u1'), {
          hoTen: 'Tên mới',
          email: 'moi@b.vn',
        }),
      ).resolves.toMatchObject({ hoTen: 'Tên mới', email: 'moi@b.vn' });
    });

    it('email trùng người khác → USER_EMAIL_TAKEN; giữ email của mình → OK', async () => {
      const { service } = setup([
        makeUser('u1', NVK, { email: 'a@b.vn' }),
        makeUser('u2', NVK, { email: 'c@b.vn' }),
      ]);
      await expect(
        service.updateOwnProfile(actorOf('u1'), { email: 'c@b.vn' }),
      ).rejects.toMatchObject({
        code: 'USER_EMAIL_TAKEN',
      });
      await expect(
        service.updateOwnProfile(actorOf('u1'), { email: 'a@b.vn' }),
      ).resolves.toBeDefined();
    });
  });

  describe('lookups cho Auth', () => {
    it('findByUsername / findById kèm role', async () => {
      const { service, user } = setup([makeUser('u1', NVK)]);
      await service.findById('u1');
      await service.findByUsername('u1');
      expect(user.findUnique).toHaveBeenCalledTimes(2);
    });
  });
});
