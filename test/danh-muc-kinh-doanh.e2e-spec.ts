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

interface Id {
  id: string;
}
interface ErrorBody {
  code: string;
}
interface Page<T> {
  items: T[];
  meta: { total: number };
}

describe('Danh mục kinh doanh và trường bổ sung (e2e)', () => {
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

  describe('nhóm khách hàng / NCC', () => {
    it('tạo, đọc, sửa; trùng mã → 409; mã sai định dạng → 400', async () => {
      const created = await http()
        .post('/api/v1/nhom-doi-tac')
        .set(as('ketoan'))
        .send({ ma: 'NHA_THUOC', ten: 'Nhà thuốc' })
        .expect(201);
      const id = (created.body as Id).id;
      expect(created.body).toMatchObject({
        ma: 'NHA_THUOC',
        soKhachHang: 0,
        soNhaCungCap: 0,
      });

      const dup = await http()
        .post('/api/v1/nhom-doi-tac')
        .set(as('quanly'))
        .send({ ma: 'nha_thuoc', ten: 'X' });
      expect(dup.status).toBe(409);
      expect((dup.body as ErrorBody).code).toBe('NHOM_DOI_TAC_CODE_TAKEN');
      await http()
        .post('/api/v1/nhom-doi-tac')
        .set(as('quanly'))
        .send({ ma: 'sai ma!', ten: 'X' })
        .expect(400);

      await http()
        .patch(`/api/v1/nhom-doi-tac/${id}`)
        .set(as('quanly'))
        .send({ ten: 'Quầy thuốc' })
        .expect(200);
      const list = await http()
        .get('/api/v1/nhom-doi-tac?q=Quầy')
        .set(as('kho'))
        .expect(200);
      expect((list.body as Page<Id>).meta.total).toBe(1);
    });

    it('phân quyền: NVK chỉ đọc; chỉ ADMIN xóa; xóa nhóm còn thành viên → 409', async () => {
      const group = (
        await http()
          .post('/api/v1/nhom-doi-tac')
          .set(as('admin'))
          .send({ ma: 'G1', ten: 'G1' })
          .expect(201)
      ).body as Id;
      await http()
        .post('/api/v1/nhom-doi-tac')
        .set(as('kho'))
        .send({ ma: 'G2', ten: 'G2' })
        .expect(403);
      await http()
        .get(`/api/v1/nhom-doi-tac/${group.id}`)
        .set(as('kho'))
        .expect(200);
      await http().get('/api/v1/nhom-doi-tac').expect(401);

      await http()
        .post('/api/v1/khach-hang')
        .set(as('ketoan'))
        .send({ tenKH: 'Thuộc G1', nhomDoiTacId: group.id })
        .expect(201);
      await http()
        .delete(`/api/v1/nhom-doi-tac/${group.id}`)
        .set(as('quanly'))
        .expect(403);
      const inUse = await http()
        .delete(`/api/v1/nhom-doi-tac/${group.id}`)
        .set(as('admin'));
      expect(inUse.status).toBe(409);
      expect((inUse.body as ErrorBody).code).toBe('NHOM_DOI_TAC_IN_USE');

      const empty = (
        await http()
          .post('/api/v1/nhom-doi-tac')
          .set(as('admin'))
          .send({ ma: 'G3', ten: 'G3' })
          .expect(201)
      ).body as Id;
      await http()
        .delete(`/api/v1/nhom-doi-tac/${empty.id}`)
        .set(as('admin'))
        .expect(204);
      await http()
        .get(`/api/v1/nhom-doi-tac/${empty.id}`)
        .set(as('admin'))
        .expect(404);
    });
  });

  describe('điều khoản thanh toán', () => {
    it('tạo/sửa; số ngày ngoài khoảng → 400; trùng mã → 409; đang dùng → không xóa được', async () => {
      const term = (
        await http()
          .post('/api/v1/dieu-khoan-thanh-toan')
          .set(as('ketoan'))
          .send({ ma: 'NET30', ten: '30 ngày', soNgayDuocNo: 30 })
          .expect(201)
      ).body as Id & { soNgayDuocNo: number };
      expect(term.soNgayDuocNo).toBe(30);
      await http()
        .post('/api/v1/dieu-khoan-thanh-toan')
        .set(as('ketoan'))
        .send({ ma: 'X', ten: 'X', soNgayDuocNo: -1 })
        .expect(400);
      await http()
        .post('/api/v1/dieu-khoan-thanh-toan')
        .set(as('ketoan'))
        .send({ ma: 'X', ten: 'X', soNgayDuocNo: 4000 })
        .expect(400);
      const dup = await http()
        .post('/api/v1/dieu-khoan-thanh-toan')
        .set(as('ketoan'))
        .send({ ma: 'NET30', ten: 'Y', soNgayDuocNo: 5 });
      expect((dup.body as ErrorBody).code).toBe('DIEU_KHOAN_CODE_TAKEN');
      await http()
        .patch(`/api/v1/dieu-khoan-thanh-toan/${term.id}`)
        .set(as('quanly'))
        .send({ soNgayDuocNo: 45 })
        .expect(200);

      await http()
        .post('/api/v1/khach-hang')
        .set(as('ketoan'))
        .send({ tenKH: 'Có điều khoản', dieuKhoanThanhToanId: term.id })
        .expect(201);
      const inUse = await http()
        .delete(`/api/v1/dieu-khoan-thanh-toan/${term.id}`)
        .set(as('admin'));
      expect((inUse.body as ErrorBody).code).toBe('DIEU_KHOAN_IN_USE');
    });
  });

  describe('nhân viên kinh doanh', () => {
    it('sinh mã KD…, gắn tài khoản đăng nhập (mỗi tài khoản một nhân viên), ngừng hoạt động', async () => {
      const kho = await prisma.user.findFirstOrThrow({
        where: { username: 'kho' },
      });
      const nv = await http()
        .post('/api/v1/nhan-vien-kinh-doanh')
        .set(as('quanly'))
        .send({
          hoTen: 'Vũ Văn Cường',
          dienThoai: '0912345678',
          userId: kho.id,
        })
        .expect(201);
      expect(nv.body).toMatchObject({
        maNV: expect.stringMatching(/^KD\d{4}$/),
        userId: kho.id,
        trangThai: true,
      });

      const taken = await http()
        .post('/api/v1/nhan-vien-kinh-doanh')
        .set(as('quanly'))
        .send({ hoTen: 'Người khác', userId: kho.id });
      expect(taken.status).toBe(409);
      expect((taken.body as ErrorBody).code).toBe('NHAN_VIEN_KD_USER_TAKEN');
      const ghost = await http()
        .post('/api/v1/nhan-vien-kinh-doanh')
        .set(as('quanly'))
        .send({ hoTen: 'Ma', userId: '00000000-0000-4000-8000-000000000000' });
      expect(ghost.status).toBe(404);
      await http()
        .post('/api/v1/nhan-vien-kinh-doanh')
        .set(as('kho'))
        .send({ hoTen: 'X' })
        .expect(403);

      const off = await http()
        .patch(`/api/v1/nhan-vien-kinh-doanh/${(nv.body as Id).id}`)
        .set(as('quanly'))
        .send({ trangThai: false })
        .expect(200);
      expect((off.body as { trangThai: boolean }).trangThai).toBe(false);
    });

    it('nhân viên đã ngừng hoạt động không gán được cho khách; chưa phát sinh thì xóa được, đã gán thì không', async () => {
      const staff = (
        await http()
          .post('/api/v1/nhan-vien-kinh-doanh')
          .set(as('quanly'))
          .send({ hoTen: 'Dương Quốc Đạt' })
          .expect(201)
      ).body as Id;
      const customer = (
        await http()
          .post('/api/v1/khach-hang')
          .set(as('ketoan'))
          .send({ tenKH: 'Được phụ trách', nhanVienBanHangId: staff.id })
          .expect(201)
      ).body as Id & { nhanVienBanHangId: string };
      expect(customer.nhanVienBanHangId).toBe(staff.id);
      const inUse = await http()
        .delete(`/api/v1/nhan-vien-kinh-doanh/${staff.id}`)
        .set(as('admin'));
      expect((inUse.body as ErrorBody).code).toBe('NHAN_VIEN_KD_IN_USE');

      const idle = (
        await http()
          .post('/api/v1/nhan-vien-kinh-doanh')
          .set(as('quanly'))
          .send({ hoTen: 'Đã nghỉ' })
          .expect(201)
      ).body as Id;
      await http()
        .patch(`/api/v1/nhan-vien-kinh-doanh/${idle.id}`)
        .set(as('quanly'))
        .send({ trangThai: false })
        .expect(200);
      const blocked = await http()
        .post('/api/v1/khach-hang')
        .set(as('ketoan'))
        .send({ tenKH: 'Gán người nghỉ', nhanVienBanHangId: idle.id });
      expect(blocked.status).toBe(422);
      expect((blocked.body as ErrorBody).code).toBe('NHAN_VIEN_KD_INACTIVE');
      await http()
        .delete(`/api/v1/nhan-vien-kinh-doanh/${idle.id}`)
        .set(as('admin'))
        .expect(204);
    });
  });

  describe('khách hàng: trường bổ sung', () => {
    it('lưu và trả hạn mức nợ, điều khoản, liên hệ, địa lý, người nhận hóa đơn', async () => {
      const res = await http()
        .post('/api/v1/khach-hang')
        .set(as('ketoan'))
        .send({
          tenKH: 'Nguyễn Huy Dân (Nhà thuốc Thiên Huệ)',
          loaiChuThe: 'ca_nhan',
          soCCCD: '079055011649',
          ngayCap: '2020-05-01',
          noiCap: 'Cục CSQLHC',
          soNgayDuocNo: 30,
          soNoToiDa: '50000000',
          tinhTp: 'Lâm Đồng',
          quanHuyen: 'Đà Lạt',
          xaPhuong: 'Xuân Hương',
          lienHeHoTen: 'Dân',
          lienHeEmail: 'DAN@Example.com',
          hoaDonTenNguoiNhan: 'Kế toán',
          hoaDonEmail: 'ketoan@example.com',
          daiDienTheoPhapLuat: 'Nguyễn Huy Dân',
        })
        .expect(201);
      expect(res.body).toMatchObject({
        loaiChuThe: 'ca_nhan',
        soCCCD: '079055011649',
        ngayCap: '2020-05-01',
        soNgayDuocNo: 30,
        soNoToiDa: '50000000.00',
        quocGia: 'Việt Nam',
        tinhTp: 'Lâm Đồng',
        lienHeEmail: 'dan@example.com',
        hoaDonTenNguoiNhan: 'Kế toán',
      });
    });

    it('mặc định khi không gửi: tổ chức, hạn mức 0.00; giá trị sai → 400; tham chiếu không tồn tại → 404', async () => {
      const plain = await http()
        .post('/api/v1/khach-hang')
        .set(as('ketoan'))
        .send({ tenKH: 'Mặc định' })
        .expect(201);
      expect(plain.body).toMatchObject({
        loaiChuThe: 'to_chuc',
        soNoToiDa: '0.00',
        soNgayDuocNo: null,
        nhomDoiTacId: null,
      });
      const bad = (body: Record<string, unknown>) =>
        http()
          .post('/api/v1/khach-hang')
          .set(as('ketoan'))
          .send({ tenKH: 'Sai', ...body });
      expect((await bad({ soNoToiDa: '-5' })).status).toBe(400);
      expect((await bad({ soNoToiDa: '1.234' })).status).toBe(400);
      expect((await bad({ loaiChuThe: 'khac' })).status).toBe(400);
      expect((await bad({ soNgayDuocNo: 4000 })).status).toBe(400);
      expect((await bad({ lienHeEmail: 'khong-phai-email' })).status).toBe(400);
      const ghost = '00000000-0000-4000-8000-000000000000';
      expect(
        ((await bad({ nhomDoiTacId: ghost })).body as ErrorBody).code,
      ).toBe('NHOM_DOI_TAC_NOT_FOUND');
      expect(
        ((await bad({ dieuKhoanThanhToanId: ghost })).body as ErrorBody).code,
      ).toBe('DIEU_KHOAN_NOT_FOUND');
      expect(
        ((await bad({ nhanVienBanHangId: ghost })).body as ErrorBody).code,
      ).toBe('NHAN_VIEN_KD_NOT_FOUND');
    });

    it('sửa từng phần không làm mất trường khác; đặt lại về null được', async () => {
      const kh = (
        await http()
          .post('/api/v1/khach-hang')
          .set(as('ketoan'))
          .send({
            tenKH: 'Sửa dần',
            soNoToiDa: '1000',
            tinhTp: 'Hà Nội',
            soNgayDuocNo: 7,
          })
          .expect(201)
      ).body as Id;
      const res = await http()
        .patch(`/api/v1/khach-hang/${kh.id}`)
        .set(as('quanly'))
        .send({ tinhTp: null, soNoToiDa: '2500.50' })
        .expect(200);
      expect(res.body).toMatchObject({
        tinhTp: null,
        soNoToiDa: '2500.50',
        soNgayDuocNo: 7,
      });
    });
  });

  describe('nhà cung cấp: trường bổ sung', () => {
    it('lưu MST, email, nhân viên mua hàng, hạn nợ; MST sai → 400', async () => {
      const buyer = (
        await http()
          .post('/api/v1/nhan-vien-kinh-doanh')
          .set(as('quanly'))
          .send({ hoTen: 'Mua hàng A' })
          .expect(201)
      ).body as Id;
      const res = await http()
        .post('/api/v1/nha-cung-cap')
        .set(as('ketoan'))
        .send({
          tenNCC: 'Dược Hậu Giang',
          maSoThue: '0312345678',
          email: 'Sales@DHG.vn',
          nhanVienMuaHangId: buyer.id,
          soNgayDuocNo: 60,
          soNoToiDa: '200000000',
          tinhTp: 'Cần Thơ',
        })
        .expect(201);
      expect(res.body).toMatchObject({
        maSoThue: '0312345678',
        email: 'sales@dhg.vn',
        nhanVienMuaHangId: buyer.id,
        soNgayDuocNo: 60,
        soNoToiDa: '200000000.00',
        tinhTp: 'Cần Thơ',
        loaiChuThe: 'to_chuc',
      });
      await http()
        .post('/api/v1/nha-cung-cap')
        .set(as('ketoan'))
        .send({ tenNCC: 'Sai MST', maSoThue: '123' })
        .expect(400);
    });
  });

  describe('hàng hóa: mã quy cách và thuế GTGT', () => {
    it('mặc định thuế 0.00; lưu và sửa; ngoài 0–100 → 400', async () => {
      const loai = await createLoaiHang(app, tokens, 'Thuế');
      const plain = await createHangHoa(app, tokens, loai.id, {
        tenSP: 'Không thuế',
      });
      expect(plain).toMatchObject({ thueSuatGtgt: '0.00', maQuyCach: null });

      const taxed = await createHangHoa(app, tokens, loai.id, {
        tenSP: 'Có thuế',
        maQuyCach: 'QC-01',
        thueSuatGtgt: '8',
      });
      expect(taxed).toMatchObject({ thueSuatGtgt: '8.00', maQuyCach: 'QC-01' });
      const patched = await http()
        .patch(`/api/v1/hang-hoa/${taxed.id}`)
        .set(as('quanly'))
        .send({ thueSuatGtgt: '10.5' })
        .expect(200);
      expect(patched.body).toMatchObject({
        thueSuatGtgt: '10.50',
        maQuyCach: 'QC-01',
      });
      for (const value of ['101', '-1', '8.123', 'abc']) {
        await http()
          .patch(`/api/v1/hang-hoa/${taxed.id}`)
          .set(as('quanly'))
          .send({ thueSuatGtgt: value })
          .expect(400);
      }
    });
  });
});
