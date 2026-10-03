import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  bearer,
  createHangHoa,
  createLoaiHang,
  loginAll,
  type HangHoaBody,
  type Tokens,
} from './helpers/catalog.js';
import { createTestApp } from './helpers/create-app.js';
import { migrateTestDatabase, resetAndSeed } from './helpers/test-db.js';

interface Unit {
  id: string;
  donViTinh: string;
  soLuongQuyDoi: number;
  laDonViCoBan: boolean;
  laDonViTinhGia: boolean;
}
interface ErrorBody {
  code: string;
}

describe('Tỷ lệ quy đổi (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: Tokens;
  let catId: string;
  const http = () => request(app.getHttpServer());
  const as = (user: string) => bearer(tokens, user);
  const base = (hangHoaId: string) =>
    `/api/v1/hang-hoa/${hangHoaId}/ty-le-quy-doi`;

  const unitsOf = async (hangHoaId: string): Promise<Unit[]> =>
    (
      (await http().get(base(hangHoaId)).set(as('kho')).expect(200)).body as {
        items: Unit[];
      }
    ).items;
  const unit = async (hangHoaId: string, donViTinh: string): Promise<Unit> =>
    (await unitsOf(hangHoaId)).find((u) => u.donViTinh === donViTinh)!;
  const newProduct = (tenSP: string): Promise<HangHoaBody> =>
    createHangHoa(app, tokens, catId, { tenSP });

  beforeAll(async () => {
    migrateTestDatabase();
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetAndSeed(prisma);
    tokens = await loginAll(app, ['admin', 'quanly', 'kho', 'ketoan']);
    catId = (await createLoaiHang(app, tokens, 'Thuốc')).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('danh sách sắp theo hệ số tăng, đánh dấu đơn vị cơ bản và đơn vị tính giá', async () => {
    const product = await newProduct('Liệt kê');
    const items = await unitsOf(product.id);
    expect(
      items.map((u) => [u.donViTinh, u.laDonViCoBan, u.laDonViTinhGia]),
    ).toEqual([
      ['viên', true, false],
      ['vỉ', false, false],
      ['hộp', false, true],
    ]);
    const one = await http()
      .get(`${base(product.id)}/${items[1]!.id}`)
      .set(as('ketoan'))
      .expect(200);
    expect(one.body).toMatchObject({ donViTinh: 'vỉ', soLuongQuyDoi: 10 });
  });

  it('id sai: hàng không tồn tại → 404; đơn vị của hàng khác → 404; UUID sai → 400', async () => {
    const a = await newProduct('Hàng A');
    const b = await newProduct('Hàng B');
    const bUnit = (await unitsOf(b.id))[0]!;
    const missingProduct = await http()
      .get(base('7d3c9a84-1d3e-4c8d-9b5a-0c2f1e6a9b11'))
      .set(as('admin'))
      .expect(404);
    expect((missingProduct.body as ErrorBody).code).toBe('HANG_HOA_NOT_FOUND');
    const foreign = await http()
      .get(`${base(a.id)}/${bUnit.id}`)
      .set(as('admin'))
      .expect(404);
    expect((foreign.body as ErrorBody).code).toBe('TY_LE_QUY_DOI_NOT_FOUND');
    await http().get(base('abc')).set(as('admin')).expect(400);
  });

  describe('thêm đơn vị', () => {
    it('thêm đơn vị mới; trùng tên (khác hoa/thường) 409; hệ số 1 → 422; hệ số 0 / thập phân → 400', async () => {
      const product = await newProduct('Thêm đơn vị');
      const ok = await http()
        .post(base(product.id))
        .set(as('quanly'))
        .send({ donViTinh: 'thùng', soLuongQuyDoi: 1000 })
        .expect(201);
      expect(ok.body).toMatchObject({
        donViTinh: 'thùng',
        soLuongQuyDoi: 1000,
        laDonViCoBan: false,
      });

      const dup = await http()
        .post(base(product.id))
        .set(as('quanly'))
        .send({ donViTinh: 'HỘP', soLuongQuyDoi: 50 })
        .expect(409);
      expect((dup.body as ErrorBody).code).toBe('TY_LE_QUY_DOI_UNIT_TAKEN');
      const one = await http()
        .post(base(product.id))
        .set(as('quanly'))
        .send({ donViTinh: 'chai', soLuongQuyDoi: 1 })
        .expect(422);
      expect((one.body as ErrorBody).code).toBe('TY_LE_QUY_DOI_BASE_REQUIRED');
      await http()
        .post(base(product.id))
        .set(as('quanly'))
        .send({ donViTinh: 'chai', soLuongQuyDoi: 0 })
        .expect(400);
      await http()
        .post(base(product.id))
        .set(as('quanly'))
        .send({ donViTinh: 'chai', soLuongQuyDoi: 2.5 })
        .expect(400);
    });

    it('phân quyền: kho/kế toán 403 khi thêm-sửa-xóa; quản lý không xóa được; không token 401', async () => {
      const product = await newProduct('Phân quyền đơn vị');
      const target = await unit(product.id, 'vỉ');
      await http().get(base(product.id)).expect(401);
      for (const user of ['kho', 'ketoan']) {
        await http()
          .post(base(product.id))
          .set(as(user))
          .send({ donViTinh: 'x', soLuongQuyDoi: 5 })
          .expect(403);
        await http()
          .patch(`${base(product.id)}/${target.id}`)
          .set(as(user))
          .send({ soLuongQuyDoi: 12 })
          .expect(403);
        await http()
          .delete(`${base(product.id)}/${target.id}`)
          .set(as(user))
          .expect(403);
      }
      await http()
        .delete(`${base(product.id)}/${target.id}`)
        .set(as('quanly'))
        .expect(403);
    });
  });

  describe('sửa đơn vị khi hàng chưa có lô', () => {
    it('đổi hệ số → 200 và có nhật ký trước/sau', async () => {
      const product = await newProduct('Đổi hệ số');
      const target = await unit(product.id, 'vỉ');
      const res = await http()
        .patch(`${base(product.id)}/${target.id}`)
        .set(as('quanly'))
        .send({ soLuongQuyDoi: 12 })
        .expect(200);
      expect(res.body).toMatchObject({ donViTinh: 'vỉ', soLuongQuyDoi: 12 });
      const log = await prisma.nhatKyHeThong.findFirstOrThrow({
        where: { hanhDong: 'ty_le_quy_doi.update', doiTuongId: target.id },
      });
      expect(log.truoc).toEqual({ donViTinh: 'vỉ', soLuongQuyDoi: 10 });
      expect(log.sau).toEqual({ donViTinh: 'vỉ', soLuongQuyDoi: 12 });
    });

    it('đơn vị cơ bản: đổi hệ số → 409; hệ số của đơn vị thường về 1 → 422; đổi tên đơn vị cơ bản → 200', async () => {
      const product = await newProduct('Đơn vị cơ bản');
      const baseUnit = await unit(product.id, 'viên');
      const vi = await unit(product.id, 'vỉ');
      const immutable = await http()
        .patch(`${base(product.id)}/${baseUnit.id}`)
        .set(as('quanly'))
        .send({ soLuongQuyDoi: 2 })
        .expect(409);
      expect((immutable.body as ErrorBody).code).toBe(
        'TY_LE_QUY_DOI_BASE_IMMUTABLE',
      );
      const toOne = await http()
        .patch(`${base(product.id)}/${vi.id}`)
        .set(as('quanly'))
        .send({ soLuongQuyDoi: 1 })
        .expect(422);
      expect((toOne.body as ErrorBody).code).toBe(
        'TY_LE_QUY_DOI_BASE_REQUIRED',
      );
      const renamed = await http()
        .patch(`${base(product.id)}/${baseUnit.id}`)
        .set(as('quanly'))
        .send({ donViTinh: 'viên nén' })
        .expect(200);
      expect(renamed.body).toMatchObject({
        donViTinh: 'viên nén',
        laDonViCoBan: true,
      });
    });

    it('đổi tên trùng đơn vị khác → 409; đổi tên đơn vị đang là đơn vị tính giá → donViTinhGia của hàng đổi theo', async () => {
      const product = await newProduct('Đổi tên');
      const hop = await unit(product.id, 'hộp');
      const vi = await unit(product.id, 'vỉ');
      const clash = await http()
        .patch(`${base(product.id)}/${vi.id}`)
        .set(as('quanly'))
        .send({ donViTinh: 'HỘP' })
        .expect(409);
      expect((clash.body as ErrorBody).code).toBe('TY_LE_QUY_DOI_UNIT_TAKEN');

      const renamed = await http()
        .patch(`${base(product.id)}/${hop.id}`)
        .set(as('quanly'))
        .send({ donViTinh: 'thùng nhỏ' })
        .expect(200);
      expect(renamed.body).toMatchObject({
        donViTinh: 'thùng nhỏ',
        laDonViTinhGia: true,
      });
      const detail = await http()
        .get(`/api/v1/hang-hoa/${product.id}`)
        .set(as('quanly'))
        .expect(200);
      expect((detail.body as HangHoaBody).donViTinhGia).toBe('thùng nhỏ');
    });

    it('gửi lại đúng giá trị hiện tại → 200, không ghi nhật ký', async () => {
      const product = await newProduct('Không đổi');
      const vi = await unit(product.id, 'vỉ');
      await http()
        .patch(`${base(product.id)}/${vi.id}`)
        .set(as('quanly'))
        .send({ donViTinh: 'vỉ', soLuongQuyDoi: 10 })
        .expect(200);
      expect(
        await prisma.nhatKyHeThong.count({
          where: { hanhDong: 'ty_le_quy_doi.update', doiTuongId: vi.id },
        }),
      ).toBe(0);
    });
  });

  describe('khi hàng đã có lô', () => {
    it('không đổi tên / hệ số được (409 LOCKED) nhưng vẫn thêm đơn vị mới và xóa đơn vị phụ', async () => {
      const product = await newProduct('Đã khóa');
      const vi = await unit(product.id, 'vỉ');
      await prisma.soLo.create({
        data: {
          tenLo: 'L100',
          hanSuDung: new Date('2027-12-31'),
          hangHoaId: product.id,
        },
      });

      for (const body of [{ soLuongQuyDoi: 12 }, { donViTinh: 'vi nhỏ' }]) {
        const res = await http()
          .patch(`${base(product.id)}/${vi.id}`)
          .set(as('quanly'))
          .send(body)
          .expect(409);
        expect((res.body as ErrorBody).code).toBe('TY_LE_QUY_DOI_LOCKED');
      }
      await http()
        .post(base(product.id))
        .set(as('quanly'))
        .send({ donViTinh: 'thùng', soLuongQuyDoi: 1000 })
        .expect(201);
      await http()
        .delete(`${base(product.id)}/${vi.id}`)
        .set(as('admin'))
        .expect(204);
      expect((await unitsOf(product.id)).map((u) => u.donViTinh)).toEqual([
        'viên',
        'hộp',
        'thùng',
      ]);
    });
  });

  describe('xóa đơn vị', () => {
    it('đơn vị thường → 204 (có nhật ký); đơn vị cơ bản → 409; đơn vị tính giá → 409 IN_USE', async () => {
      const product = await newProduct('Xóa đơn vị');
      const vi = await unit(product.id, 'vỉ');
      const baseUnit = await unit(product.id, 'viên');
      const hop = await unit(product.id, 'hộp');

      const baseRes = await http()
        .delete(`${base(product.id)}/${baseUnit.id}`)
        .set(as('admin'))
        .expect(409);
      expect((baseRes.body as ErrorBody).code).toBe(
        'TY_LE_QUY_DOI_BASE_IMMUTABLE',
      );
      const priceRes = await http()
        .delete(`${base(product.id)}/${hop.id}`)
        .set(as('admin'))
        .expect(409);
      expect((priceRes.body as ErrorBody).code).toBe('TY_LE_QUY_DOI_IN_USE');

      await http()
        .delete(`${base(product.id)}/${vi.id}`)
        .set(as('admin'))
        .expect(204);
      expect(
        await prisma.nhatKyHeThong.count({
          where: { hanhDong: 'ty_le_quy_doi.delete', doiTuongId: vi.id },
        }),
      ).toBe(1);
      await http()
        .delete(`${base(product.id)}/${vi.id}`)
        .set(as('admin'))
        .expect(404);
    });

    it('đổi đơn vị tính giá rồi mới xóa được đơn vị cũ', async () => {
      const product = await newProduct('Chuyển đơn vị giá');
      const hop = await unit(product.id, 'hộp');
      await http()
        .patch(`/api/v1/hang-hoa/${product.id}`)
        .set(as('quanly'))
        .send({ donViTinhGia: 'viên' })
        .expect(200);
      await http()
        .delete(`${base(product.id)}/${hop.id}`)
        .set(as('admin'))
        .expect(204);
    });
  });
});
