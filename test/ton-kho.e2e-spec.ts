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
import { vnDate } from './helpers/dates.js';
import { migrateTestDatabase, resetAndSeed } from './helpers/test-db.js';

interface Id {
  id: string;
}
interface TonBody {
  id: string;
  soLuong: number;
  donViCoBan: string;
  soLo: { id: string; trangThai: string };
  viTri: { id: string };
}
interface Page<T> {
  items: T[];
  meta: { total: number };
}
interface ErrorBody {
  code: string;
}

describe('Số lô và Tồn kho (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: Tokens;
  const http = () => request(app.getHttpServer());
  const as = (user: string) => bearer(tokens, user);

  let hangId: string;
  let lanhId: string;
  let viTriA: string;
  let viTriB: string;
  let viTriLanh: string;

  const newLo = async (
    hangHoaId: string,
    tenLo: string,
    hanSuDung: string,
  ): Promise<string> =>
    (
      await http()
        .post('/api/v1/so-lo')
        .set(as('kho'))
        .send({ hangHoaId, tenLo, hanSuDung })
        .expect(201)
    ).body.id as string;

  const adjust = (soLoId: string, viTriId: string, soLuongMoi: number) =>
    http()
      .post('/api/v1/ton-kho/dieu-chinh')
      .set(as('quanly'))
      .send({ soLoId, viTriId, soLuongMoi, lyDo: 'kiểm kê' });

  const qty = async (soLoId: string, viTriId: string): Promise<number> =>
    (await prisma.tonKho.findFirst({ where: { soLoId, viTriId } }))?.soLuong ??
    0;

  beforeAll(async () => {
    migrateTestDatabase();
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetAndSeed(prisma);
    tokens = await loginAll(app, ['admin', 'quanly', 'kho', 'ketoan']);

    const loai = await createLoaiHang(app, tokens, 'Thuốc');
    hangId = (await createHangHoa(app, tokens, loai.id)).id;
    lanhId = (
      await createHangHoa(app, tokens, loai.id, {
        tenSP: 'Vaccine',
        isCanGiuLanh: true,
      })
    ).id;
    const kho = (
      await http()
        .post('/api/v1/kho')
        .set(as('quanly'))
        .send({ tenKho: 'Kho M4' })
        .expect(201)
    ).body as Id;
    const vt = async (tenViTri: string, isCapDong = false) =>
      (
        await http()
          .post('/api/v1/vi-tri')
          .set(as('quanly'))
          .send({ khoId: kho.id, tenViTri, isCapDong })
          .expect(201)
      ).body.id as string;
    viTriA = await vt('A1');
    viTriB = await vt('B1');
    viTriLanh = await vt('Lạnh', true);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('số lô', () => {
    it('tạo lô; trùng tên trong cùng hàng → SO_LO_NAME_TAKEN', async () => {
      await newLo(hangId, 'L-DUP', vnDate(400));
      const res = await http()
        .post('/api/v1/so-lo')
        .set(as('kho'))
        .send({ hangHoaId: hangId, tenLo: 'l-dup', hanSuDung: vnDate(400) });
      expect(res.status).toBe(409);
      expect((res.body as ErrorBody).code).toBe('SO_LO_NAME_TAKEN');
    });

    it('ngày sản xuất sau hạn dùng → 422 SO_LO_DATE_INVALID', async () => {
      const res = await http()
        .post('/api/v1/so-lo')
        .set(as('kho'))
        .send({
          hangHoaId: hangId,
          tenLo: 'L-BAD',
          ngaySX: vnDate(-1),
          hanSuDung: vnDate(-5),
        });
      expect(res.status).toBe(422);
      expect((res.body as ErrorBody).code).toBe('SO_LO_DATE_INVALID');
    });

    it('trạng thái theo hạn dùng; lọc trangThai; kế toán không được tạo', async () => {
      const gan = await newLo(hangId, 'L-NEAR', vnDate(10));
      const xa = await newLo(hangId, 'L-FAR', vnDate(500));
      const near = await http()
        .get('/api/v1/so-lo?trangThai=can_date')
        .set(as('kho'))
        .expect(200);
      const ids = (near.body as Page<Id>).items.map((l) => l.id);
      expect(ids).toContain(gan);
      expect(ids).not.toContain(xa);
      await http()
        .post('/api/v1/so-lo')
        .set(as('ketoan'))
        .send({ hangHoaId: hangId, tenLo: 'X', hanSuDung: vnDate(300) })
        .expect(403);
    });

    it('xóa lô chưa phát sinh → 204; lô đã có biến động → SO_LO_IN_USE', async () => {
      const free = await newLo(hangId, 'L-FREE', vnDate(300));
      await http().delete(`/api/v1/so-lo/${free}`).set(as('admin')).expect(204);
      const used = await newLo(hangId, 'L-USED', vnDate(300));
      await adjust(used, viTriA, 5).expect(201);
      const res = await http().delete(`/api/v1/so-lo/${used}`).set(as('admin'));
      expect(res.status).toBe(409);
      expect((res.body as ErrorBody).code).toBe('SO_LO_IN_USE');
    });
  });

  describe('điều chỉnh và sổ biến động', () => {
    it('điều chỉnh tạo dòng tồn + biến động; không đổi → 422; role NV kho bị chặn', async () => {
      const lo = await newLo(hangId, 'L-ADJ', vnDate(300));
      const res = await adjust(lo, viTriA, 100).expect(201);
      expect((res.body as TonBody).soLuong).toBe(100);
      expect((res.body as TonBody).donViCoBan).toBe('viên');

      const same = await adjust(lo, viTriA, 100);
      expect(same.status).toBe(422);
      expect((same.body as ErrorBody).code).toBe('TON_KHO_ADJUST_NO_CHANGE');

      await adjust(lo, viTriA, 96).expect(201);
      const log = await http()
        .get(`/api/v1/ton-kho/bien-dong?soLoId=${lo}`)
        .set(as('ketoan'))
        .expect(200);
      const deltas = (
        log.body as Page<{ soLuongThayDoi: number; soLuongSau: number }>
      ).items
        .map((b) => [b.soLuongThayDoi, b.soLuongSau])
        .sort((a, b) => a[0]! - b[0]!);
      expect(deltas).toEqual([
        [-4, 96],
        [100, 100],
      ]);

      await http()
        .post('/api/v1/ton-kho/dieu-chinh')
        .set(as('kho'))
        .send({ soLoId: lo, viTriId: viTriA, soLuongMoi: 1, lyDo: 'x' })
        .expect(403);
    });
  });

  describe('chuyển vị trí', () => {
    it('chuyển một phần, đúng tổng; hai dòng biến động chung tham chiếu', async () => {
      const lo = await newLo(hangId, 'L-MOVE', vnDate(300));
      await adjust(lo, viTriA, 50).expect(201);
      const res = await http()
        .post('/api/v1/ton-kho/chuyen-vi-tri')
        .set(as('kho'))
        .send({
          soLoId: lo,
          tuViTriId: viTriA,
          denViTriId: viTriB,
          soLuong: 20,
        })
        .expect(201);
      const body = res.body as { tu: TonBody; den: TonBody };
      expect(body.tu.soLuong).toBe(30);
      expect(body.den.soLuong).toBe(20);
      const moves = await prisma.bienDongTonKho.findMany({
        where: { soLoId: lo, loai: { in: ['chuyen_di', 'chuyen_den'] } },
      });
      expect(moves).toHaveLength(2);
      expect(new Set(moves.map((m) => m.thamChieuId)).size).toBe(1);
    });

    it('theo đơn vị quy đổi (1 hộp = 100 viên)', async () => {
      const lo = await newLo(hangId, 'L-UNIT', vnDate(300));
      await adjust(lo, viTriA, 250).expect(201);
      await http()
        .post('/api/v1/ton-kho/chuyen-vi-tri')
        .set(as('kho'))
        .send({
          soLoId: lo,
          tuViTriId: viTriA,
          denViTriId: viTriB,
          soLuong: 2,
          donViTinh: 'hộp',
        })
        .expect(201);
      expect(await qty(lo, viTriA)).toBe(50);
      expect(await qty(lo, viTriB)).toBe(200);
    });

    it('không đủ tồn → 409 TON_KHO_INSUFFICIENT, không đổi gì', async () => {
      const lo = await newLo(hangId, 'L-SHORT', vnDate(300));
      await adjust(lo, viTriA, 5).expect(201);
      const res = await http()
        .post('/api/v1/ton-kho/chuyen-vi-tri')
        .set(as('kho'))
        .send({
          soLoId: lo,
          tuViTriId: viTriA,
          denViTriId: viTriB,
          soLuong: 6,
        });
      expect(res.status).toBe(409);
      expect((res.body as ErrorBody).code).toBe('TON_KHO_INSUFFICIENT');
      expect(await qty(lo, viTriA)).toBe(5);
      expect(await qty(lo, viTriB)).toBe(0);
    });

    it('cùng vị trí → 422; hàng cần giữ lạnh vào vị trí thường → 422 cold chain', async () => {
      const lo = await newLo(lanhId, 'L-COLD', vnDate(300));
      await adjust(lo, viTriLanh, 10).expect(201);
      const same = await http()
        .post('/api/v1/ton-kho/chuyen-vi-tri')
        .set(as('kho'))
        .send({
          soLoId: lo,
          tuViTriId: viTriLanh,
          denViTriId: viTriLanh,
          soLuong: 1,
        });
      expect((same.body as ErrorBody).code).toBe('TON_KHO_SAME_LOCATION');
      const cold = await http()
        .post('/api/v1/ton-kho/chuyen-vi-tri')
        .set(as('kho'))
        .send({
          soLoId: lo,
          tuViTriId: viTriLanh,
          denViTriId: viTriA,
          soLuong: 1,
        });
      expect(cold.status).toBe(422);
      expect((cold.body as ErrorBody).code).toBe(
        'TON_KHO_COLD_CHAIN_VIOLATION',
      );
      const direct = await adjust(
        await newLo(lanhId, 'L-COLD2', vnDate(300)),
        viTriA,
        3,
      );
      expect((direct.body as ErrorBody).code).toBe(
        'TON_KHO_COLD_CHAIN_VIOLATION',
      );
    });

    it('hai lần chuyển đồng thời: chỉ một lần đủ tồn thành công, tồn không âm', async () => {
      const lo = await newLo(hangId, 'L-RACE', vnDate(300));
      await adjust(lo, viTriA, 10).expect(201);
      const send = () =>
        http().post('/api/v1/ton-kho/chuyen-vi-tri').set(as('kho')).send({
          soLoId: lo,
          tuViTriId: viTriA,
          denViTriId: viTriB,
          soLuong: 8,
        });
      const results = await Promise.all([send(), send()]);
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        201, 409,
      ]);
      expect(await qty(lo, viTriA)).toBe(2);
      expect(await qty(lo, viTriB)).toBe(8);
    });
  });

  describe('truy vấn', () => {
    it('gợi ý FEFO: lô hết hạn sớm trước, bỏ lô đã hết hạn, báo thiếu', async () => {
      const loai = await createLoaiHang(app, tokens, 'FEFO');
      const hang = (
        await createHangHoa(app, tokens, loai.id, { tenSP: 'FEFO' })
      ).id;
      const sau = await newLo(hang, 'SAU', vnDate(300));
      const som = await newLo(hang, 'SOM', vnDate(30));
      const het = await prisma.soLo.create({
        data: {
          tenLo: 'HET',
          hangHoaId: hang,
          hanSuDung: new Date(`${vnDate(-5)}T00:00:00Z`),
        },
      });
      await adjust(sau, viTriA, 100).expect(201);
      await adjust(som, viTriA, 40).expect(201);
      await prisma.tonKho.create({
        data: { soLoId: het.id, viTriId: viTriA, soLuong: 500 },
      });

      const res = await http()
        .get(`/api/v1/ton-kho/goi-y-xuat?hangHoaId=${hang}&soLuong=60`)
        .set(as('ketoan'))
        .expect(200);
      const body = res.body as {
        thieu: number;
        phanBo: { tenLo: string; soLuong: number }[];
      };
      expect(body.phanBo.map((p) => [p.tenLo, p.soLuong])).toEqual([
        ['SOM', 40],
        ['SAU', 20],
      ]);
      expect(body.thieu).toBe(0);

      const short = await http()
        .get(`/api/v1/ton-kho/goi-y-xuat?hangHoaId=${hang}&soLuong=500`)
        .set(as('ketoan'))
        .expect(200);
      expect((short.body as { thieu: number }).thieu).toBe(360);
    });

    it('tổng hợp theo hàng, danh sách và chi tiết; route tĩnh không bị :id nuốt', async () => {
      const sum = await http()
        .get('/api/v1/ton-kho/tong-hop')
        .set(as('ketoan'))
        .expect(200);
      expect(
        (sum.body as Page<{ tongTon: number }>).items.length,
      ).toBeGreaterThan(0);
      const list = await http()
        .get('/api/v1/ton-kho?pageSize=5')
        .set(as('ketoan'))
        .expect(200);
      const first = (list.body as Page<TonBody>).items[0]!;
      await http()
        .get(`/api/v1/ton-kho/${first.id}`)
        .set(as('kho'))
        .expect(200);
      const missing = await http()
        .get('/api/v1/ton-kho/00000000-0000-4000-8000-000000000000')
        .set(as('kho'));
      expect(missing.status).toBe(404);
      await http()
        .get('/api/v1/ton-kho/khong-phai-uuid')
        .set(as('kho'))
        .expect(400);
    });
  });

  describe('đối soát', () => {
    it('chỉ ADMIN; mọi thao tác qua API giữ đúng bất biến sổ cái', async () => {
      await http()
        .get('/api/v1/ton-kho/doi-soat')
        .set(as('quanly'))
        .expect(403);
      // Rows written by the earlier tests' direct prisma.create (expired lot) have no
      // ledger entries, so clear them: they are not part of the API invariant.
      await prisma.tonKho.deleteMany({ where: { soLo: { tenLo: 'HET' } } });
      const res = await http()
        .get('/api/v1/ton-kho/doi-soat')
        .set(as('admin'))
        .expect(200);
      expect(res.body).toMatchObject({ soDongLech: 0, chiTietLech: [] });
    });

    it('phát hiện lệch khi tồn bị sửa ngoài API', async () => {
      const lo = await newLo(hangId, 'L-DRIFT', vnDate(300));
      await adjust(lo, viTriA, 10).expect(201);
      await prisma.tonKho.updateMany({
        where: { soLoId: lo, viTriId: viTriA },
        data: { soLuong: 11 },
      });
      const res = await http()
        .get('/api/v1/ton-kho/doi-soat')
        .set(as('admin'))
        .expect(200);
      expect(res.body).toMatchObject({
        soDongLech: 1,
        chiTietLech: [{ soLoId: lo, tonKho: 11, tongBienDong: 10 }],
      });
    });
  });

  describe('ràng buộc dữ liệu', () => {
    it('CHECK constraint chặn tồn âm ở tầng DB', async () => {
      const lo = await newLo(hangId, 'L-CHK', vnDate(300));
      await adjust(lo, viTriA, 1).expect(201);
      await expect(
        prisma.tonKho.updateMany({
          where: { soLoId: lo, viTriId: viTriA },
          data: { soLuong: -1 },
        }),
      ).rejects.toThrow();
    });

    it('xóa vị trí đã có biến động → VI_TRI_IN_USE', async () => {
      const res = await http()
        .delete(`/api/v1/vi-tri/${viTriA}`)
        .set(as('admin'));
      expect(res.status).toBe(409);
      expect((res.body as ErrorBody).code).toBe('VI_TRI_IN_USE');
    });
  });
});
