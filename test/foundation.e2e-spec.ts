import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AuditService } from '../src/audit/audit.service.js';
import { CODE } from '../src/common/code-generator/code-specs.js';
import { CodeGeneratorService } from '../src/common/code-generator/code-generator.service.js';
import { setupSwagger } from '../src/common/swagger/setup-swagger.js';
import { loadAppConfig } from '../src/config/app.config.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers/create-app.js';
import {
  migrateTestDatabase,
  resetAndSeed,
  TEST_PASSWORD,
} from './helpers/test-db.js';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details: unknown;
  path: string;
  timestamp: string;
  requestId: string | null;
}

describe('Nền tảng chung M0 (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  const tokenOf = async (username: string): Promise<string> => {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ username, password: TEST_PASSWORD })
      .expect(200);
    return (res.body as { accessToken: string }).accessToken;
  };

  beforeAll(async () => {
    migrateTestDatabase();
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetAndSeed(prisma);
    await prisma.nhatKyHeThong.deleteMany();
    await prisma.boDemMa.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('prefix và bảo mật header', () => {
    it('route cũ không prefix không còn tồn tại', async () => {
      // Outside the global prefix Nest does not handle the request, so Express
      // answers with its own 404 (no standard error body).
      await http().get('/auth/me').expect(404);
    });

    it('helmet bật: có X-Content-Type-Options, không lộ X-Powered-By', async () => {
      const res = await http().get('/api/v1/health/live').expect(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('body lỗi chuẩn và request id', () => {
    it('404 route lạ có đủ trường, path không kèm query', async () => {
      const res = await http().get('/api/v1/khong-co?a=1').expect(404);
      const body = res.body as ErrorBody;
      expect(body).toMatchObject({
        statusCode: 404,
        code: 'COMMON_NOT_FOUND',
        message: 'Không tìm thấy tài nguyên yêu cầu',
        details: null,
        path: '/api/v1/khong-co',
      });
      expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date');
    });

    it('requestId trong body trùng header x-request-id', async () => {
      const res = await http().get('/api/v1/khong-co').expect(404);
      const header = res.headers['x-request-id'];
      expect(header).toEqual(expect.any(String));
      expect((res.body as ErrorBody).requestId).toBe(header);
    });

    it('dùng lại x-request-id hợp lệ của client, bỏ qua giá trị không hợp lệ', async () => {
      const ok = await http()
        .get('/api/v1/khong-co')
        .set('x-request-id', 'client-abc-123')
        .expect(404);
      expect(ok.headers['x-request-id']).toBe('client-abc-123');

      const bad = await http()
        .get('/api/v1/khong-co')
        .set('x-request-id', 'co dau cach & ky tu la!')
        .expect(404);
      expect(bad.headers['x-request-id']).not.toBe('co dau cach & ky tu la!');
    });

    it('thiếu token → 401 AUTH_UNAUTHORIZED', async () => {
      const res = await http().get('/api/v1/auth/me').expect(401);
      expect((res.body as ErrorBody).code).toBe('AUTH_UNAUTHORIZED');
    });

    it('token rác → 401 AUTH_SESSION_INVALID', async () => {
      const res = await http()
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer khong-phai-jwt')
        .expect(401);
      expect((res.body as ErrorBody).code).toBe('AUTH_SESSION_INVALID');
    });

    it('validation: details liệt kê field và message', async () => {
      const res = await http()
        .post('/api/v1/auth/login')
        .send({ username: 'admin', extra: 1 })
        .expect(400);
      const body = res.body as ErrorBody;
      expect(body.code).toBe('VALIDATION_FAILED');
      expect(body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'password' }),
          expect.objectContaining({ field: 'extra' }),
        ]),
      );
    });

    it('JSON hỏng → 400 VALIDATION_FAILED', async () => {
      const res = await http()
        .post('/api/v1/auth/login')
        .set('content-type', 'application/json')
        .send('{"username": ')
        .expect(400);
      expect((res.body as ErrorBody).code).toBe('VALIDATION_FAILED');
    });
  });

  describe('health', () => {
    it('GET /health công khai, DB và bộ nhớ up, không lộ chuỗi kết nối', async () => {
      const res = await http().get('/api/v1/health').expect(200);
      expect(res.body).toMatchObject({
        status: 'ok',
        info: { database: { status: 'up' }, memory_heap: { status: 'up' } },
        uptime: expect.any(Number),
      });
      expect(JSON.stringify(res.body)).not.toMatch(/mysql:|password|root/i);
    });

    it('GET /health/live công khai', async () => {
      await http().get('/api/v1/health/live').expect(200, { status: 'ok' });
    });
  });

  describe('nhật ký thao tác (/audit)', () => {
    it('chỉ ADMIN xem được', async () => {
      // Resolve tokens first: supertest closes the shared server when a request
      // finishes, so a request must not be built before awaiting another one.
      const kho = await tokenOf('kho');
      const admin = await tokenOf('admin');

      await http().get('/api/v1/audit').expect(401);
      await http()
        .get('/api/v1/audit')
        .set('Authorization', `Bearer ${kho}`)
        .expect(403);
      await http()
        .get('/api/v1/audit')
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
    });

    it('ghi qua AuditService rồi lọc, phân trang, sắp xếp được', async () => {
      const audit = app.get(AuditService);
      await audit.record({
        hanhDong: 'test.one',
        doiTuong: 'demo',
        doiTuongId: 'd1',
        sau: { a: 1 },
      });
      await audit.record({ hanhDong: 'test.two', doiTuong: 'demo' });
      const token = await tokenOf('admin');
      const auth = { Authorization: `Bearer ${token}` };

      const all = await http()
        .get('/api/v1/audit?doiTuong=demo&pageSize=1')
        .set(auth)
        .expect(200);
      expect(all.body).toMatchObject({
        items: [expect.objectContaining({ doiTuong: 'demo' })],
        meta: { page: 1, pageSize: 1, total: 2, totalPages: 2 },
      });

      const one = await http()
        .get('/api/v1/audit?hanhDong=test.one')
        .set(auth)
        .expect(200);
      expect((one.body as { items: unknown[] }).items).toHaveLength(1);
      expect(one.body).toMatchObject({
        items: [{ doiTuongId: 'd1', sau: { a: 1 }, user: null }],
      });

      await http().get('/api/v1/audit?pageSize=101').set(auth).expect(400);
      await http().get('/api/v1/audit?sort=password:asc').set(auth).expect(400);
      await http()
        .get('/api/v1/audit?createdAtFrom=2026-10-02&createdAtTo=2026-10-01')
        .set(auth)
        .expect(400);
    });
  });

  describe('sinh mã chứng từ', () => {
    it('không trùng khi 20 yêu cầu chạy đồng thời (mỗi yêu cầu một transaction)', async () => {
      const generator = app.get(CodeGeneratorService);
      const codes = await Promise.all(
        Array.from({ length: 20 }, () =>
          prisma.$transaction((tx) => generator.next(CODE.PHIEU_NHAP, tx)),
        ),
      );
      expect(new Set(codes).size).toBe(20);
      const sequences = codes
        .map((code) => Number(code.slice(-4)))
        .sort((a, b) => a - b);
      expect(sequences).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    });

    it('rollback của nơi gọi trả lại số (không để lỗ hổng) khi dùng chung transaction', async () => {
      const generator = app.get(CodeGeneratorService);
      const before = await prisma.boDemMa.findFirstOrThrow({
        where: { tienTo: 'PN' },
      });
      await expect(
        prisma.$transaction(async (tx) => {
          await generator.next(CODE.PHIEU_NHAP, tx);
          throw new Error('rollback');
        }),
      ).rejects.toThrow('rollback');
      const after = await prisma.boDemMa.findFirstOrThrow({
        where: { tienTo: 'PN' },
      });
      expect(after.giaTri).toBe(before.giaTri);
    });
  });

  describe('Swagger', () => {
    it('bật ở môi trường test: UI và JSON truy cập được', async () => {
      const dev = await createTestApp();
      setupSwagger(dev, loadAppConfig({ NODE_ENV: 'test' }));
      await dev.init();
      const json = await request(dev.getHttpServer())
        .get('/api/docs-json')
        .expect(200);
      const doc = json.body as {
        openapi: string;
        paths: Record<string, unknown>;
      };
      expect(doc.openapi).toMatch(/^3\./);
      expect(Object.keys(doc.paths)).toEqual(
        expect.arrayContaining([
          '/api/v1/auth/login',
          '/api/v1/health',
          '/api/v1/audit',
        ]),
      );
      await dev.close();
    });

    it('tắt: /api/docs không tồn tại', async () => {
      const off = await createTestApp();
      setupSwagger(
        off,
        loadAppConfig({ NODE_ENV: 'test', SWAGGER_ENABLED: 'false' }),
      );
      await off.init();
      await request(off.getHttpServer()).get('/api/docs-json').expect(404);
      await off.close();
    });

    it('bật kèm basic-auth: thiếu thông tin → 401, đúng → 200', async () => {
      const guarded = await createTestApp();
      setupSwagger(
        guarded,
        loadAppConfig({
          NODE_ENV: 'test',
          SWAGGER_ENABLED: 'true',
          SWAGGER_USER: 'docs',
          SWAGGER_PASSWORD: 's3cret',
        }),
      );
      await guarded.init();
      const server = guarded.getHttpServer();
      await request(server).get('/api/docs-json').expect(401);
      await request(server)
        .get('/api/docs-json')
        .auth('docs', 'sai')
        .expect(401);
      await request(server)
        .get('/api/docs-json')
        .auth('docs', 's3cret')
        .expect(200);
      await guarded.close();
    });
  });
});
