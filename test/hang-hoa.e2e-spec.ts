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

interface ErrorBody {
  code: string;
  details: unknown;
}
interface Page<T> {
  items: T[];
  meta: { total: number };
}

describe('Hàng hóa (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: Tokens;
  let catId: string;
  const http = () => request(app.getHttpServer());
  const as = (user: string) => bearer(tokens, user);
  const post = (body: Record<string, unknown>, user = 'quanly') =>
    http().post('/api/v1/hang-hoa').set(as(user)).send(body);

  beforeAll(async () => {
    migrateTestDatabase();
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetAndSeed(prisma);
    tokens = await loginAll(app, ['admin', 'quanly', 'kho', 'ketoan']);
    catId = (await createLoaiHang(app, tokens, 'Giảm đau – hạ sốt')).id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('tạo', () => {
    it('tạo kèm đơn vị cơ bản và đơn vị khác: sinh maSP, trả giá dạng chuỗi, đơn vị sắp theo hệ số', async () => {
      const product = await createHangHoa(app, tokens, catId, {
        quyCach: 'Hộp 10 vỉ × 10 viên',
        isCanGiuLanh: false,
      });
      expect(product.maSP).toBe('SP00001');
      expect(product).toMatchObject({
        tenSP: 'Paracetamol 500mg',
        donViCoBan: 'viên',
        donViTinhGia: 'hộp',
        giaNhap: '90000.00',
        giaHienThi: '125000.00',
        giaToiThieu: '100000.00',
        isKeDon: false,
        loaiKiemSoat: 'thuong',
        trangThai: true,
      });
      expect(
        product.tyLeQuyDoi.map((u) => [u.donViTinh, u.soLuongQuyDoi]),
      ).toEqual([
        ['viên', 1],
        ['vỉ', 10],
        ['hộp', 100],
      ]);

      const saved = await prisma.hangHoa.findUniqueOrThrow({
        where: { id: product.id },
      });
      expect(saved.createdById).not.toBeNull();
      expect(saved.updatedById).toBe(saved.createdById);
    });

    it('chỉ truyền tối thiểu: donViTinhGia = đơn vị cơ bản, giá 0.00', async () => {
      const res = await post({
        tenSP: 'Dầu gió',
        loaiHangId: catId,
        donViCoBan: 'chai',
      }).expect(201);
      expect(res.body).toMatchObject({
        maSP: 'SP00002',
        donViCoBan: 'chai',
        donViTinhGia: 'chai',
        giaHienThi: '0.00',
        giaNhap: '0.00',
      });
    });

    it('10 yêu cầu tạo đồng thời → 10 maSP khác nhau, không lỗi deadlock', async () => {
      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          post({
            tenSP: `Song song ${i}`,
            loaiHangId: catId,
            donViCoBan: 'viên',
          }),
        ),
      );
      expect(results.map((r) => r.status)).toEqual(Array(10).fill(201));
      const codes = results.map((r) => (r.body as HangHoaBody).maSP);
      expect(new Set(codes).size).toBe(10);
    });

    it('giá tối thiểu lớn hơn giá hiển thị → 422', async () => {
      const res = await post({
        tenSP: 'X',
        loaiHangId: catId,
        donViCoBan: 'viên',
        giaHienThi: '100',
        giaToiThieu: '101',
      }).expect(422);
      expect((res.body as ErrorBody).code).toBe('HANG_HOA_PRICE_INVALID');
    });

    it.each([
      [
        'kê đơn nhưng loại kiểm soát "thường"',
        { isKeDon: true, loaiKiemSoat: 'thuong', soDangKy: 'VD-1' },
      ],
      ['kê đơn thiếu số đăng ký', { isKeDon: true, loaiKiemSoat: 'ke_don' }],
      ['kê đơn chưa chọn loại kiểm soát', { isKeDon: true, soDangKy: 'VD-1' }],
      [
        'kiểm soát đặc biệt thiếu số đăng ký',
        { loaiKiemSoat: 'kiem_soat_dac_biet' },
      ],
    ])('%s → 422 HANG_HOA_CONTROL_TYPE_INVALID', async (_name, extra) => {
      const res = await post({
        tenSP: 'X',
        loaiHangId: catId,
        donViCoBan: 'viên',
        ...extra,
      }).expect(422);
      expect((res.body as ErrorBody).code).toBe(
        'HANG_HOA_CONTROL_TYPE_INVALID',
      );
    });

    it('thuốc kê đơn đầy đủ thông tin → 201', async () => {
      const res = await post({
        tenSP: 'Amoxicillin 500mg',
        loaiHangId: catId,
        donViCoBan: 'viên',
        isKeDon: true,
        loaiKiemSoat: 'ke_don',
        soDangKy: 'VD-12345-20',
      }).expect(201);
      expect(res.body).toMatchObject({
        isKeDon: true,
        loaiKiemSoat: 'ke_don',
        soDangKy: 'VD-12345-20',
      });
    });

    it('đơn vị tính giá không thuộc các đơn vị → 422; tên đơn vị trùng → 409; hệ số 1 → 422', async () => {
      const bad = await post({
        tenSP: 'X',
        loaiHangId: catId,
        donViCoBan: 'viên',
        donViTinhGia: 'thùng',
      }).expect(422);
      expect((bad.body as ErrorBody).code).toBe('HANG_HOA_PRICE_UNIT_INVALID');

      const dup = await post({
        tenSP: 'X',
        loaiHangId: catId,
        donViCoBan: 'viên',
        cacDonViKhac: [{ donViTinh: 'VIÊN', soLuongQuyDoi: 10 }],
      }).expect(409);
      expect((dup.body as ErrorBody).code).toBe('TY_LE_QUY_DOI_UNIT_TAKEN');

      const one = await post({
        tenSP: 'X',
        loaiHangId: catId,
        donViCoBan: 'viên',
        cacDonViKhac: [{ donViTinh: 'vỉ', soLuongQuyDoi: 1 }],
      }).expect(422);
      expect((one.body as ErrorBody).code).toBe('TY_LE_QUY_DOI_BASE_REQUIRED');
    });

    it('loại hàng không tồn tại → 404; lỗi giữa chừng không để lại hàng mồ côi', async () => {
      const before = await prisma.hangHoa.count();
      const res = await post({
        tenSP: 'Mồ côi',
        loaiHangId: '7d3c9a84-1d3e-4c8d-9b5a-0c2f1e6a9b11',
        donViCoBan: 'viên',
      }).expect(404);
      expect((res.body as ErrorBody).code).toBe('LOAI_HANG_NOT_FOUND');
      expect(await prisma.hangHoa.count()).toBe(before);
    });

    it('dữ liệu sai định dạng → 400 kèm details từng field', async () => {
      const res = await post({
        tenSP: '',
        loaiHangId: 'abc',
        giaNhap: 1250,
        giaHienThi: '-1',
        maSP: 'SP99999',
      }).expect(400);
      const body = res.body as ErrorBody;
      expect(body.code).toBe('VALIDATION_FAILED');
      const fields = (body.details as { field: string }[]).map((d) => d.field);
      expect(fields).toEqual(
        expect.arrayContaining([
          'tenSP',
          'loaiHangId',
          'donViCoBan',
          'giaNhap',
          'giaHienThi',
          'maSP',
        ]),
      );
    });
  });

  describe('phân quyền và che giá', () => {
    it('ai đăng nhập cũng đọc được; chỉ ADMIN/QUẢN LÝ tạo-sửa; chỉ ADMIN xóa', async () => {
      const product = await createHangHoa(app, tokens, catId, {
        tenSP: 'Phân quyền',
      });
      await http().get('/api/v1/hang-hoa').expect(401);
      for (const user of ['kho', 'ketoan']) {
        await http()
          .get(`/api/v1/hang-hoa/${product.id}`)
          .set(as(user))
          .expect(200);
        await post(
          { tenSP: 'X', loaiHangId: catId, donViCoBan: 'viên' },
          user,
        ).expect(403);
        await http()
          .patch(`/api/v1/hang-hoa/${product.id}`)
          .set(as(user))
          .send({ ghiChu: 'x' })
          .expect(403);
        await http()
          .delete(`/api/v1/hang-hoa/${product.id}`)
          .set(as(user))
          .expect(403);
      }
      await http()
        .delete(`/api/v1/hang-hoa/${product.id}`)
        .set(as('quanly'))
        .expect(403);
    });

    it('NHAN_VIEN_KHO không thấy giaNhap / giaToiThieu (cả danh sách lẫn chi tiết); các role còn lại thấy', async () => {
      const product = await createHangHoa(app, tokens, catId, {
        tenSP: 'Che giá',
      });
      const detail = await http()
        .get(`/api/v1/hang-hoa/${product.id}`)
        .set(as('kho'))
        .expect(200);
      expect(detail.body).not.toHaveProperty('giaNhap');
      expect(detail.body).not.toHaveProperty('giaToiThieu');
      expect((detail.body as HangHoaBody).giaHienThi).toBe('125000.00');

      const list = await http()
        .get('/api/v1/hang-hoa?q=Che giá')
        .set(as('kho'))
        .expect(200);
      const item = (list.body as Page<HangHoaBody>).items[0]!;
      expect(item).not.toHaveProperty('giaNhap');
      expect(item).not.toHaveProperty('giaToiThieu');

      for (const user of ['admin', 'quanly', 'ketoan']) {
        const res = await http()
          .get(`/api/v1/hang-hoa/${product.id}`)
          .set(as(user))
          .expect(200);
        expect(res.body).toMatchObject({
          giaNhap: '90000.00',
          giaToiThieu: '100000.00',
        });
      }
    });
  });

  describe('cập nhật', () => {
    it('đổi giá → ghi nhật ký hang_hoa.price_change (ADMIN xem được qua /audit); không đổi giá thì không ghi', async () => {
      const product = await createHangHoa(app, tokens, catId, {
        tenSP: 'Đổi giá',
      });

      await http()
        .patch(`/api/v1/hang-hoa/${product.id}`)
        .set(as('quanly'))
        .send({ tenSP: 'Đổi giá (tên mới)' })
        .expect(200);
      await http()
        .patch(`/api/v1/hang-hoa/${product.id}`)
        .set(as('quanly'))
        .send({ giaHienThi: '125000.00' })
        .expect(200);
      expect(
        await prisma.nhatKyHeThong.count({
          where: { hanhDong: 'hang_hoa.price_change', doiTuongId: product.id },
        }),
      ).toBe(0);

      const res = await http()
        .patch(`/api/v1/hang-hoa/${product.id}`)
        .set(as('quanly'))
        .send({ giaHienThi: '130000', giaToiThieu: '105000' })
        .expect(200);
      expect(res.body).toMatchObject({
        giaHienThi: '130000.00',
        giaToiThieu: '105000.00',
      });

      const audit = await http()
        .get(
          `/api/v1/audit?hanhDong=hang_hoa.price_change&doiTuongId=${product.id}`,
        )
        .set(as('admin'))
        .expect(200);
      const entry = (
        audit.body as {
          items: {
            truoc: Record<string, string>;
            sau: Record<string, string>;
            user: { maNV: string };
          }[];
        }
      ).items[0]!;
      expect(entry.truoc).toMatchObject({
        giaHienThi: '125000.00',
        giaToiThieu: '100000.00',
      });
      expect(entry.sau).toMatchObject({
        giaHienThi: '130000.00',
        giaToiThieu: '105000.00',
      });
      expect(entry.user.maNV).toBe('NV0005');
    });

    it('giá tối thiểu vượt giá hiển thị hiện tại → 422; đơn vị tính giá lạ → 422; đổi sang đơn vị hợp lệ → 200', async () => {
      const product = await createHangHoa(app, tokens, catId, {
        tenSP: 'Kiểm giá',
      });
      const over = await http()
        .patch(`/api/v1/hang-hoa/${product.id}`)
        .set(as('quanly'))
        .send({ giaToiThieu: '999999' })
        .expect(422);
      expect((over.body as ErrorBody).code).toBe('HANG_HOA_PRICE_INVALID');
      const unit = await http()
        .patch(`/api/v1/hang-hoa/${product.id}`)
        .set(as('quanly'))
        .send({ donViTinhGia: 'thùng' })
        .expect(422);
      expect((unit.body as ErrorBody).code).toBe('HANG_HOA_PRICE_UNIT_INVALID');
      const ok = await http()
        .patch(`/api/v1/hang-hoa/${product.id}`)
        .set(as('quanly'))
        .send({ donViTinhGia: 'VỈ' })
        .expect(200);
      expect((ok.body as HangHoaBody).donViTinhGia).toBe('vỉ');
    });

    it('không cho sửa maSP / đơn vị qua endpoint này; bật isKeDon khi chưa có loại kiểm soát → 422', async () => {
      const product = await createHangHoa(app, tokens, catId, {
        tenSP: 'Cấm sửa',
      });
      await http()
        .patch(`/api/v1/hang-hoa/${product.id}`)
        .set(as('quanly'))
        .send({ maSP: 'SP00099' })
        .expect(400);
      await http()
        .patch(`/api/v1/hang-hoa/${product.id}`)
        .set(as('quanly'))
        .send({ donViCoBan: 'x' })
        .expect(400);
      const res = await http()
        .patch(`/api/v1/hang-hoa/${product.id}`)
        .set(as('quanly'))
        .send({ isKeDon: true })
        .expect(422);
      expect((res.body as ErrorBody).code).toBe(
        'HANG_HOA_CONTROL_TYPE_INVALID',
      );
    });

    it('ngừng kinh doanh rồi bật lại; đổi sang loại hàng đã tắt → 404', async () => {
      const product = await createHangHoa(app, tokens, catId, {
        tenSP: 'Ngừng KD',
      });
      const off = await http()
        .patch(`/api/v1/hang-hoa/${product.id}`)
        .set(as('quanly'))
        .send({ trangThai: false })
        .expect(200);
      expect((off.body as HangHoaBody).trangThai).toBe(false);
      await http()
        .patch(`/api/v1/hang-hoa/${product.id}`)
        .set(as('quanly'))
        .send({ trangThai: true })
        .expect(200);

      const other = await createLoaiHang(app, tokens, 'Loại đã tắt');
      await prisma.loaiHang.update({
        where: { id: other.id },
        data: { trangThai: false },
      });
      const res = await http()
        .patch(`/api/v1/hang-hoa/${product.id}`)
        .set(as('quanly'))
        .send({ loaiHangId: other.id })
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('LOAI_HANG_NOT_FOUND');
    });
  });

  describe('tìm kiếm và danh sách', () => {
    beforeAll(async () => {
      const cold = await createLoaiHang(app, tokens, 'Sinh phẩm lạnh');
      await createHangHoa(app, tokens, cold.id, {
        tenSP: 'Insulin 100IU',
        isCanGiuLanh: true,
        loaiKiemSoat: 'ke_don',
        isKeDon: true,
        soDangKy: 'QLSP-0001',
      });
    });

    it('lọc theo isCanGiuLanh, isKeDon, loaiKiemSoat, loaiHangId, q (tên / mã / số đăng ký)', async () => {
      const names = async (query: string) =>
        (
          (
            await http()
              .get(`/api/v1/hang-hoa?${query}`)
              .set(as('ketoan'))
              .expect(200)
          ).body as Page<HangHoaBody>
        ).items.map((i) => i.tenSP);

      expect(await names('isCanGiuLanh=true')).toEqual(['Insulin 100IU']);
      expect(await names('isKeDon=true&loaiKiemSoat=ke_don')).toEqual(
        expect.arrayContaining(['Insulin 100IU', 'Amoxicillin 500mg']),
      );
      expect(await names('q=QLSP-0001')).toEqual(['Insulin 100IU']);
      expect(await names('q=insulin')).toEqual(['Insulin 100IU']);
      expect(await names('q=SP00001')).toEqual(['Paracetamol 500mg']);
      const cold = await prisma.loaiHang.findFirstOrThrow({
        where: { tenLoaiHang: 'Sinh phẩm lạnh' },
      });
      expect(await names(`loaiHangId=${cold.id}`)).toEqual(['Insulin 100IU']);
      expect(await names('isCanGiuLanh=false&q=Insulin')).toEqual([]);
    });

    it('phân trang, sắp xếp, trạng thái; tham số sai → 400', async () => {
      const first = await http()
        .get('/api/v1/hang-hoa?pageSize=3&sort=maSP:asc')
        .set(as('admin'))
        .expect(200);
      const page = first.body as Page<HangHoaBody>;
      expect(page.items).toHaveLength(3);
      const codes = page.items.map((i) => i.maSP);
      expect(codes).toEqual(codes.toSorted());

      const off = await http()
        .get('/api/v1/hang-hoa?trangThai=false')
        .set(as('admin'))
        .expect(200);
      expect(
        (off.body as Page<HangHoaBody>).items.every((i) => !i.trangThai),
      ).toBe(true);

      await http()
        .get('/api/v1/hang-hoa?sort=giaNhap:asc')
        .set(as('admin'))
        .expect(400);
      await http()
        .get('/api/v1/hang-hoa?isKeDon=maybe')
        .set(as('admin'))
        .expect(400);
      await http()
        .get('/api/v1/hang-hoa?loaiKiemSoat=khac')
        .set(as('admin'))
        .expect(400);
      await http()
        .get('/api/v1/hang-hoa?loaiHangId=abc')
        .set(as('admin'))
        .expect(400);
    });

    it('id sai định dạng → 400; không tồn tại → 404', async () => {
      await http().get('/api/v1/hang-hoa/abc').set(as('admin')).expect(400);
      const res = await http()
        .get('/api/v1/hang-hoa/7d3c9a84-1d3e-4c8d-9b5a-0c2f1e6a9b11')
        .set(as('admin'))
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('HANG_HOA_NOT_FOUND');
    });
  });

  describe('xóa', () => {
    it('chưa có lô → 204 và xóa luôn các đơn vị; đã có lô → 409 HANG_HOA_IN_USE', async () => {
      const free = await createHangHoa(app, tokens, catId, {
        tenSP: 'Xóa được',
      });
      await http()
        .delete(`/api/v1/hang-hoa/${free.id}`)
        .set(as('admin'))
        .expect(204);
      expect(await prisma.hangHoa.count({ where: { id: free.id } })).toBe(0);
      expect(
        await prisma.tyLeQuyDoi.count({ where: { hangHoaId: free.id } }),
      ).toBe(0);

      const used = await createHangHoa(app, tokens, catId, {
        tenSP: 'Đã có lô',
      });
      await prisma.soLo.create({
        data: {
          tenLo: 'L001',
          hanSuDung: new Date('2027-12-31'),
          hangHoaId: used.id,
        },
      });
      const res = await http()
        .delete(`/api/v1/hang-hoa/${used.id}`)
        .set(as('admin'))
        .expect(409);
      expect((res.body as ErrorBody).code).toBe('HANG_HOA_IN_USE');
      expect(
        await prisma.tyLeQuyDoi.count({ where: { hangHoaId: used.id } }),
      ).toBe(3);
    });
  });
});
