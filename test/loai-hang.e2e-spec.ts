import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  bearer,
  createHangHoa,
  createLoaiHang,
  loginAll,
  type Tokens,
} from './helpers/catalog.js';
import { createTestApp } from './helpers/create-app.js';
import { migrateTestDatabase, resetAndSeed } from './helpers/test-db.js';

interface LoaiBody {
  id: string;
  tenLoaiHang: string;
  ghiChu: string | null;
  trangThai: boolean;
  soHangHoa: number;
}
interface ErrorBody {
  code: string;
}

describe('Loại hàng (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: Tokens;
  const http = () => request(app.getHttpServer());
  const as = (user: string) => bearer(tokens, user);

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

  it('quản lý tạo loại hàng → 201; đọc lại đúng; tên được cắt khoảng trắng', async () => {
    const res = await http()
      .post('/api/v1/loai-hang')
      .set(as('quanly'))
      .send({ tenLoaiHang: '  Kháng sinh ', ghiChu: 'Nhóm kháng sinh' })
      .expect(201);
    const created = res.body as LoaiBody;
    expect(created).toMatchObject({
      tenLoaiHang: 'Kháng sinh',
      ghiChu: 'Nhóm kháng sinh',
      trangThai: true,
      soHangHoa: 0,
    });

    const one = await http()
      .get(`/api/v1/loai-hang/${created.id}`)
      .set(as('kho'))
      .expect(200);
    expect(one.body).toMatchObject({
      id: created.id,
      tenLoaiHang: 'Kháng sinh',
    });
  });

  it('tên trùng (không phân biệt hoa/thường) → 409 LOAI_HANG_NAME_TAKEN', async () => {
    const res = await http()
      .post('/api/v1/loai-hang')
      .set(as('admin'))
      .send({ tenLoaiHang: 'KHÁNG SINH' })
      .expect(409);
    expect((res.body as ErrorBody).code).toBe('LOAI_HANG_NAME_TAKEN');
  });

  it('dữ liệu sai → 400 VALIDATION_FAILED có details', async () => {
    for (const body of [
      {},
      { tenLoaiHang: '   ' },
      { tenLoaiHang: 'x'.repeat(101) },
      { tenLoaiHang: 'A', extra: 1 },
    ]) {
      const res = await http()
        .post('/api/v1/loai-hang')
        .set(as('admin'))
        .send(body)
        .expect(400);
      expect((res.body as ErrorBody).code).toBe('VALIDATION_FAILED');
    }
  });

  it('phân quyền: ai cũng đọc được; chỉ ADMIN/QUẢN LÝ tạo-sửa; chỉ ADMIN xóa', async () => {
    const created = await createLoaiHang(app, tokens, 'Giảm đau');
    await http().get('/api/v1/loai-hang').expect(401);
    for (const user of ['kho', 'ketoan']) {
      await http().get('/api/v1/loai-hang').set(as(user)).expect(200);
      await http()
        .post('/api/v1/loai-hang')
        .set(as(user))
        .send({ tenLoaiHang: 'X' })
        .expect(403);
      await http()
        .patch(`/api/v1/loai-hang/${created.id}`)
        .set(as(user))
        .send({ ghiChu: 'x' })
        .expect(403);
      await http()
        .delete(`/api/v1/loai-hang/${created.id}`)
        .set(as(user))
        .expect(403);
    }
    await http()
      .delete(`/api/v1/loai-hang/${created.id}`)
      .set(as('quanly'))
      .expect(403);
    await http()
      .delete(`/api/v1/loai-hang/${created.id}`)
      .set(as('admin'))
      .expect(204);
    const gone = await http()
      .get(`/api/v1/loai-hang/${created.id}`)
      .set(as('admin'))
      .expect(404);
    expect((gone.body as ErrorBody).code).toBe('LOAI_HANG_NOT_FOUND');
  });

  it('sửa tên sang tên đã có → 409; đổi ghi chú / xóa ghi chú → 200', async () => {
    const a = await createLoaiHang(app, tokens, 'Vitamin');
    await createLoaiHang(app, tokens, 'Khoáng chất');
    const dup = await http()
      .patch(`/api/v1/loai-hang/${a.id}`)
      .set(as('quanly'))
      .send({ tenLoaiHang: 'khoáng chất' })
      .expect(409);
    expect((dup.body as ErrorBody).code).toBe('LOAI_HANG_NAME_TAKEN');

    await http()
      .patch(`/api/v1/loai-hang/${a.id}`)
      .set(as('quanly'))
      .send({ ghiChu: 'Ghi chú' })
      .expect(200);
    const cleared = await http()
      .patch(`/api/v1/loai-hang/${a.id}`)
      .set(as('quanly'))
      .send({ ghiChu: null })
      .expect(200);
    expect((cleared.body as LoaiBody).ghiChu).toBeNull();
  });

  it('ngừng sử dụng: không gán được cho hàng hóa mới, hàng cũ không bị ảnh hưởng, bật lại được', async () => {
    const cat = await createLoaiHang(app, tokens, 'Sinh phẩm');
    const product = await createHangHoa(app, tokens, cat.id, {
      tenSP: 'Vắc-xin A',
    });

    await http()
      .patch(`/api/v1/loai-hang/${cat.id}`)
      .set(as('quanly'))
      .send({ trangThai: false })
      .expect(200);
    const refused = await http()
      .post('/api/v1/hang-hoa')
      .set(as('quanly'))
      .send({ tenSP: 'Vắc-xin B', loaiHangId: cat.id, donViCoBan: 'liều' })
      .expect(404);
    expect((refused.body as ErrorBody).code).toBe('LOAI_HANG_NOT_FOUND');

    const old = await http()
      .get(`/api/v1/hang-hoa/${product.id}`)
      .set(as('quanly'))
      .expect(200);
    expect((old.body as { trangThai: boolean }).trangThai).toBe(true);

    await http()
      .patch(`/api/v1/loai-hang/${cat.id}`)
      .set(as('quanly'))
      .send({ trangThai: true })
      .expect(200);
    await createHangHoa(app, tokens, cat.id, { tenSP: 'Vắc-xin B' });
  });

  it('không xóa được loại còn hàng hóa (409 kèm số lượng); xóa hết hàng rồi xóa được', async () => {
    const cat = await createLoaiHang(app, tokens, 'Dùng ngoài');
    const product = await createHangHoa(app, tokens, cat.id);

    const blocked = await http()
      .delete(`/api/v1/loai-hang/${cat.id}`)
      .set(as('admin'))
      .expect(409);
    expect(blocked.body).toMatchObject({
      code: 'LOAI_HANG_IN_USE',
      details: { soHangHoa: 1 },
    });

    const list = await http()
      .get('/api/v1/loai-hang?q=Dùng ngoài')
      .set(as('admin'))
      .expect(200);
    expect((list.body as { items: LoaiBody[] }).items[0]).toMatchObject({
      soHangHoa: 1,
    });

    await http()
      .delete(`/api/v1/hang-hoa/${product.id}`)
      .set(as('admin'))
      .expect(204);
    await http()
      .delete(`/api/v1/loai-hang/${cat.id}`)
      .set(as('admin'))
      .expect(204);
  });

  it('danh sách: phân trang, lọc trangThai, tìm q, sắp xếp; sort lạ → 400', async () => {
    const page = await http()
      .get('/api/v1/loai-hang?pageSize=2&page=1')
      .set(as('kho'))
      .expect(200);
    const body = page.body as {
      items: LoaiBody[];
      meta: { pageSize: number; total: number; totalPages: number };
    };
    expect(body.items).toHaveLength(2);
    expect(body.meta.pageSize).toBe(2);
    expect(body.meta.totalPages).toBe(Math.ceil(body.meta.total / 2));

    const names = body.items.map((i) => i.tenLoaiHang);
    expect([...names].sort((x, y) => x.localeCompare(y, 'vi'))).toEqual(names);

    const desc = await http()
      .get('/api/v1/loai-hang?sort=tenLoaiHang:desc')
      .set(as('kho'))
      .expect(200);
    const all = (desc.body as { items: LoaiBody[] }).items.map(
      (i) => i.tenLoaiHang,
    );
    expect(all[0]!.localeCompare(all[all.length - 1]!, 'vi')).toBeGreaterThan(
      0,
    );

    await prisma.loaiHang.updateMany({
      where: { tenLoaiHang: 'Vitamin' },
      data: { trangThai: false },
    });
    const off = await http()
      .get('/api/v1/loai-hang?trangThai=false')
      .set(as('kho'))
      .expect(200);
    expect(
      (off.body as { items: LoaiBody[] }).items.map((i) => i.tenLoaiHang),
    ).toEqual(['Vitamin']);

    await http()
      .get('/api/v1/loai-hang?sort=ghiChu:asc')
      .set(as('kho'))
      .expect(400);
    await http()
      .get('/api/v1/loai-hang?pageSize=101')
      .set(as('kho'))
      .expect(400);
  });

  it('id sai định dạng → 400 COMMON_INVALID_ID; không tồn tại → 404', async () => {
    const bad = await http()
      .get('/api/v1/loai-hang/abc')
      .set(as('admin'))
      .expect(400);
    expect((bad.body as ErrorBody).code).toBe('COMMON_INVALID_ID');
    await http()
      .patch('/api/v1/loai-hang/7d3c9a84-1d3e-4c8d-9b5a-0c2f1e6a9b11')
      .set(as('admin'))
      .send({ ghiChu: 'x' })
      .expect(404);
    await http()
      .delete('/api/v1/loai-hang/7d3c9a84-1d3e-4c8d-9b5a-0c2f1e6a9b11')
      .set(as('admin'))
      .expect(404);
  });
});
