import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { bearer, loginAll, type Tokens } from './helpers/catalog.js';
import { createTestApp } from './helpers/create-app.js';
import { migrateTestDatabase, resetAndSeed } from './helpers/test-db.js';

interface XeBody {
  id: string;
  bienSo: string;
  loaiPhuongTien: string | null;
  isXeLanh: boolean;
  trangThai: boolean;
}
interface ErrorBody {
  code: string;
}
interface Page<T> {
  items: T[];
}

describe('Phương tiện vận chuyển (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: Tokens;
  const http = () => request(app.getHttpServer());
  const as = (user: string) => bearer(tokens, user);
  const create = (body: Record<string, unknown>, user = 'kho') =>
    http().post('/api/v1/phuong-tien-van-chuyen').set(as(user)).send(body);

  beforeAll(async () => {
    migrateTestDatabase();
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetAndSeed(prisma);
    tokens = await loginAll(app, ['admin', 'quanly', 'kho', 'ketoan']);
  });

  afterAll(async () => {
    await app.close();
  });

  it('biển số được chuẩn hóa khi lưu; loại xe được cắt khoảng trắng; mặc định xe thường, đang dùng', async () => {
    const res = await create({
      bienSo: '51c-123.45',
      loaiPhuongTien: '  Xe tải 1.5 tấn ',
    }).expect(201);
    expect(res.body).toMatchObject({
      bienSo: '51C12345',
      loaiPhuongTien: 'Xe tải 1.5 tấn',
      isXeLanh: false,
      trangThai: true,
    });
  });

  it('cùng một biển viết khác đi vẫn bị coi là trùng → 409', async () => {
    for (const bienSo of ['51C12345', '51c 123.45', '51C-123.45']) {
      const res = await create({ bienSo }).expect(409);
      expect((res.body as ErrorBody).code).toBe('PHUONG_TIEN_PLATE_TAKEN');
    }
  });

  it.each(['', 'abc', '51C', '51C-12', 'XX-12345'])(
    'biển số sai %j → 400',
    async (bienSo) => {
      const res = await create({ bienSo }).expect(400);
      expect((res.body as ErrorBody).code).toBe('VALIDATION_FAILED');
    },
  );

  it('xe lạnh: tạo, lọc isXeLanh, bật/tắt cờ', async () => {
    const lanh = (
      await create({
        bienSo: '51D-999.99',
        loaiPhuongTien: 'Xe tải lạnh',
        isXeLanh: true,
      }).expect(201)
    ).body as XeBody;
    expect(lanh.isXeLanh).toBe(true);

    const cold = await http()
      .get('/api/v1/phuong-tien-van-chuyen?isXeLanh=true')
      .set(as('ketoan'))
      .expect(200);
    expect((cold.body as Page<XeBody>).items.map((x) => x.bienSo)).toEqual([
      '51D99999',
    ]);
    const normal = await http()
      .get('/api/v1/phuong-tien-van-chuyen?isXeLanh=false')
      .set(as('ketoan'))
      .expect(200);
    expect((normal.body as Page<XeBody>).items.map((x) => x.bienSo)).toEqual([
      '51C12345',
    ]);

    const off = await http()
      .patch(`/api/v1/phuong-tien-van-chuyen/${lanh.id}`)
      .set(as('quanly'))
      .send({ isXeLanh: false })
      .expect(200);
    expect((off.body as XeBody).isXeLanh).toBe(false);
  });

  it('sửa biển số: sang biển của xe khác → 409; giữ biển của mình (viết khác đi) → 200', async () => {
    const a = (await create({ bienSo: '29A-111.11' }).expect(201))
      .body as XeBody;
    await create({ bienSo: '29A-222.22' }).expect(201);
    const dup = await http()
      .patch(`/api/v1/phuong-tien-van-chuyen/${a.id}`)
      .set(as('kho'))
      .send({ bienSo: '29a22222' })
      .expect(409);
    expect((dup.body as ErrorBody).code).toBe('PHUONG_TIEN_PLATE_TAKEN');
    await http()
      .patch(`/api/v1/phuong-tien-van-chuyen/${a.id}`)
      .set(as('kho'))
      .send({ bienSo: '29a-111.11' })
      .expect(200);
  });

  it('ngừng sử dụng rồi dùng lại; tìm theo q; sort lạ → 400', async () => {
    const xe = (
      await create({
        bienSo: '30A-333.33',
        loaiPhuongTien: 'Xe bán tải',
      }).expect(201)
    ).body as XeBody;
    await http()
      .patch(`/api/v1/phuong-tien-van-chuyen/${xe.id}`)
      .set(as('quanly'))
      .send({ trangThai: false })
      .expect(200);
    const off = await http()
      .get('/api/v1/phuong-tien-van-chuyen?trangThai=false')
      .set(as('kho'))
      .expect(200);
    expect((off.body as Page<XeBody>).items.map((x) => x.bienSo)).toEqual([
      '30A33333',
    ]);
    await http()
      .patch(`/api/v1/phuong-tien-van-chuyen/${xe.id}`)
      .set(as('quanly'))
      .send({ trangThai: true })
      .expect(200);

    const q = await http()
      .get('/api/v1/phuong-tien-van-chuyen?q=bán tải')
      .set(as('kho'))
      .expect(200);
    expect((q.body as Page<XeBody>).items).toHaveLength(1);
    await http()
      .get('/api/v1/phuong-tien-van-chuyen?sort=loaiPhuongTien:asc')
      .set(as('kho'))
      .expect(400);
  });

  it('phân quyền: ai cũng đọc; kho/quản lý/admin tạo-sửa; kế toán không; chỉ ADMIN xóa', async () => {
    const xe = (await create({ bienSo: '60A-444.44' }).expect(201))
      .body as XeBody;
    await http().get('/api/v1/phuong-tien-van-chuyen').expect(401);
    for (const user of ['kho', 'ketoan', 'quanly']) {
      await http()
        .get(`/api/v1/phuong-tien-van-chuyen/${xe.id}`)
        .set(as(user))
        .expect(200);
    }
    await create({ bienSo: '60A-555.55' }, 'ketoan').expect(403);
    await http()
      .patch(`/api/v1/phuong-tien-van-chuyen/${xe.id}`)
      .set(as('ketoan'))
      .send({ isXeLanh: true })
      .expect(403);
    await create({ bienSo: '60A-666.66' }, 'quanly').expect(201);
    for (const user of ['kho', 'ketoan', 'quanly']) {
      await http()
        .delete(`/api/v1/phuong-tien-van-chuyen/${xe.id}`)
        .set(as(user))
        .expect(403);
    }
  });

  it('xóa: đã gắn phiếu nhập → 409; chưa dùng → 204; id lạ → 400/404', async () => {
    const used = (await create({ bienSo: '70A-777.77' }).expect(201))
      .body as XeBody;
    const supplier = await prisma.nhaCungCap.create({
      data: { maNCC: 'NCC-T1', tenNCC: 'NCC thử' },
    });
    await prisma.phieuNhapHang.create({
      data: {
        maPhieuNhapHang: 'PN-TEST-XE',
        nhaCungCapId: supplier.id,
        phuongTienVanChuyenId: used.id,
      },
    });
    const blocked = await http()
      .delete(`/api/v1/phuong-tien-van-chuyen/${used.id}`)
      .set(as('admin'))
      .expect(409);
    expect((blocked.body as ErrorBody).code).toBe('PHUONG_TIEN_IN_USE');

    const free = (await create({ bienSo: '70A-888.88' }).expect(201))
      .body as XeBody;
    await http()
      .delete(`/api/v1/phuong-tien-van-chuyen/${free.id}`)
      .set(as('admin'))
      .expect(204);
    await http()
      .get(`/api/v1/phuong-tien-van-chuyen/${free.id}`)
      .set(as('admin'))
      .expect(404);
    await http()
      .get('/api/v1/phuong-tien-van-chuyen/abc')
      .set(as('admin'))
      .expect(400);
  });
});
