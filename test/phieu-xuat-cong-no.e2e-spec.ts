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
interface ErrorBody {
  code: string;
}
interface OrderBody {
  id: string;
  tongTien: string;
  tongTienHang: string;
  tienChietKhau: string;
  tienThueGtgt: string;
  conNo: string;
  soNgayDuocNo: number | null;
  hanThanhToan: string | null;
  khachSnapshot: {
    ten: string | null;
    maSoThue: string | null;
    diaChi: string | null;
  };
  nhanVienBanHang: { id: string; hoTen: string } | null;
  dieuKhoanThanhToan: { id: string; ma: string } | null;
  nguoiLienHe: string | null;
  chiTiet: {
    thanhTien: string;
    tyLeChietKhau: string;
    tienChietKhau: string;
    thueSuatGtgt: string;
    tienThueGtgt: string;
    laHangKhuyenMai: boolean;
  }[];
}

describe('Phiếu xuất: chiết khấu, thuế, hạn nợ và hạn mức (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: Tokens;
  const http = () => request(app.getHttpServer());
  const as = (user: string) => bearer(tokens, user);

  let nccId: string;
  let hangId: string;
  let viTriId: string;
  let staffId: string;
  let termId: string;

  const stockLot = async (hop: number): Promise<string> => {
    const receipt = (
      await http()
        .post('/api/v1/phieu-nhap-hang')
        .set(as('kho'))
        .send({
          nhaCungCapId: nccId,
          chiTiet: [
            {
              soLo: {
                hangHoaId: hangId,
                tenLo: `L${Math.random()}`,
                hanSuDung: vnDate(400),
              },
              viTriId,
              donViTinh: 'hộp',
              soLuong: hop,
              donGia: '90000',
            },
          ],
        })
        .expect(201)
    ).body as Id & { chiTiet: { soLo: Id }[] };
    await http()
      .post(`/api/v1/phieu-nhap-hang/${receipt.id}/xac-nhan`)
      .set(as('quanly'))
      .send({})
      .expect(200);
    return receipt.chiTiet[0]!.soLo.id;
  };
  const newCustomer = async (body: Record<string, unknown> = {}): Promise<Id> =>
    (
      await http()
        .post('/api/v1/khach-hang')
        .set(as('ketoan'))
        .send({
          tenKH: `KH ${Math.random()}`,
          ngayHetHanGPKD: vnDate(400),
          ...body,
        })
        .expect(201)
    ).body as Id;
  const line = (soLoId: string, over: Record<string, unknown> = {}) => ({
    soLoId,
    viTriId,
    donViTinh: 'hộp',
    soLuong: 2,
    donGia: '125000',
    ...over,
  });
  const create = (
    khachHangId: string,
    chiTiet: unknown[],
    extra: Record<string, unknown> = {},
  ) =>
    http()
      .post('/api/v1/phieu-xuat-hang')
      .set(as('kho'))
      .send({ khachHangId, chiTiet, ...extra });
  const created = async (
    khachHangId: string,
    chiTiet: unknown[],
    extra: Record<string, unknown> = {},
  ) =>
    (await create(khachHangId, chiTiet, extra).expect(201)).body as OrderBody;
  const issue = (id: string) =>
    http().post(`/api/v1/phieu-xuat-hang/${id}/xuat-kho`).set(as('kho'));
  const getOrder = async (id: string) =>
    (
      await http()
        .get(`/api/v1/phieu-xuat-hang/${id}`)
        .set(as('ketoan'))
        .expect(200)
    ).body as OrderBody;

  beforeAll(async () => {
    migrateTestDatabase();
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetAndSeed(prisma);
    tokens = await loginAll(app, ['admin', 'quanly', 'kho', 'ketoan']);

    const ncc = (
      await http()
        .post('/api/v1/nha-cung-cap')
        .set(as('ketoan'))
        .send({
          tenNCC: 'NCC',
          soGiayPhepKinhDoanh: 'GP',
          ngayCapGPKD: '2023-01-01',
          noiCapGPKD: 'Sở',
          ngayHetHanGPKD: vnDate(500),
          soGCNDuDieuKienKinhDoanhDuoc: 'GCN',
          ngayCapGCNDuoc: '2023-01-01',
          noiCapGCNDuoc: 'Sở Y tế',
          ngayHetHanGCNDuoc: vnDate(500),
        })
        .expect(201)
    ).body as Id;
    await http()
      .post(`/api/v1/nha-cung-cap/${ncc.id}/xac-minh`)
      .set(as('quanly'))
      .send({ ketQua: 'da_xac_minh' })
      .expect(200);
    nccId = ncc.id;

    const loai = await createLoaiHang(app, tokens, 'Thuốc');
    // price unit = hộp (100 viên); giaNhap 90000, giaToiThieu 100000, VAT 8%
    hangId = (await createHangHoa(app, tokens, loai.id, { thueSuatGtgt: '8' }))
      .id;
    const kho = (
      await http()
        .post('/api/v1/kho')
        .set(as('quanly'))
        .send({ tenKho: 'Kho M8' })
        .expect(201)
    ).body as Id;
    viTriId = (
      await http()
        .post('/api/v1/vi-tri')
        .set(as('quanly'))
        .send({ khoId: kho.id, tenViTri: 'A1' })
        .expect(201)
    ).body.id as string;
    staffId = (
      await http()
        .post('/api/v1/nhan-vien-kinh-doanh')
        .set(as('quanly'))
        .send({ hoTen: 'Vũ Văn Cường' })
        .expect(201)
    ).body.id as string;
    termId = (
      await http()
        .post('/api/v1/dieu-khoan-thanh-toan')
        .set(as('ketoan'))
        .send({ ma: 'NET30', ten: '30 ngày', soNgayDuocNo: 30 })
        .expect(201)
    ).body.id as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it('mặc định lấy từ khách: nhân viên, điều khoản, số ngày nợ, người liên hệ, ảnh chụp thông tin khách', async () => {
    const khach = await newCustomer({
      tenKH: 'Nhà thuốc Thiên Huệ',
      maSoThue: '0312345678',
      diaChi: '02 Ánh Sáng, Đà Lạt',
      nhanVienBanHangId: staffId,
      dieuKhoanThanhToanId: termId,
      lienHeHoTen: 'Chị Hương',
    });
    const lot = await stockLot(5);
    const order = await created(khach.id, [line(lot)]);
    expect(order).toMatchObject({
      soNgayDuocNo: 30,
      hanThanhToan: null,
      nguoiLienHe: 'Chị Hương',
      nhanVienBanHang: { id: staffId },
      dieuKhoanThanhToan: { id: termId, ma: 'NET30' },
      khachSnapshot: {
        ten: 'Nhà thuốc Thiên Huệ',
        maSoThue: '0312345678',
        diaChi: '02 Ánh Sáng, Đà Lạt',
      },
    });

    // the snapshot does not follow later edits of the customer
    await http()
      .patch(`/api/v1/khach-hang/${khach.id}`)
      .set(as('quanly'))
      .send({ tenKH: 'Tên mới', diaChi: 'Địa chỉ mới' })
      .expect(200);
    expect((await getOrder(order.id)).khachSnapshot).toMatchObject({
      ten: 'Nhà thuốc Thiên Huệ',
      diaChi: '02 Ánh Sáng, Đà Lạt',
    });
  });

  it('phiếu ghi đè khách: nhân viên khác, số ngày nợ riêng; tham chiếu báo giá/NV/điều khoản không tồn tại → 404; NV ngừng → 422', async () => {
    const khach = await newCustomer({ nhanVienBanHangId: staffId });
    const lot = await stockLot(2);
    const other = (
      await http()
        .post('/api/v1/nhan-vien-kinh-doanh')
        .set(as('quanly'))
        .send({ hoTen: 'Người khác' })
        .expect(201)
    ).body as Id;
    const order = await created(khach.id, [line(lot, { soLuong: 1 })], {
      nhanVienBanHangId: other.id,
      soNgayDuocNo: 7,
      thamChieu: 'HĐ 155.000.000đ - Đơn 40',
      lapKemHoaDon: true,
    });
    expect(order).toMatchObject({
      soNgayDuocNo: 7,
      nhanVienBanHang: { id: other.id },
    });
    const ghost = '00000000-0000-4000-8000-000000000000';
    expect(
      ((await create(khach.id, [], { baoGiaId: ghost })).body as ErrorBody)
        .code,
    ).toBe('BAO_GIA_NOT_FOUND');
    expect(
      (
        (await create(khach.id, [], { nhanVienBanHangId: ghost }))
          .body as ErrorBody
      ).code,
    ).toBe('NHAN_VIEN_KD_NOT_FOUND');
    expect(
      (
        (await create(khach.id, [], { dieuKhoanThanhToanId: ghost }))
          .body as ErrorBody
      ).code,
    ).toBe('DIEU_KHOAN_NOT_FOUND');
    await http()
      .patch(`/api/v1/nhan-vien-kinh-doanh/${other.id}`)
      .set(as('quanly'))
      .send({ trangThai: false })
      .expect(200);
    expect(
      (
        (await create(khach.id, [], { nhanVienBanHangId: other.id }))
          .body as ErrorBody
      ).code,
    ).toBe('NHAN_VIEN_KD_INACTIVE');
  });

  it('chiết khấu và thuế theo dòng: tổng = hàng − chiết khấu + thuế; thuế mặc định theo hàng hóa, có thể ghi đè', async () => {
    const khach = await newCustomer();
    const lot = await stockLot(5);
    // 2 hộp × 125000 = 250000; CK 10% = 25000; thuế 8% × 225000 = 18000 → 243000
    const order = await created(khach.id, [line(lot, { tyLeChietKhau: '10' })]);
    expect(order.chiTiet[0]).toMatchObject({
      thanhTien: '250000.00',
      tyLeChietKhau: '10.00',
      tienChietKhau: '25000.00',
      thueSuatGtgt: '8.00',
      tienThueGtgt: '18000.00',
      laHangKhuyenMai: false,
    });
    expect(order).toMatchObject({
      tongTienHang: '250000.00',
      tienChietKhau: '25000.00',
      tienThueGtgt: '18000.00',
      tongTien: '243000.00',
    });

    const overridden = await created(khach.id, [
      line(lot, { thueSuatGtgt: '0' }),
    ]);
    expect(overridden).toMatchObject({
      tienThueGtgt: '0.00',
      tongTien: '250000.00',
    });
    for (const bad of [
      { tyLeChietKhau: '101' },
      { tyLeChietKhau: '-1' },
      { thueSuatGtgt: 'abc' },
    ]) {
      expect((await create(khach.id, [line(lot, bad)])).status).toBe(400);
    }
  });

  it('công nợ và thu tiền tính theo tổng thanh toán (đã trừ chiết khấu, cộng thuế)', async () => {
    const khach = await newCustomer();
    const lot = await stockLot(5);
    const order = await created(khach.id, [line(lot, { tyLeChietKhau: '10' })]);
    const done = (await issue(order.id).expect(200)).body as OrderBody;
    expect(done.conNo).toBe('243000.00');

    const pay = (soTien: string) =>
      http()
        .post('/api/v1/phieu-thu-cong-no')
        .set(as('ketoan'))
        .send({
          phieuXuatHangId: order.id,
          soTien,
          ngayThanhToan: vnDate(0),
          phuongThuc: 'tien_mat',
        });
    const over = await pay('243000.01');
    expect((over.body as ErrorBody).code).toBe('PHIEU_THU_EXCEEDS_DEBT');
    await pay('243000').expect(201);
    expect((await getOrder(order.id)).conNo).toBe('0.00');
  });

  it('hạn thanh toán = ngày xuất kho + số ngày được nợ; hiện trong công nợ khách kèm số ngày quá hạn', async () => {
    const khach = await newCustomer({ soNgayDuocNo: 30 });
    const lot = await stockLot(5);
    const order = await created(khach.id, [line(lot, { soLuong: 1 })]);
    expect((await getOrder(order.id)).hanThanhToan).toBeNull();
    const issued = (await issue(order.id).expect(200)).body as OrderBody;
    expect(issued.hanThanhToan).toBe(vnDate(30));

    const debt = await http()
      .get(`/api/v1/khach-hang/${khach.id}/cong-no`)
      .set(as('ketoan'))
      .expect(200);
    expect(
      (
        debt.body as {
          phieuConNo: { hanThanhToan: string; soNgayQuaHan: number | null }[];
        }
      ).phieuConNo[0],
    ).toMatchObject({
      hanThanhToan: vnDate(30),
      soNgayQuaHan: null,
    });

    // an explicit due date wins and is reported as overdue once it has passed
    const lot2 = await stockLot(2);
    const second = await created(khach.id, [line(lot2, { soLuong: 1 })], {
      hanThanhToan: vnDate(-3),
    });
    expect((await issue(second.id).expect(200)).body).toMatchObject({
      hanThanhToan: vnDate(-3),
    });
    const debt2 = await http()
      .get(`/api/v1/khach-hang/${khach.id}/cong-no`)
      .set(as('ketoan'))
      .expect(200);
    const overdue = (
      debt2.body as {
        phieuConNo: { phieuXuatId: string; soNgayQuaHan: number | null }[];
      }
    ).phieuConNo.find((p) => p.phieuXuatId === second.id);
    expect(overdue?.soNgayQuaHan).toBe(3);
  });

  describe('hạn mức nợ (câu #44)', () => {
    it('khách có hạn mức: chặn lập phiếu vượt hạn mức; phiếu vừa đủ thì được', async () => {
      // each order = 2 hộp × 125000 × 1.08 = 270000
      const khach = await newCustomer({ soNoToiDa: '500000' });
      const lot = await stockLot(10);
      const first = await created(khach.id, [line(lot, { soLuong: 2 })]);
      expect(first.tongTien).toBe('270000.00');
      await issue(first.id).expect(200); // outstanding 270000

      const over = await create(khach.id, [line(lot, { soLuong: 2 })]);
      // 270000 + 270000 = 540000 > 500000
      expect(over.status).toBe(422);
      expect((over.body as ErrorBody).code).toBe('KHACH_HANG_CREDIT_EXCEEDED');
      expect(over.body).toMatchObject({
        details: { hanMuc: '500000.00', congNoSauPhieu: '540000.00' },
      });

      // 250000 − 20% = 200000, + 8% VAT = 216000; 270000 + 216000 = 486000 ≤ 500000
      const fits = await created(khach.id, [
        line(lot, { soLuong: 2, tyLeChietKhau: '20' }),
      ]);
      expect(fits.tongTien).toBe('216000.00');
    });

    it('thu tiền làm giảm công nợ nên lập thêm phiếu được; hạn mức 0 = không giới hạn', async () => {
      const khach = await newCustomer({ soNoToiDa: '300000' });
      const lot = await stockLot(10);
      const first = await created(khach.id, [line(lot)]);
      await issue(first.id).expect(200);
      expect((await create(khach.id, [line(lot)])).status).toBe(422);
      await http()
        .post('/api/v1/phieu-thu-cong-no')
        .set(as('ketoan'))
        .send({
          phieuXuatHangId: first.id,
          soTien: '270000',
          ngayThanhToan: vnDate(0),
          phuongThuc: 'tien_mat',
        })
        .expect(201);
      expect((await create(khach.id, [line(lot)])).status).toBe(201);

      const unlimited = await newCustomer({ soNoToiDa: '0' });
      for (let i = 0; i < 3; i++) await created(unlimited.id, [line(lot)]);
    });

    it('kiểm lại khi xuất kho: hạn mức hạ xuống sau khi lập nháp thì không xuất được', async () => {
      const khach = await newCustomer({ soNoToiDa: '1000000' });
      const lot = await stockLot(5);
      const order = await created(khach.id, [line(lot)]);
      await http()
        .patch(`/api/v1/khach-hang/${khach.id}`)
        .set(as('quanly'))
        .send({ soNoToiDa: '100000' })
        .expect(200);
      const res = await issue(order.id);
      expect(res.status).toBe(422);
      expect((res.body as ErrorBody).code).toBe('KHACH_HANG_CREDIT_EXCEEDED');
      expect((await getOrder(order.id)).conNo).toBe('0.00');
      expect(
        await prisma.tonKho.findFirst({ where: { soLoId: lot } }),
      ).toMatchObject({ soLuong: 500 });
    });

    it('công nợ khách trả hạn mức thật và cờ vượt hạn mức', async () => {
      const khach = await newCustomer({ soNoToiDa: '200000' });
      const lot = await stockLot(5);
      // fits at creation (270000 > 200000 would be refused), so use a smaller order
      const order = await created(khach.id, [line(lot, { soLuong: 1 })]); // 135000
      await issue(order.id).expect(200);
      const debt = await http()
        .get(`/api/v1/khach-hang/${khach.id}/cong-no`)
        .set(as('ketoan'))
        .expect(200);
      expect(debt.body).toMatchObject({
        khachHang: { hanMucCongNo: '200000.00' },
        conNo: '135000.00',
        vuotHanMuc: false,
      });
      await http()
        .patch(`/api/v1/khach-hang/${khach.id}`)
        .set(as('quanly'))
        .send({ soNoToiDa: '100000' })
        .expect(200);
      const after = await http()
        .get(`/api/v1/khach-hang/${khach.id}/cong-no`)
        .set(as('ketoan'))
        .expect(200);
      expect(after.body).toMatchObject({ vuotHanMuc: true });
    });
  });

  describe('phiếu thu: trường bổ sung', () => {
    it('lưu người nộp, ngày ghi sổ quỹ; nhân viên bán hàng mặc định theo phiếu xuất, ghi đè được', async () => {
      const khach = await newCustomer({ nhanVienBanHangId: staffId });
      const lot = await stockLot(3);
      const order = await created(khach.id, [line(lot, { soLuong: 1 })]);
      await issue(order.id).expect(200);
      const first = await http()
        .post('/api/v1/phieu-thu-cong-no')
        .set(as('ketoan'))
        .send({
          phieuXuatHangId: order.id,
          soTien: '50000',
          ngayThanhToan: vnDate(0),
          phuongThuc: 'chuyen_khoan',
          nguoiNop: 'Chị Hương',
          ngayGhiSoQuy: vnDate(0),
        })
        .expect(201);
      expect(first.body).toMatchObject({
        nguoiNop: 'Chị Hương',
        ngayGhiSoQuy: vnDate(0),
        nhanVienBanHang: { id: staffId },
      });
      const none = await http()
        .post('/api/v1/phieu-thu-cong-no')
        .set(as('ketoan'))
        .send({
          phieuXuatHangId: order.id,
          soTien: '1000',
          ngayThanhToan: vnDate(0),
          phuongThuc: 'tien_mat',
          nhanVienBanHangId: null,
        })
        .expect(201);
      expect(
        (none.body as { nhanVienBanHang: unknown }).nhanVienBanHang,
      ).toBeNull();
    });
  });
});
