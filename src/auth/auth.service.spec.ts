import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { UserWithRole, UsersService } from '../users/users.service.js';
import { AuthService, hashToken } from './auth.service.js';

const config = {
  accessSecret: 'unit-test-access-secret-0123456789abcdef',
  refreshSecret: 'unit-test-refresh-secret-0123456789abcdef',
  accessTtl: '15m',
  refreshTtl: '7d',
};

interface StoredToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

// In-memory Prisma stub covering only the refreshToken operations AuthService uses.
function createFakePrisma() {
  const rows: StoredToken[] = [];
  let seq = 0;

  const matches = (row: StoredToken, where: Partial<StoredToken>) =>
    (Object.keys(where) as (keyof StoredToken)[]).every(
      (key) => row[key] === where[key],
    );

  const refreshToken = {
    create: async ({
      data,
    }: {
      data: Pick<StoredToken, 'userId' | 'tokenHash' | 'expiresAt'>;
    }) => {
      const row: StoredToken = {
        id: `rt-${++seq}`,
        revokedAt: null,
        ...data,
      };
      rows.push(row);
      return row;
    },
    findUnique: async ({ where }: { where: { tokenHash: string } }) =>
      rows.find((row) => matches(row, where)) ?? null,
    updateMany: async ({
      where,
      data,
    }: {
      where: Partial<StoredToken>;
      data: Partial<StoredToken>;
    }) => {
      const hit = rows.filter((row) => matches(row, where));
      hit.forEach((row) => Object.assign(row, data));
      return { count: hit.length };
    },
  };

  const prisma = {
    refreshToken,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ refreshToken }),
  };
  return { prisma: prisma as unknown as PrismaService, rows };
}

