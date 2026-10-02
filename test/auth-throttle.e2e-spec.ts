import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers/create-app.js';
import {
  migrateTestDatabase,
  resetAndSeed,
  TEST_PASSWORD,
} from './helpers/test-db.js';

describe('Giới hạn đăng nhập (e2e)', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    // Read when the app boots; vitest isolates env per test file.
    process.env.LOGIN_RATE_LIMIT = '3';
    migrateTestDatabase();
    app = await createTestApp();
    await resetAndSeed(app.get(PrismaService));
  });

  afterAll(async () => {
    await app.close();
  });

  it('quá số lần cho phép trong một phút → 429 COMMON_TOO_MANY_REQUESTS, kể cả khi đúng mật khẩu', async () => {
    for (let i = 0; i < 3; i++) {
      await http()
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password: 'sai' })
        .expect(401);
    }
    const blocked = await http()
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: TEST_PASSWORD })
      .expect(429);
    expect(blocked.body).toMatchObject({
      code: 'COMMON_TOO_MANY_REQUESTS',
      message: 'Bạn thao tác quá nhanh, vui lòng thử lại sau',
    });
  });

  it('các route khác không bị giới hạn', async () => {
    for (let i = 0; i < 8; i++) {
      await http().get('/api/v1/health/live').expect(200);
    }
    await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'x' })
      .expect(401);
  });
});
