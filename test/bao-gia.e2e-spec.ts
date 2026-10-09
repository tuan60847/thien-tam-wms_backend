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
}
interface QuoteBody {
  id: string;
  maBaoGia: string;
  ngayBaoGia: string;
  hanHieuLuc: string | null;
  conHieuLuc: boolean;
  daChuyenPhieuXuat: boolean;
  soDong: number;
  tongTienHang: string;
  tienChietKhau: string;
  tienThueGtgt: string;
  tongThanhToan: string;
  chiTiet: { id: string; hangHoa: Id; thanhTien: string }[];
  phieuXuats: { id: string; trangThai: string }[];
}
interface OrderBody {
  id: string;
  baoGiaId: string | null;
  trangThai: string;
  thamChieu: string | null;
  tongTien: string;
  tienChietKhau: string;
  tienThueGtgt: string;
  chiTiet: { donGia: string; soLuong: number; soLo: Id }[];
}

describe('Báo giá (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: Tokens;
  const http = () => request(app.getHttpServer());
  const as = (user: string) => bearer(tokens, user);

  let khachId: string;
  let hangId: string;
  let hang2Id: string;
  let viTriA: string;

  const stockLot = async (hangHoaId: string, hop: number): Promise<string> => {
    const created = await http()
      .post('/api/v1/phieu-nhap-hang')
      .set(as('kho'))
      .send({
        nhaCungCapId: (await prisma.nhaCungCap.findFirstOrThrow()).id,
        chiTiet: [
          {
            soLo: {
              hangHoaId,
              tenLo: `L${Math.random()}`,
              hanSuDung: vnDate(300),
            },
            viTriId: viTriA,
            donViTinh: 'hộp',
            soLuong: hop,
            donGia: '90000',
          },
        ],
      })
      .expect(201);
    const receipt = created.body as { id: string; chiTiet: { soLo: Id }[] };
    await http()
      .post(`/api/v1/phieu-nhap-hang/${receipt.id}/xac-nhan`)
      .set(as('quanly'))
      .send({})
      .expect(200);
    return receipt.chiTiet[0]!.soLo.id;
  };

  const quoteLine = (
    hangHoaId: string,
    over: Record<string, unknown> = {},
  ) => ({
    hangHoaId,
    donViTinh: 'hộp',
    soLuong: 3,
    donGia: '125000',
    ...over,
  });
  const newQuote = async (
    chiTiet: unknown[],
    extra: Record<string, unknown> = {},
  ): Promise<QuoteBody> =>
    (
      await http()
        .post('/api/v1/bao-gia')
        .set(as('kho'))
        .send({ khachHangId: khachId, chiTiet, ...extra })
        .expect(201)
    ).body as QuoteBody;
  const getQuote = async (id: string) =>
    (await http().get(`/api/v1/bao-gia/${id}`).set(as('ketoan')).expect(200))
      .body as QuoteBody;
  const convert = (id: string, phanBo: unknown[], extra = {}) =>
    http()
      .post(`/api/v1/bao-gia/${id}/chuyen-phieu-xuat`)
      .set(as('kho'))
      .send({ phanBo, ...extra });

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
    ).body as Id;
    await http()
      .post(`/api/v1/nha-cung-cap/${ncc.id}/xac-minh`)
      .set(as('quanly'))
      .send({ ketQua: 'da_xac_minh' })
      .expect(200);
    khachId = (
      (
        await http()
          .post('/api/v1/khach-hang')
          .set(as('ketoan'))
          .send({
            tenKH: 'Nhà thuốc A',
            diaChi: '12 Lê Lợi',
            ngayHetHanGPKD: vnDate(400),
          })
          .expect(201)
      ).body as Id
    ).id;

    const loai = await createLoaiHang(app, tokens, 'Thuốc');
    hangId = (await createHangHoa(app, tokens, loai.id)).id;
    hang2Id = (
      await createHangHoa(app, tokens, loai.id, { tenSP: 'Vitamin C' })
    ).id;
    const khoId = (
      await http()
        .post('/api/v1/kho')
        .set(as('quanly'))
        .send({ tenKho: 'Kho BG' })
        .expect(201)
    ).body.id as string;
    viTriA = (
      await http()
        .post('/api/v1/vi-tri')
        .set(as('quanly'))
        .send({ khoId, tenViTri: 'A1', isCapDong: false })
        .expect(201)
    ).body.id as string;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('lập và đọc', () => {
    it('tính tổng như phiếu xuất: chiết khấu trên tiền hàng, thuế trên số sau chiết khấu', async () => {
      const q = await newQuote(
        [
          quoteLine(hangId, {
            soLuong: 2,
            tyLeChietKhau: '10',
            thueSuatGtgt: '8',
          }),
          quoteLine(hang2Id, { soLuong: 1, donGia: '50000' }),
        ],
        { hanHieuLuc: vnDate(30), ghiChu: 'Giá đợt 10' },
      );
      expect(q.maBaoGia).toMatch(/^BG\d{6}\d{4}$/);
      expect(q.ngayBaoGia).toBe(vnDate(0));
      expect(q.soDong).toBe(2);
      expect(q.tongTienHang).toBe('300000.00');
      expect(q.tienChietKhau).toBe('25000.00');
      expect(q.tienThueGtgt).toBe('18000.00');
      expect(q.tongThanhToan).toBe('293000.00');
      expect(q.conHieuLuc).toBe(true);
      expect(q.daChuyenPhieuXuat).toBe(false);

      const detail = await getQuote(q.id);
      expect(detail.chiTiet).toHaveLength(2);
      expect(detail.tongThanhToan).toBe('293000.00');
    });

    it('danh sách lọc theo khách, hiệu lực và tìm kiếm', async () => {
      const expired = await newQuote([quoteLine(hangId)], {
        ngayBaoGia: vnDate(-10),
        hanHieuLuc: vnDate(-1),
      });
      expect(expired.conHieuLuc).toBe(false);

      const lapsed = (
        await http()
          .get('/api/v1/bao-gia?conHieuLuc=false')
          .set(as('ketoan'))
          .expect(200)
      ).body as Page<QuoteBody>;
      expect(lapsed.items.map((i) => i.id)).toContain(expired.id);
      expect(lapsed.items.every((i) => !i.conHieuLuc)).toBe(true);

      const valid = (
        await http()
          .get('/api/v1/bao-gia?conHieuLuc=true')
          .set(as('ketoan'))
          .expect(200)
      ).body as Page<QuoteBody>;
      expect(valid.items.map((i) => i.id)).not.toContain(expired.id);

      const search = (
        await http()
          .get(`/api/v1/bao-gia?q=${expired.maBaoGia}`)
          .set(as('ketoan'))
          .expect(200)
      ).body as Page<QuoteBody>;
      expect(search.meta.total).toBe(1);
    });
  });

  describe('kiểm tra dữ liệu và phân quyền', () => {
    it('từ chối đơn vị lạ, hạn trước ngày báo giá, báo giá rỗng, khách không có', async () => {
      const err = async (body: Record<string, unknown>, status: number) =>
        (
          await http()
            .post('/api/v1/bao-gia')
            .set(as('kho'))
            .send({
              khachHangId: khachId,
              chiTiet: [quoteLine(hangId)],
              ...body,
            })
            .expect(status)
        ).body as ErrorBody;

      expect(
        (
          await err(
            { chiTiet: [quoteLine(hangId, { donViTinh: 'thùng' })] },
            422,
          )
        ).code,
      ).toBe('BAO_GIA_UNIT_INVALID');
      expect(
        (await err({ ngayBaoGia: vnDate(0), hanHieuLuc: vnDate(-1) }, 422))
          .code,
      ).toBe('BAO_GIA_DATE_INVALID');
      await err({ chiTiet: [] }, 400);
      expect(
        (
          await err(
            { khachHangId: '00000000-0000-4000-8000-000000000000' },
            404,
          )
        ).code,
      ).toBe('KHACH_HANG_NOT_FOUND');
    });

    it('kế toán chỉ xem; người chưa đăng nhập bị chặn', async () => {
      await http()
        .post('/api/v1/bao-gia')
        .set(as('ketoan'))
        .send({ khachHangId: khachId, chiTiet: [quoteLine(hangId)] })
        .expect(403);
      await http().get('/api/v1/bao-gia').expect(401);
    });
  });

  describe('sửa và xóa', () => {
    it('sửa thay toàn bộ dòng và đổi hạn; xóa được khi chưa chuyển', async () => {
      const q = await newQuote([quoteLine(hangId)]);
      const updated = (
        await http()
          .patch(`/api/v1/bao-gia/${q.id}`)
          .set(as('kho'))
          .send({
            chiTiet: [quoteLine(hang2Id, { soLuong: 4, donGia: '10000' })],
            hanHieuLuc: vnDate(5),
          })
          .expect(200)
      ).body as QuoteBody;
      expect(updated.soDong).toBe(1);
      expect(updated.tongThanhToan).toBe('40000.00');
      expect(updated.hanHieuLuc).toBe(vnDate(5));
      expect(updated.chiTiet[0]!.hangHoa.id).toBe(hang2Id);

      await http()
        .patch(`/api/v1/bao-gia/${q.id}`)
        .set(as('kho'))
        .send({ hanHieuLuc: vnDate(-3) })
        .expect(422);

      await http().delete(`/api/v1/bao-gia/${q.id}`).set(as('kho')).expect(204);
      await http().get(`/api/v1/bao-gia/${q.id}`).set(as('kho')).expect(404);
    });
  });

  describe('chuyển thành phiếu xuất', () => {
    it('tạo phiếu nháp theo giá báo giá; chặn chuyển lần hai, sửa và xóa; hủy phiếu thì chuyển lại được', async () => {
      const lot = await stockLot(hangId, 5);
      const q = await newQuote([
        quoteLine(hangId, {
          soLuong: 3,
          tyLeChietKhau: '10',
          thueSuatGtgt: '8',
        }),
      ]);
      const lineId = q.chiTiet[0]!.id;
      const alloc = (soLuong: number, soLoId = lot) => ({
        chiTietBaoGiaId: lineId,
        soLoId,
        viTriId: viTriA,
        soLuong,
      });

      // Must cover the quantity exactly.
      const short = await convert(q.id, [alloc(2)]).expect(422);
      expect((short.body as ErrorBody).code).toBe('BAO_GIA_ALLOCATION_INVALID');
      await convert(q.id, [alloc(4)]).expect(422);

      // A lot of another product cannot fill the line.
      const other = await stockLot(hang2Id, 1);
      const wrong = await convert(q.id, [alloc(3, other)]).expect(422);
      expect((wrong.body as ErrorBody).code).toBe('BAO_GIA_ALLOCATION_INVALID');

      const order = (
        await convert(q.id, [alloc(3)], { ghiChu: 'Giao sáng' }).expect(201)
      ).body as OrderBody;
      expect(order.trangThai).toBe('cho_xu_ly');
      expect(order.baoGiaId).toBe(q.id);
      expect(order.thamChieu).toBe(q.maBaoGia);
      expect(order.chiTiet[0]).toMatchObject({
        donGia: '125000.00',
        soLuong: 3,
      });
      // 3 × 125000 = 375000; discount 37500; VAT 8% of 337500 = 27000.
      expect(order.tienChietKhau).toBe('37500.00');
      expect(order.tienThueGtgt).toBe('27000.00');
      expect(order.tongTien).toBe('364500.00');

      const after = await getQuote(q.id);
      expect(after.daChuyenPhieuXuat).toBe(true);
      expect(after.phieuXuats.map((p) => p.id)).toEqual([order.id]);

      const again = await convert(q.id, [alloc(3)]).expect(409);
      expect((again.body as ErrorBody).code).toBe('BAO_GIA_ALREADY_CONVERTED');
      await http()
        .patch(`/api/v1/bao-gia/${q.id}`)
        .set(as('kho'))
        .send({ ghiChu: 'x' })
        .expect(409);
      await http().delete(`/api/v1/bao-gia/${q.id}`).set(as('kho')).expect(409);

      const converted = (
        await http()
          .get('/api/v1/bao-gia?daChuyenPhieuXuat=true')
          .set(as('ketoan'))
          .expect(200)
      ).body as Page<QuoteBody>;
      expect(converted.items.map((i) => i.id)).toContain(q.id);

      // Cancelling the order frees the quote for a new conversion, but the link stays.
      await http()
        .post(`/api/v1/phieu-xuat-hang/${order.id}/huy`)
        .set(as('quanly'))
        .send({ lyDo: 'khách đổi ý' })
        .expect(200);
      expect((await getQuote(q.id)).daChuyenPhieuXuat).toBe(false);
      await http().delete(`/api/v1/bao-gia/${q.id}`).set(as('kho')).expect(409);
      await convert(q.id, [alloc(3)]).expect(201);
    });

    it('chia một dòng ra nhiều lô; báo giá hết hạn không chuyển được', async () => {
      const lot1 = await stockLot(hangId, 2);
      const lot2 = await stockLot(hangId, 2);
      const q = await newQuote([quoteLine(hangId, { soLuong: 3 })]);
      const lineId = q.chiTiet[0]!.id;
      const part = (soLoId: string, soLuong: number) => ({
        chiTietBaoGiaId: lineId,
        soLoId,
        viTriId: viTriA,
        soLuong,
      });
      const order = (
        await convert(q.id, [part(lot1, 2), part(lot2, 1)]).expect(201)
      ).body as OrderBody;
      expect(order.chiTiet.map((l) => l.soLuong).sort((a, b) => a - b)).toEqual(
        [1, 2],
      );

      const old = await newQuote([quoteLine(hangId)], {
        ngayBaoGia: vnDate(-10),
        hanHieuLuc: vnDate(-1),
      });
      const res = await convert(old.id, [
        {
          chiTietBaoGiaId: old.chiTiet[0]!.id,
          soLoId: lot1,
          viTriId: viTriA,
          soLuong: 3,
        },
      ]).expect(422);
      expect((res.body as ErrorBody).code).toBe('BAO_GIA_EXPIRED');
    });
  });
});