describe('AuthService', () => {
  let service: AuthService;
  let users: MockProxy<UsersService>;
  let jwt: JwtService;
  let rows: StoredToken[];
  let activeUser: UserWithRole;

  const makeUser = (overrides: Partial<UserWithRole> = {}): UserWithRole => ({
    id: 'user-1',
    maNV: 'NV0001',
    username: 'admin',
    password: bcrypt.hashSync('Admin@123', 4),
    hoTen: 'Quản trị viên',
    email: null,
    trangThai: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    roleId: 'role-1',
    role: {
      id: 'role-1',
      maRole: 'ADMIN',
      tenRole: 'Quản trị viên',
      moTa: null,
      trangThai: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    ...overrides,
  });

  beforeEach(() => {
    const fake = createFakePrisma();
    rows = fake.rows;
    users = mock<UsersService>();
    jwt = new JwtService();
    activeUser = makeUser();
    users.findByUsername.mockImplementation(async (username) =>
      username === activeUser.username ? activeUser : null,
    );
    users.findById.mockImplementation(async (id) =>
      id === activeUser.id ? activeUser : null,
    );
    service = new AuthService(users, fake.prisma, jwt, config);
  });

  describe('login', () => {
    it('trả access + refresh token và lưu hash của refresh token', async () => {
      const result = await service.login({
        username: 'admin',
        password: 'Admin@123',
      });

      expect(result.user).toEqual({
        id: 'user-1',
        maNV: 'NV0001',
        username: 'admin',
        hoTen: 'Quản trị viên',
        email: null,
        role: { maRole: 'ADMIN', tenRole: 'Quản trị viên' },
      });
      const payload = jwt.verify(result.accessToken, {
        secret: config.accessSecret,
      });
      expect(payload).toMatchObject({
        sub: 'user-1',
        maNV: 'NV0001',
        roleMa: 'ADMIN',
        roleTen: 'Quản trị viên',
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].tokenHash).toBe(hashToken(result.refreshToken));
      expect(rows[0].tokenHash).not.toBe(result.refreshToken);
    });

    it('từ chối khi sai mật khẩu', async () => {
      await expect(
        service.login({ username: 'admin', password: 'sai' }),
      ).rejects.toThrow(
        new UnauthorizedException('Sai tài khoản hoặc mật khẩu'),
      );
      expect(rows).toHaveLength(0);
    });

    it('từ chối khi username không tồn tại, cùng thông báo với sai mật khẩu', async () => {
      await expect(
        service.login({ username: 'khong-co', password: 'Admin@123' }),
      ).rejects.toThrow(
        new UnauthorizedException('Sai tài khoản hoặc mật khẩu'),
      );
    });

    it('từ chối tài khoản đã bị khóa', async () => {
      activeUser = makeUser({ trangThai: false });
      await expect(
        service.login({ username: 'admin', password: 'Admin@123' }),
      ).rejects.toThrow(new UnauthorizedException('Tài khoản đã bị khóa'));
      expect(rows).toHaveLength(0);
    });

    it('coi role bị vô hiệu hóa như không có role', async () => {
      activeUser = makeUser();
      activeUser.role!.trangThai = false;
      const result = await service.login({
        username: 'admin',
        password: 'Admin@123',
      });
      expect(result.user.role).toBeNull();
    });
  });

  describe('refresh', () => {
    const loginAdmin = () =>
      service.login({ username: 'admin', password: 'Admin@123' });

    it('cấp token mới và thu hồi refresh token cũ', async () => {
      const first = await loginAdmin();
      const next = await service.refresh({ refreshToken: first.refreshToken });

      expect(next.refreshToken).not.toBe(first.refreshToken);
      jwt.verify(next.accessToken, { secret: config.accessSecret });
      expect(rows).toHaveLength(2);
      expect(rows[0].revokedAt).toBeInstanceOf(Date);
      expect(rows[1].revokedAt).toBeNull();
      expect(rows[1].tokenHash).toBe(hashToken(next.refreshToken));
    });

    it('từ chối token đã thu hồi và thu hồi toàn bộ token của user', async () => {
      const first = await loginAdmin();
      const next = await service.refresh({ refreshToken: first.refreshToken });

      await expect(
        service.refresh({ refreshToken: first.refreshToken }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      // The new token is revoked too because the old one was reused.
      await expect(
        service.refresh({ refreshToken: next.refreshToken }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(rows.every((row) => row.revokedAt)).toBe(true);
    });

    it('từ chối refresh JWT đã hết hạn', async () => {
      const expired = await jwt.signAsync(
        { sub: 'user-1', jti: 'x' },
        { secret: config.refreshSecret, expiresIn: -10 },
      );
      await expect(
        service.refresh({ refreshToken: expired }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('từ chối khi expiresAt trong DB đã qua', async () => {
      const first = await loginAdmin();
      rows[0].expiresAt = new Date(Date.now() - 1000);
      await expect(
        service.refresh({ refreshToken: first.refreshToken }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('từ chối token sai chữ ký', async () => {
      const forged = await jwt.signAsync(
        { sub: 'user-1', jti: 'x' },
        { secret: 'another-secret-0123456789abcdef0123' },
      );
      await expect(
        service.refresh({ refreshToken: forged }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('từ chối token hợp lệ nhưng không có trong DB', async () => {
      const unknown = await jwt.signAsync(
        { sub: 'user-1', jti: 'x' },
        { secret: config.refreshSecret },
      );
      await expect(
        service.refresh({ refreshToken: unknown }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('từ chối khi user đã bị khóa sau khi đăng nhập', async () => {
      const first = await loginAdmin();
      activeUser = { ...activeUser, trangThai: false };
      await expect(
        service.refresh({ refreshToken: first.refreshToken }),
      ).rejects.toThrow(new UnauthorizedException('Tài khoản đã bị khóa'));
    });
  });

  describe('logout', () => {
    it('thu hồi refresh token, sau đó không refresh được nữa', async () => {
      const first = await service.login({
        username: 'admin',
        password: 'Admin@123',
      });
      await service.logout({ refreshToken: first.refreshToken });

      expect(rows[0].revokedAt).toBeInstanceOf(Date);
      await expect(
        service.refresh({ refreshToken: first.refreshToken }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('không lỗi khi token không tồn tại', async () => {
      await expect(
        service.logout({ refreshToken: 'khong-ton-tai' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('validateUser', () => {
    it('trả AuthenticatedUser cho user đang hoạt động', async () => {
      await expect(service.validateUser('user-1')).resolves.toMatchObject({
        id: 'user-1',
        role: { maRole: 'ADMIN' },
      });
    });

    it('từ chối user không tồn tại', async () => {
      await expect(service.validateUser('nope')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('từ chối user đã bị khóa', async () => {
      activeUser = { ...activeUser, trangThai: false };
      await expect(service.validateUser('user-1')).rejects.toThrow(
        new UnauthorizedException('Tài khoản đã bị khóa'),
      );
    });
  });
});
