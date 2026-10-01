import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ProtectedRouteController } from './fixtures/protected-route.controller.js';
import {
  migrateTestDatabase,
  resetAndSeed,
  TEST_PASSWORD,
} from './helpers/test-db.js';

interface LoginBody {
  accessToken: string;
  refreshToken: string;
  user: Record<string, unknown>;
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const http = () => request(app.getHttpServer());
  const login = (username: string, password = TEST_PASSWORD) =>
    http().post('/auth/login').send({ username, password });
  const loginOk = async (username: string): Promise<LoginBody> => {
    const res = await login(username).expect(200);
    return res.body as LoginBody;
  };

  beforeAll(async () => {
    migrateTestDatabase();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProtectedRouteController],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    await resetAndSeed(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/login', () => {
    it('đăng nhập thành công trả token và thông tin user', async () => {
      const res = await login('admin').expect(200);
      const body = res.body as LoginBody;

      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.refreshToken).toEqual(expect.any(String));
      expect(body.user).toEqual({
        id: expect.any(String),
        maNV: 'NV0001',
        username: 'admin',
        hoTen: 'Quản trị viên',
        email: null,
        role: { maRole: 'ADMIN', tenRole: 'Quản trị viên' },
      });
      expect(body.user).not.toHaveProperty('password');
    });

    it('sai mật khẩu trả 401 kèm thông báo tiếng Việt', async () => {
      const res = await login('admin', 'sai-mat-khau').expect(401);
      expect((res.body as { message: string }).message).toBe(
        'Sai tài khoản hoặc mật khẩu',
      );
    });

    it('tài khoản bị khóa trả 401', async () => {
      const res = await login('locked').expect(401);
      expect((res.body as { message: string }).message).toBe(
        'Tài khoản đã bị khóa',
      );
    });

    it('body thiếu trường hoặc thừa trường trả 400', async () => {
      await http().post('/auth/login').send({ username: 'admin' }).expect(400);
      await http()
        .post('/auth/login')
        .send({ username: 'admin', password: TEST_PASSWORD, extra: 1 })
        .expect(400);
    });
  });

  describe('GET /auth/me', () => {
    it('không có token trả 401', async () => {
      await http().get('/auth/me').expect(401);
    });

    it('có token trả 200 đúng shape', async () => {
      const { accessToken } = await loginOk('admin');
      const res = await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toEqual({
        id: expect.any(String),
        maNV: 'NV0001',
        username: 'admin',
        hoTen: 'Quản trị viên',
        email: null,
        role: { maRole: 'ADMIN', tenRole: 'Quản trị viên' },
      });
    });

    it('user bị khóa sau khi có access token thì bị từ chối ngay', async () => {
      const { accessToken } = await loginOk('tam');
      await prisma.user.update({
        where: { username: 'tam' },
        data: { trangThai: false },
      });

      const res = await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
      expect((res.body as { message: string }).message).toBe(
        'Tài khoản đã bị khóa',
      );

      await prisma.user.update({
        where: { username: 'tam' },
        data: { trangThai: true },
      });
    });
  });

  describe('@Roles', () => {
    it('admin truy cập route @Roles("ADMIN") được', async () => {
      const { accessToken } = await loginOk('admin');
      await http()
        .get('/test-protected/admin-only')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200, { ok: true });
    });

    it('user khác role nhận 403', async () => {
      const { accessToken } = await loginOk('kho');
      const res = await http()
        .get('/test-protected/admin-only')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
      expect((res.body as { message: string }).message).toBe(
        'Bạn không có quyền truy cập',
      );
    });

    it('không có token nhận 401 thay vì 403', async () => {
      await http().get('/test-protected/admin-only').expect(401);
    });
  });

  describe('refresh + logout', () => {
    it('refresh cấp access token mới và xoay refresh token', async () => {
      const first = await loginOk('admin');

      const res = await http()
        .post('/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(200);
      const next = res.body as { accessToken: string; refreshToken: string };
      expect(next.refreshToken).not.toBe(first.refreshToken);

      await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${next.accessToken}`)
        .expect(200);

      // The old refresh token was rotated, so it cannot be reused.
      await http()
        .post('/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(401);
    });

    it('sau logout refresh token cũ bị từ chối', async () => {
      const { refreshToken } = await loginOk('admin');

      await http().post('/auth/logout').send({ refreshToken }).expect(204);
      await http().post('/auth/refresh').send({ refreshToken }).expect(401);
    });

    it('refresh với token rác trả 401', async () => {
      await http()
        .post('/auth/refresh')
        .send({ refreshToken: 'khong-phai-jwt' })
        .expect(401);
    });
  });
});
