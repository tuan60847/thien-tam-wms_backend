import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { bearer, loginAll, type Tokens } from './helpers/catalog.js';
import { createTestApp } from './helpers/create-app.js';
import { seedStock } from './helpers/stock.js';
import { migrateTestDatabase, resetAndSeed } from './helpers/test-db.js';

interface KhoBody {
  id: string;
  tenKho: string;
  trangThai: boolean;
  soViTri: number;
  coTon: boolean;
}
interface ViTriBody {
  id: string;
  tenViTri: string;
  isCapDong: boolean;
  trangThai: boolean;
  coTon: boolean;
  kho: { id: string; tenKho: string };
}
interface ErrorBody {
  code: string;
}
interface Page<T> {
  items: T[];
  meta: { total: number };
}

describe('Kho và Vị trí (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: Tokens;
  const http = () => request(app.getHttpServer());
  const as = (user: string) => bearer(tokens, user);

  const newKho = async (tenKho: string): Promise<KhoBody> =>
    (
      await http()
        .post('/api/v1/kho')
        .set(as('quanly'))
        .send({ tenKho })
        .expect(201)
    ).body as KhoBody;
  const newViTri = async (
    khoId: string,
    tenViTri: string,
    isCapDong = false,
  ): Promise<ViTriBody> =>
    (
      await http()
        .post('/api/v1/vi-tri')
        .set(as('quanly'))
        .send({ khoId, tenViTri, isCapDong })
        .expect(201)
    ).body as ViTriBody;

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

  describe('kho', () => {
    it('tạo kho → 201 (rỗng, chưa có tồn); đọc lại đúng; tên được cắt khoảng trắng', async () => {
      const res = await http()
        .post('/api/v1/kho')
        .set(as('quanly'))
        .send({ tenKho: '  Kho chính ', diaChi: '12 Lê Lợi, Q.1' })
        .expect(201);
      expect(res.body).toMatchObject({
        tenKho: 'Kho chính',
        diaChi: '12 Lê Lợi, Q.1',
        trangThai: true,
        soViTri: 0,
        coTon: false,
      });
      const id = (res.body as KhoBody).id;
      await http().get(`/api/v1/kho/${id}`).set(as('kho')).expect(200);
    });

    it('tên trùng (khác hoa/thường) → 409; dữ liệu sai → 400', async () => {
      const dup = await http()
        .post('/api/v1/kho')
        .set(as('admin'))
        .send({ tenKho: 'KHO CHÍNH' })
        .expect(409);
      expect((dup.body as ErrorBody).code).toBe('KHO_NAME_TAKEN');
      for (const body of [
        {},
        { tenKho: '  ' },
        { tenKho: 'x'.repeat(101) },
        { tenKho: 'A', extra: 1 },
      ]) {
        await http()
          .post('/api/v1/kho')
          .set(as('admin'))
          .send(body)
          .expect(400);
      }
    });

    it('phân quyền: ai cũng đọc; chỉ ADMIN/QUẢN LÝ tạo-sửa; chỉ ADMIN xóa; không token 401', async () => {
      const k = await newKho('Kho phân quyền');
      await http().get('/api/v1/kho').expect(401);
      for (const user of ['kho', 'ketoan']) {
        await http().get('/api/v1/kho').set(as(user)).expect(200);
        await http()
          .post('/api/v1/kho')
          .set(as(user))
          .send({ tenKho: 'X' })
          .expect(403);
        await http()
          .patch(`/api/v1/kho/${k.id}`)
          .set(as(user))
          .send({ diaChi: 'x' })
          .expect(403);
        await http().delete(`/api/v1/kho/${k.id}`).set(as(user)).expect(403);
      }
      await http().delete(`/api/v1/kho/${k.id}`).set(as('quanly')).expect(403);
      await http().delete(`/api/v1/kho/${k.id}`).set(as('admin')).expect(204);
    });

    it('danh sách: phân trang, tìm q, lọc trạng thái, sắp xếp; tham số sai → 400', async () => {
      await newKho('Kho Bắc');
      await newKho('Kho Nam');
      const page = await http()
        .get('/api/v1/kho?pageSize=2&sort=tenKho:desc')
        .set(as('kho'))
        .expect(200);
      const body = page.body as Page<KhoBody>;
      expect(body.items).toHaveLength(2);
      expect(body.meta.total).toBeGreaterThanOrEqual(3);

      const q = await http()
        .get('/api/v1/kho?q=Bắc')
        .set(as('kho'))
        .expect(200);
      expect((q.body as Page<KhoBody>).items.map((k) => k.tenKho)).toEqual([
        'Kho Bắc',
      ]);

      await http()
        .get('/api/v1/kho?sort=diaChi:asc')
        .set(as('kho'))
        .expect(400);
      await http()
        .get('/api/v1/kho?trangThai=maybe')
        .set(as('kho'))
        .expect(400);
      await http().get('/api/v1/kho/abc').set(as('kho')).expect(400);
      await http()
        .get('/api/v1/kho/7d3c9a84-1d3e-4c8d-9b5a-0c2f1e6a9b11')
        .set(as('kho'))
        .expect(404);
    });

    it('xóa kho còn vị trí → 409 KHO_HAS_VI_TRI; xóa hết vị trí rồi xóa được', async () => {
      const k = await newKho('Kho xóa');
      const v = await newViTri(k.id, 'A-01');
      const blocked = await http()
        .delete(`/api/v1/kho/${k.id}`)
        .set(as('admin'))
        .expect(409);
      expect(blocked.body).toMatchObject({
        code: 'KHO_HAS_VI_TRI',
        details: { soViTri: 1 },
      });
      await http()
        .delete(`/api/v1/vi-tri/${v.id}`)
        .set(as('admin'))
        .expect(204);
      await http().delete(`/api/v1/kho/${k.id}`).set(as('admin')).expect(204);
    });
  });

  describe('vị trí', () => {
    it('tạo vị trí (thường và cấp đông); lọc theo kho và isCapDong; response kèm kho', async () => {
      const k = await newKho('Kho vị trí');
      await newViTri(k.id, 'A-01');
      await newViTri(k.id, 'LANH-01', true);

      const all = await http()
        .get(`/api/v1/vi-tri?khoId=${k.id}`)
        .set(as('kho'))
        .expect(200);
      expect(
        (all.body as Page<ViTriBody>).items.map((v) => v.tenViTri),
      ).toEqual(['A-01', 'LANH-01']);
      const cold = await http()
        .get(`/api/v1/vi-tri?khoId=${k.id}&isCapDong=true`)
        .set(as('kho'))
        .expect(200);
      expect((cold.body as Page<ViTriBody>).items).toHaveLength(1);
      expect((cold.body as Page<ViTriBody>).items[0]).toMatchObject({
        tenViTri: 'LANH-01',
        kho: { id: k.id },
        coTon: false,
      });
      const detail = await http()
        .get(`/api/v1/kho/${k.id}`)
        .set(as('kho'))
        .expect(200);
      expect((detail.body as KhoBody).soViTri).toBe(2);
    });

    it('trùng tên trong cùng kho → 409; cùng tên ở kho khác → 201; kho không tồn tại → 404; kho bị tắt → 422', async () => {
      const k1 = await newKho('Kho trùng 1');
      const k2 = await newKho('Kho trùng 2');
      await newViTri(k1.id, 'B-01');
      const dup = await http()
        .post('/api/v1/vi-tri')
        .set(as('quanly'))
        .send({ khoId: k1.id, tenViTri: 'b-01' })
        .expect(409);
      expect((dup.body as ErrorBody).code).toBe('VI_TRI_NAME_TAKEN');
      await newViTri(k2.id, 'B-01');

      const missing = await http()
        .post('/api/v1/vi-tri')
        .set(as('quanly'))
        .send({ khoId: '7d3c9a84-1d3e-4c8d-9b5a-0c2f1e6a9b11', tenViTri: 'X' })
        .expect(404);
      expect((missing.body as ErrorBody).code).toBe('KHO_NOT_FOUND');

      await http()
        .patch(`/api/v1/kho/${k2.id}`)
        .set(as('quanly'))
        .send({ trangThai: false })
        .expect(200);
      const off = await http()
        .post('/api/v1/vi-tri')
        .set(as('quanly'))
        .send({ khoId: k2.id, tenViTri: 'Z' })
        .expect(422);
      expect((off.body as ErrorBody).code).toBe('VI_TRI_INACTIVE');
    });

    it('phân quyền: kho/kế toán chỉ đọc; quản lý không xóa được', async () => {
      const k = await newKho('Kho quyền vị trí');
      const v = await newViTri(k.id, 'Q-01');
      for (const user of ['kho', 'ketoan']) {
        await http().get(`/api/v1/vi-tri/${v.id}`).set(as(user)).expect(200);
        await http()
          .post('/api/v1/vi-tri')
          .set(as(user))
          .send({ khoId: k.id, tenViTri: 'X' })
          .expect(403);
        await http()
          .patch(`/api/v1/vi-tri/${v.id}`)
          .set(as(user))
          .send({ ghiChu: 'x' })
          .expect(403);
        await http().delete(`/api/v1/vi-tri/${v.id}`).set(as(user)).expect(403);
      }
      await http()
        .delete(`/api/v1/vi-tri/${v.id}`)
        .set(as('quanly'))
        .expect(403);
    });

    it('không cho đổi kho của vị trí; sửa tên/ghi chú được', async () => {
      const k = await newKho('Kho sửa vị trí');
      const v = await newViTri(k.id, 'S-01');
      await http()
        .patch(`/api/v1/vi-tri/${v.id}`)
        .set(as('quanly'))
        .send({ khoId: k.id })
        .expect(400);
      const res = await http()
        .patch(`/api/v1/vi-tri/${v.id}`)
        .set(as('quanly'))
        .send({ tenViTri: 'S-02', ghiChu: 'Kệ trên' })
        .expect(200);
      expect(res.body).toMatchObject({ tenViTri: 'S-02', ghiChu: 'Kệ trên' });
    });
  });

  describe('khi vị trí có hàng tồn', () => {
    it('coTon đúng ở vị trí và kho; không vô hiệu hóa được vị trí / kho còn tồn', async () => {
      const k = await newKho('Kho có tồn');
      const v = await newViTri(k.id, 'T-01');
      await seedStock(prisma, { viTriId: v.id, soLuong: 50 });

      const vt = await http()
        .get(`/api/v1/vi-tri/${v.id}`)
        .set(as('kho'))
        .expect(200);
      expect((vt.body as ViTriBody).coTon).toBe(true);
      const kh = await http()
        .get(`/api/v1/kho/${k.id}`)
        .set(as('kho'))
        .expect(200);
      expect((kh.body as KhoBody).coTon).toBe(true);

      const viTriRes = await http()
        .patch(`/api/v1/vi-tri/${v.id}`)
        .set(as('quanly'))
        .send({ trangThai: false })
        .expect(409);
      expect((viTriRes.body as ErrorBody).code).toBe('VI_TRI_HAS_STOCK');
      const khoRes = await http()
        .patch(`/api/v1/kho/${k.id}`)
        .set(as('quanly'))
        .send({ trangThai: false })
        .expect(409);
      expect((khoRes.body as ErrorBody).code).toBe('KHO_IN_USE');
    });

    it('hết tồn (về 0) thì vô hiệu hóa được và có nhật ký; vị trí đã từng có tồn không xóa được', async () => {
      const k = await newKho('Kho hết tồn');
      const v = await newViTri(k.id, 'H-01');
      const { tonKhoId } = await seedStock(prisma, {
        viTriId: v.id,
        soLuong: 5,
      });
      await prisma.tonKho.update({
        where: { id: tonKhoId },
        data: { soLuong: 0 },
      });

      const off = await http()
        .patch(`/api/v1/vi-tri/${v.id}`)
        .set(as('quanly'))
        .send({ trangThai: false })
        .expect(200);
      expect((off.body as ViTriBody).coTon).toBe(false);
      const log = await prisma.nhatKyHeThong.findFirstOrThrow({
        where: { hanhDong: 'vi_tri.update', doiTuongId: v.id },
      });
      expect(log.truoc).toEqual({ isCapDong: false, trangThai: true });
      expect(log.sau).toEqual({ isCapDong: false, trangThai: false });

      const del = await http()
        .delete(`/api/v1/vi-tri/${v.id}`)
        .set(as('admin'))
        .expect(409);
      expect((del.body as ErrorBody).code).toBe('VI_TRI_IN_USE');
    });

    it('bỏ cờ cấp đông: bị chặn khi có hàng cần giữ lạnh, được khi chỉ có hàng thường', async () => {
      const k = await newKho('Kho lạnh');
      const coldLoc = await newViTri(k.id, 'LANH-01', true);
      const normalLoc = await newViTri(k.id, 'LANH-02', true);
      await seedStock(prisma, {
        viTriId: coldLoc.id,
        soLuong: 10,
        isCanGiuLanh: true,
      });
      await seedStock(prisma, {
        viTriId: normalLoc.id,
        soLuong: 10,
        isCanGiuLanh: false,
      });

      const blocked = await http()
        .patch(`/api/v1/vi-tri/${coldLoc.id}`)
        .set(as('quanly'))
        .send({ isCapDong: false })
        .expect(409);
      expect((blocked.body as ErrorBody).code).toBe('VI_TRI_COLD_CONFLICT');
      const ok = await http()
        .patch(`/api/v1/vi-tri/${normalLoc.id}`)
        .set(as('quanly'))
        .send({ isCapDong: false })
        .expect(200);
      expect((ok.body as ViTriBody).isCapDong).toBe(false);
    });
  });
});
