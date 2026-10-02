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

interface RoleBody {
  id: string;
  maRole: string;
  tenRole: string;
  moTa: string | null;
  trangThai: boolean;
  soNguoiDung: number;
}
interface ErrorBody {
  code: string;
  message: string;
}

describe('Roles (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let roleIds: SeededRoles;
  const tokens: Record<string, string> = {};
  const http = () => request(app.getHttpServer());
  const bearer = (user: string) => ({
    Authorization: `Bearer ${tokens[user]}`,
  });

  beforeAll(async () => {
    migrateTestDatabase();
    app = await createTestApp();
    prisma = app.get(PrismaService);
    roleIds = await resetAndSeed(prisma);
    for (const username of ['admin', 'quanly', 'kho', 'ketoan']) {
      const res = await http()
        .post('/api/v1/auth/login')
        .send({ username, password: TEST_PASSWORD })
        .expect(200);
      tokens[username] = (res.body as { accessToken: string }).accessToken;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('admin xem danh sách 4 vai trò, soNguoiDung chỉ đếm người đang hoạt động', async () => {
    const res = await http()
      .get('/api/v1/roles')
      .set(bearer('admin'))
      .expect(200);
    const items = (res.body as { items: RoleBody[] }).items;
    const count = (maRole: string) =>
      items.find((r) => r.maRole === maRole)?.soNguoiDung;

    expect(items.map((r) => r.maRole)).toEqual([
      'ADMIN',
      'KE_TOAN',
      'NHAN_VIEN_KHO',
      'QUAN_LY_KHO',
    ]);
    expect(count('ADMIN')).toBe(1);
    expect(count('NHAN_VIEN_KHO')).toBe(2); // kho + tam; "locked" is inactive
    expect(count('QUAN_LY_KHO')).toBe(1);
    expect(count('KE_TOAN')).toBe(1);
    expect(res.body).toMatchObject({ meta: { total: 4, page: 1 } });
  });

  it('lọc theo trangThai và tìm theo q', async () => {
    const res = await http()
      .get('/api/v1/roles?q=KHO')
      .set(bearer('admin'))
      .expect(200);
    const makes = (res.body as { items: RoleBody[] }).items
      .map((r) => r.maRole)
      .sort();
    expect(makes).toEqual(['NHAN_VIEN_KHO', 'QUAN_LY_KHO']);

    const off = await http()
      .get('/api/v1/roles?trangThai=false')
      .set(bearer('admin'))
      .expect(200);
    expect((off.body as { items: unknown[] }).items).toHaveLength(0);
  });

  it('chỉ ADMIN truy cập được; role khác 403, không token 401', async () => {
    await http().get('/api/v1/roles').expect(401);
    for (const user of ['quanly', 'kho', 'ketoan']) {
      const res = await http()
        .get('/api/v1/roles')
        .set(bearer(user))
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('AUTH_FORBIDDEN');
    }
    await http()
      .patch(`/api/v1/roles/${roleIds.NHAN_VIEN_KHO}`)
      .set(bearer('quanly'))
      .send({ tenRole: 'X' })
      .expect(403);
  });

  it('GET :id đúng; id sai định dạng 400; id không tồn tại 404', async () => {
    const ok = await http()
      .get(`/api/v1/roles/${roleIds.KE_TOAN}`)
      .set(bearer('admin'))
      .expect(200);
    expect(ok.body).toMatchObject({ maRole: 'KE_TOAN', tenRole: 'Kế toán' });

    const bad = await http()
      .get('/api/v1/roles/khong-phai-uuid')
      .set(bearer('admin'))
      .expect(400);
    expect((bad.body as ErrorBody).code).toBe('COMMON_INVALID_ID');

    const missing = await http()
      .get('/api/v1/roles/7d3c9a84-1d3e-4c8d-9b5a-0c2f1e6a9b11')
      .set(bearer('admin'))
      .expect(404);
    expect((missing.body as ErrorBody).code).toBe('ROLE_NOT_FOUND');
  });

  it('đổi tên/mô tả → 200, đọc lại thấy giá trị mới, nhật ký role.update có trước/sau', async () => {
    const id = roleIds.KE_TOAN;
    await http()
      .patch(`/api/v1/roles/${id}`)
      .set(bearer('admin'))
      .send({ tenRole: '  Kế toán trưởng ', moTa: 'Phụ trách công nợ' })
      .expect(200);

    const res = await http()
      .get(`/api/v1/roles/${id}`)
      .set(bearer('admin'))
      .expect(200);
    expect(res.body).toMatchObject({
      tenRole: 'Kế toán trưởng',
      moTa: 'Phụ trách công nợ',
    });

    const log = await prisma.nhatKyHeThong.findFirstOrThrow({
      where: { hanhDong: 'role.update', doiTuongId: id },
    });
    expect(log.truoc).toMatchObject({ tenRole: 'Kế toán' });
    expect(log.sau).toMatchObject({ tenRole: 'Kế toán trưởng' });
    expect(log.userId).not.toBeNull();
  });

  it('không cho sửa maRole; body rỗng 400', async () => {
    const id = roleIds.QUAN_LY_KHO;
    await http()
      .patch(`/api/v1/roles/${id}`)
      .set(bearer('admin'))
      .send({ maRole: 'KHAC' })
      .expect(400);
    const empty = await http()
      .patch(`/api/v1/roles/${id}`)
      .set(bearer('admin'))
      .send({})
      .expect(400);
    expect((empty.body as ErrorBody).code).toBe('VALIDATION_FAILED');
  });

  it('tắt vai trò ADMIN → 409 ROLE_SYSTEM_PROTECTED', async () => {
    const res = await http()
      .patch(`/api/v1/roles/${roleIds.ADMIN}`)
      .set(bearer('admin'))
      .send({ trangThai: false })
      .expect(409);
    expect((res.body as ErrorBody).code).toBe('ROLE_SYSTEM_PROTECTED');
  });

  it('tắt vai trò còn người dùng hoạt động → 409 ROLE_HAS_ACTIVE_USERS', async () => {
    const res = await http()
      .patch(`/api/v1/roles/${roleIds.NHAN_VIEN_KHO}`)
      .set(bearer('admin'))
      .send({ trangThai: false })
      .expect(409);
    expect(res.body).toMatchObject({
      code: 'ROLE_HAS_ACTIVE_USERS',
      details: { soNguoiDung: 2 },
    });
  });

  it('khi hết người dùng hoạt động thì tắt được; user thuộc vai trò đó đăng nhập được nhưng role=null và bị 403 ở route cần role', async () => {
    await prisma.user.update({
      where: { username: 'ketoan' },
      data: { trangThai: false },
    });
    await http()
      .patch(`/api/v1/roles/${roleIds.KE_TOAN}`)
      .set(bearer('admin'))
      .send({ trangThai: false })
      .expect(200);
    await prisma.user.update({
      where: { username: 'ketoan' },
      data: { trangThai: true },
    });

    const me = await http()
      .get('/api/v1/auth/me')
      .set(bearer('ketoan'))
      .expect(200);
    expect((me.body as { role: unknown }).role).toBeNull();
    await http().get('/api/v1/users').set(bearer('ketoan')).expect(403);

    await http()
      .patch(`/api/v1/roles/${roleIds.KE_TOAN}`)
      .set(bearer('admin'))
      .send({ trangThai: true })
      .expect(200);
    const back = await http()
      .get('/api/v1/auth/me')
      .set(bearer('ketoan'))
      .expect(200);
    expect((back.body as { role: { maRole: string } }).role.maRole).toBe(
      'KE_TOAN',
    );
  });
});
