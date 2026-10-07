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
interface Page<T> {
  items: T[];
  meta: { total: number };
}
interface ErrorBody {
  code: string;
  details?: unknown;
}
interface PhieuBody {
  id: string;
  maPhieuNhapHang: string;
  trangThai: string;
  tongTien: string;
  daThanhToan: string;
  conNo: string;
  trangThaiThanhToan: string | null;
  chiTiet: {
    maChiTietPhieuNhapHang: string;
    soLuongCoBan: number;
    thanhTien: string;
    donGia: string;
    soLo: Id;
  }[];
  thanhToan: { daHuy: boolean }[];
}
interface PaymentBody {
  id: string;
  daHuy: boolean;
  phieuNhap: { conNoSauKhiTra: string };
}

const license = () => ({
  soGiayPhepKinhDoanh: 'GP-001',
  ngayCapGPKD: '2023-01-01',
  noiCapGPKD: 'Sở KH&ĐT',
  ngayHetHanGPKD: vnDate(500),
  soGCNDuDieuKienKinhDoanhDuoc: 'GCN-001',
  ngayCapGCNDuoc: '2023-01-01',
  noiCapGCNDuoc: 'Sở Y tế',
  ngayHetHanGCNDuoc: vnDate(500),
});

describe('Phiếu nhập hàng và thanh toán NCC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: Tokens;
  const http = () => request(app.getHttpServer());
  const as = (user: string) => bearer(tokens, user);

  let nccId: string;
  let hangId: string;
  let lanhId: string;
  let viTriA: string;
  let viTriLanh: string;
  let xeThuong: string;
  let xeLanh: string;

  const line = (over: Record<string, unknown> = {}) => ({
    soLo: {
      hangHoaId: hangId,
      tenLo: `L${Math.random()}`,
      hanSuDung: vnDate(400),
    },
    viTriId: viTriA,
    donViTinh: 'hộp',
    soLuong: 10,
    donGia: '100000',
    ...over,
  });
  const newReceipt = async (
    chiTiet: unknown[] = [line()],
    extra: Record<string, unknown> = {},
    user = 'kho',
  ): Promise<PhieuBody> =>
    (
      await http()
        .post('/api/v1/phieu-nhap-hang')
        .set(as(user))
        .send({ nhaCungCapId: nccId, chiTiet, ...extra })
        .expect(201)
    ).body as PhieuBody;
  const confirm = (id: string, user = 'quanly') =>
    http()
      .post(`/api/v1/phieu-nhap-hang/${id}/xac-nhan`)
      .set(as(user))
      .send({});
  const cancel = (id: string, user = 'quanly', lyDo = 'nhập nhầm') =>
    http()
      .post(`/api/v1/phieu-nhap-hang/${id}/huy`)
      .set(as(user))
      .send({ lyDo });
  const pay = (phieuNhapHangId: string, soTien: string, user = 'ketoan') =>
    http()
      .post('/api/v1/phieu-thanh-toan')
      .set(as(user))
      .send({
        phieuNhapHangId,
        soTien,
        ngayThanhToan: vnDate(0),
        phuongThuc: 'chuyen_khoan',
      });
  const stock = async (soLoId: string, viTriId = viTriA) =>
    (await prisma.tonKho.findFirst({ where: { soLoId, viTriId } }))?.soLuong ??
    0;
  const receiptBody = async (id: string) =>
    (
      await http()
        .get(`/api/v1/phieu-nhap-hang/${id}`)
        .set(as('ketoan'))
        .expect(200)
    ).body as PhieuBody;

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
        .send({ tenNCC: 'NCC Chuẩn', ...license() })
        .expect(201)
    ).body as Id;
    await http()
      .post(`/api/v1/nha-cung-cap/${ncc.id}/xac-minh`)
      .set(as('quanly'))
      .send({ ketQua: 'da_xac_minh' })
      .expect(200);
    nccId = ncc.id;

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
        .send({ tenKho: 'Kho M5' })
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
    viTriLanh = await vt('Lạnh', true);
    const xe = async (bienSo: string, isXeLanh: boolean) =>
      (
        await http()
          .post('/api/v1/phuong-tien-van-chuyen')
          .set(as('quanly'))
          .send({ bienSo, isXeLanh })
          .expect(201)
      ).body.id as string;
    xeThuong = await xe('51C-111.11', false);
    xeLanh = await xe('51C-222.22', true);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('lập phiếu nháp', () => {
    it('tạo phiếu: mã PN…, dòng -01 -02, quy đổi hộp ×100, thành tiền chuỗi 2 số, tồn chưa đổi', async () => {
      const receipt = await newReceipt([
        line({ soLuong: 3, donGia: '90000' }),
        line({ donViTinh: 'viên', soLuong: 5, donGia: '1000.5' }),
      ]);
      expect(receipt.maPhieuNhapHang).toMatch(/^PN\d{6}\d{4}$/);
      expect(receipt.trangThai).toBe('cho_xac_nhan');
      expect(receipt.chiTiet.map((c) => c.maChiTietPhieuNhapHang)).toEqual([
        `${receipt.maPhieuNhapHang}-01`,
        `${receipt.maPhieuNhapHang}-02`,
      ]);
      expect(receipt.chiTiet[0]).toMatchObject({
        soLuongCoBan: 300,
        thanhTien: '270000.00',
        donGia: '90000.00',
      });
      expect(receipt.tongTien).toBe('275002.50');
      expect(receipt.conNo).toBe('0.00');
      expect(await stock(receipt.chiTiet[0]!.soLo.id)).toBe(0);
    });

    it('phiếu rỗng được phép; xác nhận phiếu rỗng → 422 PHIEU_NHAP_EMPTY', async () => {
      const empty = await newReceipt([]);
      const res = await confirm(empty.id);
      expect(res.status).toBe(422);
      expect((res.body as ErrorBody).code).toBe('PHIEU_NHAP_EMPTY');
    });

    it.each([
      ['NCC chưa xác minh', 'ncc', 422, 'NHA_CUNG_CAP_NOT_VERIFIED'],
      ['lô hết hạn', 'expired', 422, 'SO_LO_EXPIRED'],
      ['đơn vị lạ', 'unit', 422, 'PHIEU_NHAP_UNIT_INVALID'],
      [
        'hàng lạnh vào vị trí thường',
        'cold',
        422,
        'TON_KHO_COLD_CHAIN_VIOLATION',
      ],
      ['xe thường chở hàng lạnh', 'coldTruck', 422, 'PHUONG_TIEN_NOT_COLD'],
      ['cả soLoId lẫn soLo', 'xor', 400, 'VALIDATION_FAILED'],
      ['trùng lô và vị trí', 'dup', 422, 'PHIEU_NHAP_DUPLICATE_LINE'],
      ['quy đổi tràn Int', 'overflow', 400, 'VALIDATION_FAILED'],
    ])('%s → %i %s', async (_name, kind, status, code) => {
      const sameLot = {
        hangHoaId: hangId,
        tenLo: 'SAMELOT',
        hanSuDung: vnDate(400),
      };
      const cold = {
        hangHoaId: lanhId,
        tenLo: `C${Math.random()}`,
        hanSuDung: vnDate(400),
      };
      let body: Record<string, unknown> = {
        nhaCungCapId: nccId,
        chiTiet: [line()],
      };
      if (kind === 'ncc') {
        const raw = (
          await http()
            .post('/api/v1/nha-cung-cap')
            .set(as('ketoan'))
            .send({ tenNCC: 'Chưa duyệt' })
        ).body as Id;
        body = { nhaCungCapId: raw.id, chiTiet: [line()] };
      }
      if (kind === 'expired')
        body.chiTiet = [
          line({ soLo: { ...sameLot, tenLo: 'EXP', hanSuDung: vnDate(-1) } }),
        ];
      if (kind === 'unit') body.chiTiet = [line({ donViTinh: 'thùng' })];
      if (kind === 'cold') body.chiTiet = [line({ soLo: cold })];
      if (kind === 'coldTruck')
        body = {
          ...body,
          phuongTienVanChuyenId: xeThuong,
          chiTiet: [line({ soLo: cold, viTriId: viTriLanh })],
        };
      if (kind === 'xor')
        body.chiTiet = [
          line({ soLoId: '00000000-0000-4000-8000-000000000000' }),
        ];
      if (kind === 'dup')
        body.chiTiet = [line({ soLo: sameLot }), line({ soLo: sameLot })];
      if (kind === 'overflow')
        body.chiTiet = [line({ soLuong: 2_000_000_000 })];
      const res = await http()
        .post('/api/v1/phieu-nhap-hang')
        .set(as('kho'))
        .send(body);
      expect(res.status).toBe(status);
      expect((res.body as ErrorBody).code).toBe(code);
    });

    it('soLo mới trùng (hàng, tên lô) nhưng hạn khác → SO_LO_DATE_INVALID', async () => {
      const first = {
        hangHoaId: hangId,
        tenLo: 'DATE-X',
        hanSuDung: vnDate(400),
      };
      await newReceipt([line({ soLo: first })]);
      const res = await http()
        .post('/api/v1/phieu-nhap-hang')
        .set(as('kho'))
        .send({
          nhaCungCapId: nccId,
          chiTiet: [line({ soLo: { ...first, hanSuDung: vnDate(401) } })],
        });
      expect(res.status).toBe(422);
      expect((res.body as ErrorBody).code).toBe('SO_LO_DATE_INVALID');
    });

    it('quá 200 dòng → 400; KẾ TOÁN không được lập → 403; không token → 401', async () => {
      const many = Array.from({ length: 201 }, () => line());
      await http()
        .post('/api/v1/phieu-nhap-hang')
        .set(as('kho'))
        .send({ nhaCungCapId: nccId, chiTiet: many })
        .expect(400);
      await http()
        .post('/api/v1/phieu-nhap-hang')
        .set(as('ketoan'))
        .send({ nhaCungCapId: nccId })
        .expect(403);
      await http().get('/api/v1/phieu-nhap-hang').expect(401);
    });

    it('sửa nháp: đổi ghi chú giữ dòng; gửi chiTiet thay toàn bộ dòng; xóa nháp dọn lô mồ côi', async () => {
      const receipt = await newReceipt([line()]);
      const noteOnly = (
        await http()
          .patch(`/api/v1/phieu-nhap-hang/${receipt.id}`)
          .set(as('kho'))
          .send({ ghiChu: 'giao sáng' })
          .expect(200)
      ).body as PhieuBody;
      expect(noteOnly.chiTiet.map((c) => c.soLo.id)).toEqual(
        receipt.chiTiet.map((c) => c.soLo.id),
      );

      const replaced = (
        await http()
          .patch(`/api/v1/phieu-nhap-hang/${receipt.id}`)
          .set(as('kho'))
          .send({ chiTiet: [line({ soLuong: 1 }), line({ soLuong: 2 })] })
          .expect(200)
      ).body as PhieuBody;
      expect(replaced.chiTiet).toHaveLength(2);

      const lotIds = replaced.chiTiet.map((c) => c.soLo.id);
      await http()
        .delete(`/api/v1/phieu-nhap-hang/${receipt.id}`)
        .set(as('kho'))
        .expect(204);
      expect(await prisma.soLo.count({ where: { id: { in: lotIds } } })).toBe(
        0,
      );
      await http()
        .get(`/api/v1/phieu-nhap-hang/${receipt.id}`)
        .set(as('kho'))
        .expect(404);
    });
  });

  describe('xác nhận nhập kho', () => {
    it('tăng tồn đúng đơn vị cơ bản, sổ biến động nhap_kho, đối soát không lệch', async () => {
      const receipt = await newReceipt([line({ soLuong: 3 })]);
      const lot = receipt.chiTiet[0]!.soLo.id;
      const done = (await confirm(receipt.id).expect(200)).body as PhieuBody;
      expect(done.trangThai).toBe('da_nhap_kho');
      expect(done.conNo).toBe('300000.00');
      expect(done.trangThaiThanhToan).toBe('chua_thanh_toan');
      expect(await stock(lot)).toBe(300);

      const log = await http()
        .get(`/api/v1/ton-kho/bien-dong?soLoId=${lot}`)
        .set(as('ketoan'))
        .expect(200);
      expect(
        (log.body as Page<{ loai: string; thamChieu: { id: string } }>).items,
      ).toMatchObject([{ loai: 'nhap_kho', thamChieu: { id: receipt.id } }]);
      const recon = await http()
        .get('/api/v1/ton-kho/doi-soat')
        .set(as('admin'))
        .expect(200);
      expect(recon.body).toMatchObject({ soDongLech: 0 });
    });

    it('nhân viên kho không xác nhận được (403); xác nhận lần hai → 409, tồn không gấp đôi', async () => {
      const receipt = await newReceipt([line({ soLuong: 1 })]);
      await confirm(receipt.id, 'kho').expect(403);
      await confirm(receipt.id).expect(200);
      const again = await confirm(receipt.id);
      expect(again.status).toBe(409);
      expect((again.body as ErrorBody).code).toBe('PHIEU_NHAP_INVALID_STATE');
      expect(await stock(receipt.chiTiet[0]!.soLo.id)).toBe(100);
    });

    it('hai xác nhận đồng thời → đúng một thành công', async () => {
      const receipt = await newReceipt([line({ soLuong: 2 })]);
      const results = await Promise.all([
        confirm(receipt.id),
        confirm(receipt.id),
      ]);
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        200, 409,
      ]);
      expect(await stock(receipt.chiTiet[0]!.soLo.id)).toBe(200);
    });

    it('ngày nhận ở tương lai → 422; lô hết hạn sau khi lập → rollback hoàn toàn', async () => {
      const receipt = await newReceipt([line(), line()]);
      const future = await http()
        .post(`/api/v1/phieu-nhap-hang/${receipt.id}/xac-nhan`)
        .set(as('quanly'))
        .send({ ngayNhanHang: vnDate(3) });
      expect((future.body as ErrorBody).code).toBe('PHIEU_NHAP_DATE_INVALID');

      const second = receipt.chiTiet[1]!.soLo.id;
      await prisma.soLo.update({
        where: { id: second },
        data: { hanSuDung: new Date(`${vnDate(-1)}T00:00:00Z`) },
      });
      const res = await confirm(receipt.id);
      expect(res.status).toBe(422);
      expect((res.body as ErrorBody).code).toBe('SO_LO_EXPIRED');
      expect(await stock(receipt.chiTiet[0]!.soLo.id)).toBe(0);
      expect((await receiptBody(receipt.id)).trangThai).toBe('cho_xac_nhan');
    });

    it('hàng lạnh vào vị trí cấp đông với xe lạnh → thành công', async () => {
      const receipt = await newReceipt(
        [
          line({
            soLo: {
              hangHoaId: lanhId,
              tenLo: `V${Math.random()}`,
              hanSuDung: vnDate(300),
            },
            viTriId: viTriLanh,
          }),
        ],
        { phuongTienVanChuyenId: xeLanh },
      );
      await confirm(receipt.id).expect(200);
    });
  });

  describe('hủy phiếu', () => {
    it('hủy nháp (kể cả NVK) không đụng tồn; hủy lần hai → 409; thiếu lý do → 400', async () => {
      const receipt = await newReceipt([line()]);
      const res = await cancel(receipt.id, 'kho');
      expect(res.status).toBe(200);
      expect((res.body as PhieuBody).trangThai).toBe('da_huy');
      const again = await cancel(receipt.id);
      expect((again.body as ErrorBody).code).toBe('PHIEU_NHAP_INVALID_STATE');
      await http()
        .post(`/api/v1/phieu-nhap-hang/${receipt.id}/huy`)
        .set(as('quanly'))
        .send({})
        .expect(400);
    });

    it('hủy phiếu đã nhập: NVK 403; quản lý 200, tồn về 0 với dòng huy_nhap', async () => {
      const receipt = await newReceipt([line({ soLuong: 2 })]);
      const lot = receipt.chiTiet[0]!.soLo.id;
      await confirm(receipt.id).expect(200);
      await cancel(receipt.id, 'kho').expect(403);
      expect(await stock(lot)).toBe(200);
      await cancel(receipt.id).expect(200);
      expect(await stock(lot)).toBe(0);
      expect(
        await prisma.bienDongTonKho.count({
          where: { soLoId: lot, loai: 'huy_nhap' },
        }),
      ).toBe(1);
      expect(
        await prisma.nhatKyHeThong.count({
          where: {
            hanhDong: 'phieu_nhap.cancel_after_receipt',
            doiTuongId: receipt.id,
          },
        }),
      ).toBe(1);
    });

    it('một phần hàng đã chuyển đi → 409 PHIEU_NHAP_CANNOT_REVERSE và rollback toàn bộ', async () => {
      const receipt = await newReceipt([
        line({ soLuong: 1 }),
        line({ soLuong: 1 }),
      ]);
      await confirm(receipt.id).expect(200);
      const [a, b] = receipt.chiTiet.map((c) => c.soLo.id) as [string, string];
      await http()
        .post('/api/v1/ton-kho/dieu-chinh')
        .set(as('quanly'))
        .send({
          soLoId: b,
          viTriId: viTriA,
          soLuongMoi: 50,
          lyDo: 'đã xuất bớt',
        })
        .expect(201);
      const res = await cancel(receipt.id);
      expect(res.status).toBe(409);
      expect((res.body as ErrorBody).code).toBe('PHIEU_NHAP_CANNOT_REVERSE');
      expect(await stock(a)).toBe(100);
      expect((await receiptBody(receipt.id)).trangThai).toBe('da_nhap_kho');
    });
  });

  describe('thanh toán', () => {
    it('luồng: 1.000.000 → trả 400.000 → 600.000 → thêm 1 đồng bị từ chối', async () => {
      const receipt = await newReceipt([
        line({ soLuong: 10, donGia: '100000' }),
      ]);
      await confirm(receipt.id).expect(200);

      const first = await pay(receipt.id, '400000').expect(201);
      expect((first.body as PaymentBody).phieuNhap.conNoSauKhiTra).toBe(
        '600000.00',
      );
      expect((await receiptBody(receipt.id)).trangThaiThanhToan).toBe(
        'thanh_toan_mot_phan',
      );

      await pay(receipt.id, '600000').expect(201);
      const settled = await receiptBody(receipt.id);
      expect(settled).toMatchObject({
        conNo: '0.00',
        trangThaiThanhToan: 'da_thanh_toan',
      });

      const over = await pay(receipt.id, '1');
      expect(over.status).toBe(422);
      expect((over.body as ErrorBody).code).toBe(
        'PHIEU_THANH_TOAN_EXCEEDS_DEBT',
      );
    });

    it('hủy một khoản → nợ tăng lại; hủy lần hai → 409; hủy phiếu nhập bị chặn đến khi hủy thanh toán', async () => {
      const receipt = await newReceipt([
        line({ soLuong: 1, donGia: '100000' }),
      ]);
      await confirm(receipt.id).expect(200);
      const payment = (await pay(receipt.id, '30000').expect(201))
        .body as PaymentBody;

      const blocked = await cancel(receipt.id);
      expect(blocked.status).toBe(409);
      expect((blocked.body as ErrorBody).code).toBe(
        'PHIEU_NHAP_CANNOT_REVERSE',
      );

      const voidPay = () =>
        http()
          .post(`/api/v1/phieu-thanh-toan/${payment.id}/huy`)
          .set(as('ketoan'))
          .send({ lyDo: 'sai số tiền' });
      expect(((await voidPay().expect(200)).body as PaymentBody).daHuy).toBe(
        true,
      );
      expect((await voidPay()).status).toBe(409);
      expect((await receiptBody(receipt.id)).conNo).toBe('100000.00');
      await cancel(receipt.id).expect(200);
    });

    it('phiếu nháp / phiếu đã hủy → 409; phiếu nhập không có → 404; số tiền, ngày sai', async () => {
      const draft = await newReceipt([line()]);
      const res = await pay(draft.id, '1000');
      expect((res.body as ErrorBody).code).toBe(
        'PHIEU_THANH_TOAN_RECEIPT_INVALID_STATE',
      );
      expect(
        (await pay('00000000-0000-4000-8000-000000000000', '1')).status,
      ).toBe(404);

      const receipt = await newReceipt([line({ soLuong: 1 })]);
      await confirm(receipt.id).expect(200);
      const bad = (soTien: string, ngayThanhToan: string) =>
        http().post('/api/v1/phieu-thanh-toan').set(as('ketoan')).send({
          phieuNhapHangId: receipt.id,
          soTien,
          ngayThanhToan,
          phuongThuc: 'tien_mat',
        });
      expect((await bad('0', vnDate(0))).status).toBe(400);
      expect((await bad('10.123', vnDate(0))).status).toBe(400);
      expect(((await bad('10', vnDate(2))).body as ErrorBody).code).toBe(
        'PHIEU_THANH_TOAN_DATE_INVALID',
      );
      expect(((await bad('10', vnDate(-30))).body as ErrorBody).code).toBe(
        'PHIEU_THANH_TOAN_DATE_INVALID',
      );
    });

    it('hai thanh toán đồng thời cùng trả hết nợ → một 201, một 422', async () => {
      const receipt = await newReceipt([line({ soLuong: 1, donGia: '50000' })]);
      await confirm(receipt.id).expect(200);
      const results = await Promise.all([
        pay(receipt.id, '50000'),
        pay(receipt.id, '50000'),
      ]);
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        201, 422,
      ]);
      expect((await receiptBody(receipt.id)).conNo).toBe('0.00');
    });

    it('công nợ NCC khớp tổng các phiếu; chiConNo=false hiện cả phiếu đã trả hết', async () => {
      const debt = await http()
        .get(`/api/v1/nha-cung-cap/${nccId}/cong-no`)
        .set(as('quanly'))
        .expect(200);
      const body = debt.body as {
        conNo: string;
        phieuConNo: { conNo: string; soNgayNo: number }[];
      };
      const sum = body.phieuConNo.reduce((s, p) => s + Number(p.conNo), 0);
      expect(Number(body.conNo)).toBeCloseTo(sum, 2);
      expect(body.phieuConNo.every((p) => Number(p.conNo) > 0)).toBe(true);
      const all = await http()
        .get(`/api/v1/nha-cung-cap/${nccId}/cong-no?chiConNo=false`)
        .set(as('quanly'))
        .expect(200);
      expect((all.body as typeof body).phieuConNo.length).toBeGreaterThan(
        body.phieuConNo.length,
      );
    });

    it('ma trận role: NVK không đọc/ghi thanh toán, QL chỉ đọc, kế toán và admin ghi', async () => {
      await http().get('/api/v1/phieu-thanh-toan').set(as('kho')).expect(403);
      await http()
        .get('/api/v1/phieu-thanh-toan')
        .set(as('quanly'))
        .expect(200);
      const receipt = await newReceipt([line({ soLuong: 1 })]);
      await confirm(receipt.id).expect(200);
      await pay(receipt.id, '1000', 'quanly').expect(403);
      await pay(receipt.id, '1000', 'admin').expect(201);
      await http()
        .get(`/api/v1/nha-cung-cap/${nccId}/cong-no`)
        .set(as('kho'))
        .expect(403);
    });
  });

  describe('danh sách và lọc', () => {
    it('lọc theo trạng thái (nhiều giá trị), trạng thái thanh toán, NCC, hàng hóa, khoảng ngày', async () => {
      const list = async (qs: string) =>
        (
          await http()
            .get(`/api/v1/phieu-nhap-hang?${qs}`)
            .set(as('ketoan'))
            .expect(200)
        ).body as Page<PhieuBody>;
      const all = await list('pageSize=100');
      expect(all.meta.total).toBeGreaterThan(5);
      const received = await list('trangThai=da_nhap_kho,da_huy&pageSize=100');
      expect(received.items.every((p) => p.trangThai !== 'cho_xac_nhan')).toBe(
        true,
      );
      const partly = await list('trangThaiThanhToan=thanh_toan_mot_phan');
      expect(
        partly.items.every(
          (p) => p.trangThaiThanhToan === 'thanh_toan_mot_phan',
        ),
      ).toBe(true);
      const unpaid = await list('trangThaiThanhToan=chua_thanh_toan');
      expect(
        unpaid.items.every((p) => p.trangThaiThanhToan === 'chua_thanh_toan'),
      ).toBe(true);
      expect((await list(`nhaCungCapId=${nccId}`)).meta.total).toBe(
        all.meta.total,
      );
      expect((await list(`hangHoaId=${lanhId}`)).meta.total).toBeGreaterThan(0);
      expect(
        (await list(`createdAtFrom=${vnDate(1)}&createdAtTo=${vnDate(2)}`)).meta
          .total,
      ).toBe(0);
      await http()
        .get('/api/v1/phieu-nhap-hang?sort=ghiChu:asc')
        .set(as('ketoan'))
        .expect(400);
    });
  });
});
