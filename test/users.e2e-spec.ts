import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers/create-app.js';
import {
  migrateTestDatabase,
  resetAndSeed,
  TEST_PASSWORD,
  type SeededRoles,
} from './helpers/test-db.js';

interface UserBody {
  id: string;
  maNV: string;
  username: string;
  hoTen: string;
  email: string | null;
  trangThai: boolean;
  role: { maRole: string } | null;
}
interface ErrorBody {
  code: string;
  message: string;
  details: unknown;
}
interface Login {
  accessToken: string;
  refreshToken: string;
}

const NEW_PASSWORD = 'MoiMoi@12345';

describe('Users (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let roleIds: SeededRoles;
  const tokens: Record<string, string> = {};
  const http = () => request(app.getHttpServer());
  const bearer = (user: string) => ({
    Authorization: `Bearer ${tokens[user]}`,
  });

  // Resolve first, build the request afterwards (supertest closes the shared server
  // when a request finishes).
  const login = async (
    username: string,
    password = TEST_PASSWORD,
  ): Promise<Login> => {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ username, password })
      .expect(200);
    return res.body as Login;
  };
  const createUser = async (
    over: Partial<{
      username: string;
      email: string;
      roleId: string;
      password: string;
    }> = {},
  ): Promise<UserBody> => {
    const res = await http()
      .post('/api/v1/users')
      .set(bearer('admin'))
      .send({
        username: 'nv.moi',
        password: TEST_PASSWORD,
        hoTen: 'Nhân viên mới',
        roleId: roleIds.NHAN_VIEN_KHO,
        ...over,
      })
      .expect(201);
    return res.body as UserBody;
  };

  beforeAll(async () => {
    migrateTestDatabase();
    app = await createTestApp();
    prisma = app.get(PrismaService);
    roleIds = await resetAndSeed(prisma);
    for (const username of ['admin', 'quanly', 'kho', 'ketoan']) {
      tokens[username] = (await login(username)).accessToken;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('tạo và tra cứu', () => {
    it('admin tạo user → 201, maNV tiếp theo, chuẩn hóa dữ liệu, không lộ password; user mới đăng nhập được', async () => {
      const user = await createUser({
        username: 'NV.Moi',
        email: 'Moi@Example.com',
      });
      expect(user).toMatchObject({
        maNV: 'NV0007',
        username: 'nv.moi',
        email: 'moi@example.com',
        trangThai: true,
        role: { maRole: 'NHAN_VIEN_KHO' },
      });
      expect(JSON.stringify(user)).not.toContain('password');

      const session = await login('nv.moi');
      expect(session.accessToken).toEqual(expect.any(String));

      const log = await prisma.nhatKyHeThong.findFirstOrThrow({
        where: { hanhDong: 'user.create', doiTuongId: user.id },
      });
      expect(JSON.stringify(log)).not.toMatch(/password|\$2[aby]\$/);
    });

    it('mã nhân viên tăng dần, không trùng', async () => {
      const second = await createUser({ username: 'nv.hai' });
      expect(second.maNV).toBe('NV0008');
    });

    it('username trùng (khác hoa/thường) → 409; email trùng → 409', async () => {
      const dupUser = await http()
        .post('/api/v1/users')
        .set(bearer('admin'))
        .send({
          username: 'ADMIN',
          password: TEST_PASSWORD,
          hoTen: 'X',
          roleId: roleIds.KE_TOAN,
        })
        .expect(409);
      expect((dupUser.body as ErrorBody).code).toBe('USER_USERNAME_TAKEN');

      const dupEmail = await http()
        .post('/api/v1/users')
        .set(bearer('admin'))
        .send({
          username: 'khac',
          email: 'moi@example.com',
          password: TEST_PASSWORD,
          hoTen: 'X',
          roleId: roleIds.KE_TOAN,
        })
        .expect(409);
      expect((dupEmail.body as ErrorBody).code).toBe('USER_EMAIL_TAKEN');
    });

    it('mật khẩu yếu / username sai định dạng / thiếu role → 400 VALIDATION_FAILED có details', async () => {
      const res = await http()
        .post('/api/v1/users')
        .set(bearer('admin'))
        .send({ username: 'A B', password: 'yeu', hoTen: '' })
        .expect(400);
      const body = res.body as ErrorBody;
      expect(body.code).toBe('VALIDATION_FAILED');
      expect(body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'username' }),
          expect.objectContaining({ field: 'password' }),
          expect.objectContaining({ field: 'hoTen' }),
          expect.objectContaining({ field: 'roleId' }),
        ]),
      );
    });

    it('role bị vô hiệu hóa hoặc không tồn tại → 422 USER_ROLE_INVALID', async () => {
      await prisma.role.update({
        where: { id: roleIds.KE_TOAN },
        data: { trangThai: false },
      });
      await prisma.user.update({
        where: { username: 'ketoan' },
        data: { trangThai: false },
      });
      const off = await http()
        .post('/api/v1/users')
        .set(bearer('admin'))
        .send({
          username: 'ke.toan2',
          password: TEST_PASSWORD,
          hoTen: 'X',
          roleId: roleIds.KE_TOAN,
        })
        .expect(422);
      expect((off.body as ErrorBody).code).toBe('USER_ROLE_INVALID');
      await prisma.role.update({
        where: { id: roleIds.KE_TOAN },
        data: { trangThai: true },
      });
      await prisma.user.update({
        where: { username: 'ketoan' },
        data: { trangThai: true },
      });

      const missing = await http()
        .post('/api/v1/users')
        .set(bearer('admin'))
        .send({
          username: 'khong.role',
          password: TEST_PASSWORD,
          hoTen: 'X',
          roleId: '7d3c9a84-1d3e-4c8d-9b5a-0c2f1e6a9b11',
        })
        .expect(422);
      expect((missing.body as ErrorBody).code).toBe('USER_ROLE_INVALID');
    });

    it('danh sách: admin và quản lý xem được, lọc q / roleId / trangThai, phân trang, không lộ password', async () => {
      const all = await http()
        .get('/api/v1/users?pageSize=3')
        .set(bearer('quanly'))
        .expect(200);
      expect(all.body).toMatchObject({ meta: { page: 1, pageSize: 3 } });
      expect((all.body as { items: unknown[] }).items).toHaveLength(3);
      expect(JSON.stringify(all.body)).not.toContain('password');

      const q = await http()
        .get('/api/v1/users?q=nv.moi')
        .set(bearer('admin'))
        .expect(200);
      expect(
        (q.body as { items: UserBody[] }).items.map((u) => u.username),
      ).toEqual(['nv.moi']);

      const locked = await http()
        .get('/api/v1/users?trangThai=false')
        .set(bearer('admin'))
        .expect(200);
      expect(
        (locked.body as { items: UserBody[] }).items.map((u) => u.username),
      ).toEqual(['locked']);

      const byRole = await http()
        .get(`/api/v1/users?roleId=${roleIds.QUAN_LY_KHO}`)
        .set(bearer('admin'))
        .expect(200);
      expect(
        (byRole.body as { items: UserBody[] }).items.map((u) => u.username),
      ).toEqual(['quanly']);

      await http()
        .get('/api/v1/users?sort=password:asc')
        .set(bearer('admin'))
        .expect(400);
    });

    it('chi tiết: đúng user; sai UUID 400; không tồn tại 404', async () => {
      const list = await http()
        .get('/api/v1/users?q=kho')
        .set(bearer('admin'))
        .expect(200);
      const id = (list.body as { items: UserBody[] }).items.find(
        (u) => u.username === 'kho',
      )!.id;
      const ok = await http()
        .get(`/api/v1/users/${id}`)
        .set(bearer('admin'))
        .expect(200);
      expect(ok.body).toMatchObject({ username: 'kho', maNV: 'NV0002' });

      await http().get('/api/v1/users/abc').set(bearer('admin')).expect(400);
      const missing = await http()
        .get('/api/v1/users/7d3c9a84-1d3e-4c8d-9b5a-0c2f1e6a9b11')
        .set(bearer('admin'))
        .expect(404);
      expect((missing.body as ErrorBody).code).toBe('USER_NOT_FOUND');
    });
  });

  describe('phân quyền', () => {
    it('NHAN_VIEN_KHO và KE_TOAN không xem được danh sách; QUAN_LY_KHO xem được nhưng không tạo/sửa', async () => {
      await http().get('/api/v1/users').expect(401);
      await http().get('/api/v1/users').set(bearer('kho')).expect(403);
      await http().get('/api/v1/users').set(bearer('ketoan')).expect(403);
      await http().get('/api/v1/users').set(bearer('quanly')).expect(200);

      const body = {
        username: 'x.y.z',
        password: TEST_PASSWORD,
        hoTen: 'X',
        roleId: roleIds.KE_TOAN,
      };
      for (const user of ['quanly', 'kho', 'ketoan']) {
        await http()
          .post('/api/v1/users')
          .set(bearer(user))
          .send(body)
          .expect(403);
      }
      const target = await prisma.user.findUniqueOrThrow({
        where: { username: 'kho' },
      });
      await http()
        .patch(`/api/v1/users/${target.id}`)
        .set(bearer('quanly'))
        .send({ hoTen: 'Hack' })
        .expect(403);
      await http()
        .post(`/api/v1/users/${target.id}/dat-lai-mat-khau`)
        .set(bearer('quanly'))
        .send({ newPassword: NEW_PASSWORD })
        .expect(403);
    });

    it('mọi role sửa được hồ sơ của chính mình', async () => {
      for (const user of ['admin', 'quanly', 'kho', 'ketoan']) {
        const res = await http()
          .patch('/api/v1/users/me')
          .set(bearer(user))
          .send({ hoTen: `Tên của ${user}` });
        expect({ user, status: res.status, body: res.body }).toMatchObject({
          user,
          status: 200,
        });
      }
    });
  });

  describe('khóa / đổi vai trò', () => {
    it('khóa user: access token đang dùng bị từ chối ngay, refresh token bị thu hồi, mở khóa đăng nhập lại được', async () => {
      const target = await createUser({ username: 'se.khoa' });
      const session = await login('se.khoa');

      await http()
        .patch(`/api/v1/users/${target.id}`)
        .set(bearer('admin'))
        .send({ trangThai: false })
        .expect(200);

      const me = await http()
        .get('/api/v1/auth/me')
        .set({ Authorization: `Bearer ${session.accessToken}` })
        .expect(401);
      expect((me.body as ErrorBody).code).toBe('AUTH_ACCOUNT_LOCKED');

      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(401);
      const denied = await http()
        .post('/api/v1/auth/login')
        .send({ username: 'se.khoa', password: TEST_PASSWORD })
        .expect(401);
      expect((denied.body as ErrorBody).code).toBe('AUTH_ACCOUNT_LOCKED');

      await http()
        .patch(`/api/v1/users/${target.id}`)
        .set(bearer('admin'))
        .send({ trangThai: true })
        .expect(200);
      await login('se.khoa');

      const actions = (
        await prisma.nhatKyHeThong.findMany({
          where: { doiTuongId: target.id },
          orderBy: { createdAt: 'asc' },
        })
      ).map((l) => l.hanhDong);
      expect(actions).toEqual(['user.create', 'user.lock', 'user.unlock']);
    });

    it('đổi vai trò: quyền đổi ngay và refresh token cũ bị thu hồi', async () => {
      const target = await createUser({ username: 'se.doi.role' });
      const session = await login('se.doi.role');
      await http()
        .get('/api/v1/users')
        .set({ Authorization: `Bearer ${session.accessToken}` })
        .expect(403);

      await http()
        .patch(`/api/v1/users/${target.id}`)
        .set(bearer('admin'))
        .send({ roleId: roleIds.QUAN_LY_KHO })
        .expect(200);

      await http()
        .get('/api/v1/users')
        .set({ Authorization: `Bearer ${session.accessToken}` })
        .expect(200);
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(401);

      const log = await prisma.nhatKyHeThong.findFirstOrThrow({
        where: { hanhDong: 'user.role_change', doiTuongId: target.id },
      });
      expect(log.truoc).toEqual({ roleMa: 'NHAN_VIEN_KHO' });
      expect(log.sau).toEqual({ roleMa: 'QUAN_LY_KHO' });
    });

    it('admin không tự đổi role / tự khóa chính mình', async () => {
      const self = await prisma.user.findUniqueOrThrow({
        where: { username: 'admin' },
      });
      for (const body of [
        { roleId: roleIds.NHAN_VIEN_KHO },
        { trangThai: false },
      ]) {
        const res = await http()
          .patch(`/api/v1/users/${self.id}`)
          .set(bearer('admin'))
          .send(body)
          .expect(409);
        expect((res.body as ErrorBody).code).toBe('USER_CANNOT_MODIFY_SELF');
      }
      await http()
        .patch(`/api/v1/users/${self.id}`)
        .set(bearer('admin'))
        .send({ hoTen: 'Sếp lớn' })
        .expect(200);
    });

    it('email trùng khi sửa → 409; gửi password/username/maNV → 400', async () => {
      const target = await createUser({
        username: 'sua.email',
        email: 'sua@example.com',
      });
      const dup = await http()
        .patch(`/api/v1/users/${target.id}`)
        .set(bearer('admin'))
        .send({ email: 'moi@example.com' })
        .expect(409);
      expect((dup.body as ErrorBody).code).toBe('USER_EMAIL_TAKEN');
      await http()
        .patch(`/api/v1/users/${target.id}`)
        .set(bearer('admin'))
        .send({ password: 'Abc@12345' })
        .expect(400);
      await http()
        .patch(`/api/v1/users/${target.id}`)
        .set(bearer('admin'))
        .send({ username: 'doi.ten' })
        .expect(400);
    });

    it('hai admin cùng hạ quyền nhau đồng thời (chỉ còn hai admin) → đúng một thành công, người kia USER_LAST_ADMIN', async () => {
      const a = await createUser({
        username: 'admin.a',
        roleId: roleIds.ADMIN,
      });
      const b = await createUser({
        username: 'admin.b',
        roleId: roleIds.ADMIN,
      });
      const tokenA = (await login('admin.a')).accessToken;
      const tokenB = (await login('admin.b')).accessToken;
      // Leave exactly two active admins (restored in `finally` even if an assertion fails).
      await prisma.user.update({
        where: { username: 'admin' },
        data: { trangThai: false },
      });
      try {
        const [fromA, fromB] = await Promise.all([
          http()
            .patch(`/api/v1/users/${b.id}`)
            .set({ Authorization: `Bearer ${tokenA}` })
            .send({ roleId: roleIds.NHAN_VIEN_KHO }),
          http()
            .patch(`/api/v1/users/${a.id}`)
            .set({ Authorization: `Bearer ${tokenB}` })
            .send({ roleId: roleIds.NHAN_VIEN_KHO }),
        ]);
        expect([fromA.status, fromB.status].sort((x, y) => x - y)).toEqual([
          200, 409,
        ]);
        const failed = fromA.status === 409 ? fromA : fromB;
        expect((failed.body as ErrorBody).code).toBe('USER_LAST_ADMIN');

        const activeAdmins = await prisma.user.count({
          where: { trangThai: true, role: { maRole: 'ADMIN' } },
        });
        expect(activeAdmins).toBe(1);
      } finally {
        await prisma.user.update({
          where: { username: 'admin' },
          data: { trangThai: true },
        });
      }
    });
  });

  describe('mật khẩu', () => {
    it('admin đặt lại mật khẩu: mật khẩu cũ hết hiệu lực, mới dùng được, refresh token cũ bị thu hồi, có nhật ký', async () => {
      const target = await createUser({ username: 'quen.mk' });
      const session = await login('quen.mk');

      await http()
        .post(`/api/v1/users/${target.id}/dat-lai-mat-khau`)
        .set(bearer('admin'))
        .send({ newPassword: NEW_PASSWORD })
        .expect(204);

      await http()
        .post('/api/v1/auth/login')
        .send({ username: 'quen.mk', password: TEST_PASSWORD })
        .expect(401);
      await login('quen.mk', NEW_PASSWORD);
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(401);

      const log = await prisma.nhatKyHeThong.findFirstOrThrow({
        where: { hanhDong: 'user.password_reset', doiTuongId: target.id },
      });
      expect(JSON.stringify(log)).not.toContain(NEW_PASSWORD);
    });

    it('đặt lại mật khẩu yếu → 400; user không tồn tại → 404', async () => {
      const target = await prisma.user.findUniqueOrThrow({
        where: { username: 'quen.mk' },
      });
      await http()
        .post(`/api/v1/users/${target.id}/dat-lai-mat-khau`)
        .set(bearer('admin'))
        .send({ newPassword: 'yeu' })
        .expect(400);
      await http()
        .post(
          '/api/v1/users/7d3c9a84-1d3e-4c8d-9b5a-0c2f1e6a9b11/dat-lai-mat-khau',
        )
        .set(bearer('admin'))
        .send({ newPassword: NEW_PASSWORD })
        .expect(404);
    });

    it('tự đổi mật khẩu: sai mật khẩu cũ 422, trùng mật khẩu cũ 400, đúng 204 và phải đăng nhập lại', async () => {
      await createUser({ username: 'doi.mk' });
      const session = await login('doi.mk');
      const auth = { Authorization: `Bearer ${session.accessToken}` };

      const wrong = await http()
        .post('/api/v1/users/me/doi-mat-khau')
        .set(auth)
        .send({ oldPassword: 'Sai@123456', newPassword: NEW_PASSWORD })
        .expect(422);
      expect((wrong.body as ErrorBody).code).toBe('USER_OLD_PASSWORD_WRONG');

      await http()
        .post('/api/v1/users/me/doi-mat-khau')
        .set(auth)
        .send({ oldPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD })
        .expect(400);

      await http()
        .post('/api/v1/users/me/doi-mat-khau')
        .set(auth)
        .send({ oldPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD })
        .expect(204);

      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(401);
      await http()
        .post('/api/v1/auth/login')
        .send({ username: 'doi.mk', password: TEST_PASSWORD })
        .expect(401);
      await login('doi.mk', NEW_PASSWORD);
    });
  });

  describe('hồ sơ cá nhân', () => {
    it('đổi hoTen/email của mình; email trùng người khác 409; gửi roleId 400', async () => {
      const ok = await http()
        .patch('/api/v1/users/me')
        .set(bearer('kho'))
        .send({ hoTen: '  Kho Mới ', email: 'KHO@Example.com' })
        .expect(200);
      expect(ok.body).toMatchObject({
        hoTen: 'Kho Mới',
        email: 'kho@example.com',
        username: 'kho',
      });

      const dup = await http()
        .patch('/api/v1/users/me')
        .set(bearer('kho'))
        .send({ email: 'moi@example.com' })
        .expect(409);
      expect((dup.body as ErrorBody).code).toBe('USER_EMAIL_TAKEN');

      await http()
        .patch('/api/v1/users/me')
        .set(bearer('kho'))
        .send({ roleId: roleIds.ADMIN })
        .expect(400);
      await http().patch('/api/v1/users/me').send({ hoTen: 'A' }).expect(401);
    });
  });
});
