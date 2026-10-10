import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { bearer, loginAll, type Tokens } from './helpers/catalog.js';
import { createTestApp } from './helpers/create-app.js';
import { vnDate } from './helpers/dates.js';
import { migrateTestDatabase, resetAndSeed } from './helpers/test-db.js';

interface Id {
  id: string;
}
interface Bank extends Id {
  soTaiKhoan: string;
  tenNganHang: string;
  chiNhanh: string | null;
}
interface Place extends Id {
  diaDiem: string;
  laMacDinh: boolean;
}
interface ErrorBody {
  code: string;
}

describe('Tài khoản ngân hàng và địa điểm giao hàng (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: Tokens;
  const http = () => request(app.getHttpServer());
  const as = (user: string) => bearer(tokens, user);

  let khachId: string;
  let khach2Id: string;
  let nccId: string;
  const NIL = '00000000-0000-4000-8000-000000000000';

  const newKhach = async (tenKH: string): Promise<string> =>
    (
      (
        await http()
          .post('/api/v1/khach-hang')
          .set(as('ketoan'))
          .send({
            tenKH,
            diaChi: 'Địa chỉ đăng ký',
            ngayHetHanGPKD: vnDate(400),
          })
          .expect(201)
      ).body as Id
    ).id;

  beforeAll(async () => {
    migrateTestDatabase();
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetAndSeed(prisma);
    tokens = await loginAll(app, ['admin', 'quanly', 'kho', 'ketoan']);
    khachId = await newKhach('Nhà thuốc A');
    khach2Id = await newKhach('Nhà thuốc B');
    nccId = (
      (
        await http()
          .post('/api/v1/nha-cung-cap')
          .set(as('ketoan'))
          .send({
            tenNCC: 'NCC Chuẩn',
            soGiayPhepKinhDoanh: 'GP-1',
            ngayCapGPKD: '2023-01-01',
            noiCapGPKD: 'Sở',
            ngayHetHanGPKD: vnDate(500),
            soGCNDuDieuKienKinhDoanhDuoc: 'GCN-1',
            ngayCapGCNDuoc: '2023-01-01',
            noiCapGCNDuoc: 'Sở Y tế',
            ngayHetHanGCNDuoc: vnDate(500),
          })
          .expect(201)
      ).body as Id
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('tài khoản ngân hàng', () => {
    const base = (owner: 'khach-hang' | 'nha-cung-cap', id: string) =>
      `/api/v1/${owner}/${id}/tai-khoan-ngan-hang`;

    it.each([
      ['khach-hang', () => khachId],
      ['nha-cung-cap', () => nccId],
    ] as const)('thêm, liệt kê, sửa, xóa cho %s', async (owner, getId) => {
      const url = base(owner, getId());
      const created = (
        await http()
          .post(url)
          .set(as('ketoan'))
          .send({
            soTaiKhoan: '0123456789',
            tenNganHang: 'Vietcombank',
            chiNhanh: 'Q1',
          })
          .expect(201)
      ).body as Bank;
      expect(created).toMatchObject({
        soTaiKhoan: '0123456789',
        chiNhanh: 'Q1',
      });

      const dup = await http()
        .post(url)
        .set(as('ketoan'))
        .send({ soTaiKhoan: '0123456789', tenNganHang: 'Vietcombank' })
        .expect(409);
      expect((dup.body as ErrorBody).code).toBe(
        'TAI_KHOAN_NGAN_HANG_DUPLICATE',
      );
      // Same number at another bank is a different account.
      await http()
        .post(url)
        .set(as('ketoan'))
        .send({ soTaiKhoan: '0123456789', tenNganHang: 'ACB' })
        .expect(201);

      const list = (await http().get(url).set(as('kho')).expect(200))
        .body as Bank[];
      expect(list.map((b) => b.tenNganHang)).toEqual(['ACB', 'Vietcombank']);

      const patched = (
        await http()
          .patch(`${url}/${created.id}`)
          .set(as('quanly'))
          .send({ chiNhanh: null, soTaiKhoan: '999' })
          .expect(200)
      ).body as Bank;
      expect(patched).toMatchObject({ soTaiKhoan: '999', chiNhanh: null });

      await http()
        .patch(`${url}/${created.id}`)
        .set(as('quanly'))
        .send({ tenNganHang: 'ACB', soTaiKhoan: '0123456789' })
        .expect(409);

      await http().delete(`${url}/${created.id}`).set(as('ketoan')).expect(204);
      expect(
        ((await http().get(url).set(as('kho')).expect(200)).body as Bank[])
          .length,
      ).toBe(1);
    });

    it('không đụng được tài khoản của chủ khác; chủ không tồn tại; phân quyền', async () => {
      const mine = (
        await http()
          .post(base('khach-hang', khach2Id))
          .set(as('ketoan'))
          .send({ soTaiKhoan: '111', tenNganHang: 'BIDV' })
          .expect(201)
      ).body as Bank;
      const wrongOwner = await http()
        .delete(`${base('khach-hang', khachId)}/${mine.id}`)
        .set(as('ketoan'))
        .expect(404);
      expect((wrongOwner.body as ErrorBody).code).toBe(
        'TAI_KHOAN_NGAN_HANG_NOT_FOUND',
      );
      // A customer's account id is not reachable through the supplier route.
      await http()
        .patch(`${base('nha-cung-cap', nccId)}/${mine.id}`)
        .set(as('ketoan'))
        .send({ chiNhanh: 'x' })
        .expect(404);
      await http().get(base('khach-hang', NIL)).set(as('kho')).expect(404);
      await http()
        .post(base('khach-hang', khachId))
        .set(as('kho'))
        .send({ soTaiKhoan: '1', tenNganHang: 'X' })
        .expect(403);
      await http()
        .post(base('khach-hang', khachId))
        .set(as('ketoan'))
        .send({ soTaiKhoan: '', tenNganHang: 'X' })
        .expect(400);
    });
  });

  describe('địa điểm giao hàng', () => {
    const url = (id = khachId) => `/api/v1/khach-hang/${id}/dia-diem-giao-hang`;
    const add = async (diaDiem: string, laMacDinh?: boolean, id = khachId) =>
      (
        await http()
          .post(url(id))
          .set(as('ketoan'))
          .send({ diaDiem, laMacDinh })
          .expect(201)
      ).body as Place;
    const list = async (id = khachId) =>
      (await http().get(url(id)).set(as('kho')).expect(200)).body as Place[];

    it('địa điểm đầu tiên tự là mặc định; luôn chỉ có một mặc định', async () => {
      const a = await add('Kho 1');
      expect(a.laMacDinh).toBe(true);
      const b = await add('Kho 2');
      expect(b.laMacDinh).toBe(false);
      const c = await add('Kho 3', true);
      expect(c.laMacDinh).toBe(true);
      let rows = await list();
      expect(rows.filter((r) => r.laMacDinh).map((r) => r.id)).toEqual([c.id]);
      expect(rows[0]!.id).toBe(c.id);

      await http()
        .patch(`${url()}/${a.id}`)
        .set(as('ketoan'))
        .send({ laMacDinh: true })
        .expect(200);
      rows = await list();
      expect(rows.filter((r) => r.laMacDinh).map((r) => r.id)).toEqual([a.id]);

      // The default cannot be switched off directly.
      await http()
        .patch(`${url()}/${a.id}`)
        .set(as('ketoan'))
        .send({ laMacDinh: false })
        .expect(200);
      expect((await list()).filter((r) => r.laMacDinh)).toHaveLength(1);
    });

    it('xóa địa điểm mặc định thì mặc định chuyển sang địa điểm khác; trùng bị chặn', async () => {
      const dup = await http()
        .post(url())
        .set(as('ketoan'))
        .send({ diaDiem: 'Kho 2' })
        .expect(409);
      expect((dup.body as ErrorBody).code).toBe('DIA_DIEM_GIAO_HANG_DUPLICATE');

      const before = await list();
      const def = before.find((r) => r.laMacDinh)!;
      await http().delete(`${url()}/${def.id}`).set(as('ketoan')).expect(204);
      const after = await list();
      expect(after).toHaveLength(before.length - 1);
      expect(after.filter((r) => r.laMacDinh)).toHaveLength(1);

      for (const r of after) {
        await http().delete(`${url()}/${r.id}`).set(as('ketoan')).expect(204);
      }
      expect(await list()).toEqual([]);
    });

    it('chủ khác, không tồn tại, phân quyền', async () => {
      const place = await add('Của B', undefined, khach2Id);
      await http().delete(`${url()}/${place.id}`).set(as('ketoan')).expect(404);
      await http().get(url(NIL)).set(as('kho')).expect(404);
      await http()
        .post(url())
        .set(as('kho'))
        .send({ diaDiem: 'x' })
        .expect(403);
    });

    it('phiếu xuất lấy địa điểm mặc định làm địa chỉ giao; không có thì dùng địa chỉ đăng ký', async () => {
      const plain = await newKhach('Chưa có địa điểm');
      const orderFor = async (id: string) =>
        (
          await http()
            .post('/api/v1/phieu-xuat-hang')
            .set(as('kho'))
            .send({ khachHangId: id })
            .expect(201)
        ).body as { diaChiGiaoHang: string | null };
      expect((await orderFor(plain)).diaChiGiaoHang).toBe('Địa chỉ đăng ký');

      await add('Kho giao chính', undefined, plain);
      await add('Kho phụ', undefined, plain);
      expect((await orderFor(plain)).diaChiGiaoHang).toBe('Kho giao chính');
    });
  });
});
