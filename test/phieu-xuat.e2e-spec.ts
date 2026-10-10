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
interface OrderBody {
  id: string;
  hinhThucThanhToan: string;
  maPhieuXuatHang: string;
  trangThai: string;
  diaChiGiaoHang: string | null;
  tongTien: string;
  daThu: string;
  conNo: string;
  trangThaiThu: string | null;
  ngayXuatKho: string | null;
  chiTiet: {
    maChiTietPhieuXuatHang: string;
    soLuongCoBan: number;
    thanhTien: string;
    canhBao: string[];
    soLo: Id;
  }[];
}
interface ReceiptBody {
  id: string;
  daHuy: boolean;
  phieuXuat: { conNoSauKhiThu: string };
}

describe('Phiếu xuất hàng và thu công nợ (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: Tokens;
  const http = () => request(app.getHttpServer());
  const as = (user: string) => bearer(tokens, user);

  let nccId: string;
  let khachId: string;
  let hangId: string;
  let lanhId: string;
  let viTriA: string;
  let viTriB: string;
  let viTriLanh: string;
  let khoId: string;
  let xeThuong: string;

  // Puts `hop` boxes (×100 units) of a product into a location through a real receipt.
  const stockLot = async (
    hanSuDung: string,
    hop: number,
    options: { hangHoaId?: string; viTriId?: string; tenLo?: string } = {},
  ): Promise<string> => {
    const created = await http()
      .post('/api/v1/phieu-nhap-hang')
      .set(as('kho'))
      .send({
        nhaCungCapId: nccId,
        chiTiet: [
          {
            soLo: {
              hangHoaId: options.hangHoaId ?? hangId,
              tenLo: options.tenLo ?? `L${Math.random()}`,
              hanSuDung,
            },
            viTriId: options.viTriId ?? viTriA,
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
  const stock = async (soLoId: string, viTriId = viTriA) =>
    (await prisma.tonKho.findFirst({ where: { soLoId, viTriId } }))?.soLuong ??
    0;

  const line = (soLoId: string, over: Record<string, unknown> = {}) => ({
    soLoId,
    viTriId: viTriA,
    donViTinh: 'hộp',
    soLuong: 1,
    donGia: '125000',
    ...over,
  });
  const orderBody = (
    chiTiet: unknown[],
    extra: Record<string, unknown> = {},
  ) => ({
    khachHangId: khachId,
    chiTiet,
    ...extra,
  });
  const newOrder = async (
    chiTiet: unknown[],
    extra: Record<string, unknown> = {},
    user = 'kho',
  ): Promise<OrderBody> =>
    (
      await http()
        .post('/api/v1/phieu-xuat-hang')
        .set(as(user))
        .send(orderBody(chiTiet, extra))
        .expect(201)
    ).body as OrderBody;
  const issue = (id: string, user = 'kho') =>
    http().post(`/api/v1/phieu-xuat-hang/${id}/xuat-kho`).set(as(user));
  const cancel = (id: string, user = 'quanly', lyDo = 'khách hủy') =>
    http()
      .post(`/api/v1/phieu-xuat-hang/${id}/huy`)
      .set(as(user))
      .send({ lyDo });
  const collect = (
    phieuXuatHangId: string,
    soTien: string,
    user = 'ketoan',
    ngay = vnDate(0),
  ) =>
    http().post('/api/v1/phieu-thu-cong-no').set(as(user)).send({
      phieuXuatHangId,
      soTien,
      ngayThanhToan: ngay,
      phuongThuc: 'tien_mat',
    });
  const getOrder = async (id: string) =>
    (
      await http()
        .get(`/api/v1/phieu-xuat-hang/${id}`)
        .set(as('ketoan'))
        .expect(200)
    ).body as OrderBody;
  const newKhach = async (body: Record<string, unknown>): Promise<Id> =>
    (
      await http()
        .post('/api/v1/khach-hang')
        .set(as('ketoan'))
        .send(body)
        .expect(201)
    ).body as Id;

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
    nccId = ncc.id;
    khachId = (
      await newKhach({
        tenKH: 'Nhà thuốc A',
        diaChi: '12 Lê Lợi',
        ngayHetHanGPKD: vnDate(400),
      })
    ).id;

    const loai = await createLoaiHang(app, tokens, 'Thuốc');
    hangId = (await createHangHoa(app, tokens, loai.id)).id;
    lanhId = (
      await createHangHoa(app, tokens, loai.id, {
        tenSP: 'Vaccine',
        isCanGiuLanh: true,
      })
    ).id;
    khoId = (
      await http()
        .post('/api/v1/kho')
        .set(as('quanly'))
        .send({ tenKho: 'Kho M6' })
        .expect(201)
    ).body.id as string;
    const vt = async (tenViTri: string, isCapDong = false) =>
      (
        await http()
          .post('/api/v1/vi-tri')
          .set(as('quanly'))
          .send({ khoId, tenViTri, isCapDong })
          .expect(201)
      ).body.id as string;
    viTriA = await vt('A1');
    viTriB = await vt('B1');
    viTriLanh = await vt('Lạnh', true);
    xeThuong = (
      await http()
        .post('/api/v1/phuong-tien-van-chuyen')
        .set(as('quanly'))
        .send({ bienSo: '51C-333.33', isXeLanh: false })
        .expect(201)
    ).body.id as string;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('luồng đầy đủ', () => {
    it('gợi ý FEFO → lập phiếu → xuất kho → giao hàng → thu tiền; sổ cái và đối soát khớp', async () => {
      const far = await stockLot(vnDate(400), 5);
      const near = await stockLot(vnDate(60), 2);

      const hint = (
        await http()
          .get(
            `/api/v1/ton-kho/goi-y-xuat?hangHoaId=${hangId}&soLuong=3&donViTinh=hộp`,
          )
          .set(as('kho'))
          .expect(200)
      ).body as { phanBo: { soLoId: string; soLuong: number }[] };
      expect(hint.phanBo.map((p) => [p.soLoId, p.soLuong])).toEqual([
        [near, 200],
        [far, 100],
      ]);

      const order = await newOrder([
        line(near, { soLuong: 2 }),
        line(far, { soLuong: 1 }),
      ]);
      expect(order.maPhieuXuatHang).toMatch(/^PX\d{6}\d{4}$/);
      expect(order.diaChiGiaoHang).toBe('12 Lê Lợi');
      expect(order.chiTiet.map((c) => c.maChiTietPhieuXuatHang)).toEqual([
        `${order.maPhieuXuatHang}-01`,
        `${order.maPhieuXuatHang}-02`,
      ]);
      expect(order.tongTien).toBe('375000.00');
      expect(order.conNo).toBe('0.00');
      expect(await stock(near)).toBe(200);

      const done = (await issue(order.id).expect(200)).body as OrderBody;
      expect(done).toMatchObject({
        trangThai: 'da_xuat_kho',
        conNo: '375000.00',
        trangThaiThu: 'chua_thu',
      });
      expect(done.ngayXuatKho).toBe(vnDate(0));
      expect(await stock(near)).toBe(0);
      expect(await stock(far)).toBe(400);

      const log = await http()
        .get(`/api/v1/ton-kho/bien-dong?soLoId=${near}&loai=xuat_kho`)
        .set(as('ketoan'))
        .expect(200);
      expect(
        (log.body as Page<{ soLuongThayDoi: number }>).items,
      ).toMatchObject([{ soLuongThayDoi: -200 }]);

      const delivered = (
        await http()
          .post(`/api/v1/phieu-xuat-hang/${order.id}/giao-hang`)
          .set(as('kho'))
          .send({})
          .expect(200)
      ).body as OrderBody;
      expect(delivered.trangThai).toBe('da_giao');

      const first = (await collect(order.id, '100000').expect(201))
        .body as ReceiptBody;
      expect(first.phieuXuat.conNoSauKhiThu).toBe('275000.00');
      expect((await getOrder(order.id)).trangThaiThu).toBe('thu_mot_phan');
      await collect(order.id, '275000').expect(201);
      expect(await getOrder(order.id)).toMatchObject({
        conNo: '0.00',
        trangThaiThu: 'da_thu_du',
      });
      expect(((await collect(order.id, '1')).body as ErrorBody).code).toBe(
        'PHIEU_THU_EXCEEDS_DEBT',
      );

      const recon = await http()
        .get('/api/v1/ton-kho/doi-soat')
        .set(as('admin'))
        .expect(200);
      expect(recon.body).toMatchObject({ soDongLech: 0 });
    });
  });

  describe('lập phiếu', () => {
    it('phiếu rỗng được phép; xuất kho phiếu rỗng → 422', async () => {
      const empty = await newOrder([]);
      const res = await issue(empty.id);
      expect(res.status).toBe(422);
      expect((res.body as ErrorBody).code).toBe('PHIEU_XUAT_EMPTY');
    });

    it.each([
      ['lô hết hạn', 'expired', 422, 'SO_LO_EXPIRED'],
      [
        'lô không có tại vị trí',
        'elsewhere',
        422,
        'PHIEU_XUAT_LOT_NOT_AT_LOCATION',
      ],
      ['vượt tồn hiện tại', 'toomuch', 409, 'TON_KHO_INSUFFICIENT'],
      ['đơn vị lạ', 'unit', 422, 'PHIEU_XUAT_UNIT_INVALID'],
      ['trùng lô và vị trí', 'dup', 422, 'PHIEU_XUAT_DUPLICATE_LINE'],
      ['hàng lạnh trên xe thường', 'cold', 422, 'PHUONG_TIEN_NOT_COLD'],
      ['không tìm thấy lô', 'nolot', 404, 'SO_LO_NOT_FOUND'],
    ])('%s → %i %s', async (_name, kind, status, code) => {
      const lot = await stockLot(vnDate(300), 2);
      let body: Record<string, unknown> = orderBody([line(lot)]);
      if (kind === 'expired') {
        const old = await prisma.soLo.create({
          data: {
            tenLo: `OLD${Math.random()}`,
            hangHoaId: hangId,
            hanSuDung: new Date(`${vnDate(-1)}T00:00:00Z`),
          },
        });
        body = orderBody([line(old.id)]);
      }
      if (kind === 'elsewhere')
        body = orderBody([line(lot, { viTriId: viTriB })]);
      if (kind === 'toomuch') body = orderBody([line(lot, { soLuong: 3 })]);
      if (kind === 'unit')
        body = orderBody([line(lot, { donViTinh: 'thùng' })]);
      if (kind === 'dup') body = orderBody([line(lot), line(lot)]);
      if (kind === 'cold') {
        const coldLot = await stockLot(vnDate(300), 1, {
          hangHoaId: lanhId,
          viTriId: viTriLanh,
        });
        body = orderBody([line(coldLot, { viTriId: viTriLanh })], {
          phuongTienVanChuyenId: xeThuong,
        });
      }
      if (kind === 'nolot')
        body = orderBody([line('00000000-0000-4000-8000-000000000000')]);
      const res = await http()
        .post('/api/v1/phieu-xuat-hang')
        .set(as('kho'))
        .send(body);
      expect(res.status).toBe(status);
      expect((res.body as ErrorBody).code).toBe(code);
    });

    it('khách không đủ điều kiện: không tồn tại 404, ngừng hoạt động 422, GPKD hết hạn 422; hết hạn đúng hôm nay vẫn bán được', async () => {
      const lot = await stockLot(vnDate(300), 5);
      const post = (khachHangId: string) =>
        http()
          .post('/api/v1/phieu-xuat-hang')
          .set(as('kho'))
          .send({ khachHangId, chiTiet: [line(lot)] });
      expect((await post('00000000-0000-4000-8000-000000000000')).status).toBe(
        404,
      );

      const off = await newKhach({
        tenKH: 'Ngừng',
        ngayHetHanGPKD: vnDate(400),
      });
      await http()
        .patch(`/api/v1/khach-hang/${off.id}`)
        .set(as('quanly'))
        .send({ trangThai: 'ngung_hoat_dong' })
        .expect(200);
      expect(((await post(off.id)).body as ErrorBody).code).toBe(
        'KHACH_HANG_INACTIVE',
      );

      const expired = await newKhach({
        tenKH: 'Hết hạn',
        ngayHetHanGPKD: vnDate(-1),
      });
      expect(((await post(expired.id)).body as ErrorBody).code).toBe(
        'KHACH_HANG_LICENSE_EXPIRED',
      );
      const today = await newKhach({
        tenKH: 'Hạn hôm nay',
        ngayHetHanGPKD: vnDate(0),
      });
      expect((await post(today.id)).status).toBe(201);
    });

    it('giá tối thiểu: NVK bị chặn, quản lý được kèm nhật ký, bằng đúng mức và đổi theo đơn vị', async () => {
      const lot = await stockLot(vnDate(300), 10);
      const below = await http()
        .post('/api/v1/phieu-xuat-hang')
        .set(as('kho'))
        .send(orderBody([line(lot, { donGia: '99999.99' })]));
      expect(below.status).toBe(422);
      expect((below.body as ErrorBody).code).toBe('PHIEU_XUAT_PRICE_BELOW_MIN');
      expect(JSON.stringify(below.body)).not.toContain('100000');

      await newOrder([line(lot, { donGia: '100000' })]);
      // 1 hộp = 100 viên, giá tối thiểu 100000/hộp => 1000/viên
      await newOrder([
        line(lot, { donViTinh: 'viên', soLuong: 5, donGia: '1000' }),
      ]);
      const lowViên = await http()
        .post('/api/v1/phieu-xuat-hang')
        .set(as('kho'))
        .send(
          orderBody([
            line(lot, { donViTinh: 'viên', soLuong: 5, donGia: '999.99' }),
          ]),
        );
      expect(lowViên.status).toBe(422);

      const manager = await newOrder(
        [line(lot, { donGia: '80000' })],
        {},
        'quanly',
      );
      expect(
        await prisma.nhatKyHeThong.count({
          where: {
            hanhDong: 'phieu_xuat.below_min_price',
            doiTuongId: manager.id,
          },
        }),
      ).toBe(1);
    });

    it('sửa nháp thay dòng, xóa nháp; phiếu đã xuất không sửa/xóa được; KẾ TOÁN 403', async () => {
      const lot = await stockLot(vnDate(300), 3);
      const order = await newOrder([line(lot)]);
      const replaced = (
        await http()
          .patch(`/api/v1/phieu-xuat-hang/${order.id}`)
          .set(as('kho'))
          .send({ chiTiet: [line(lot, { soLuong: 2 })], ghiChu: 'giao sáng' })
          .expect(200)
      ).body as OrderBody;
      expect(replaced.tongTien).toBe('250000.00');
      await http()
        .delete(`/api/v1/phieu-xuat-hang/${order.id}`)
        .set(as('kho'))
        .expect(204);

      const issued = await newOrder([line(lot)]);
      await issue(issued.id).expect(200);
      const patch = await http()
        .patch(`/api/v1/phieu-xuat-hang/${issued.id}`)
        .set(as('kho'))
        .send({ ghiChu: 'x' });
      expect((patch.body as ErrorBody).code).toBe('PHIEU_XUAT_INVALID_STATE');
      expect(
        (
          await http()
            .delete(`/api/v1/phieu-xuat-hang/${issued.id}`)
            .set(as('kho'))
        ).status,
      ).toBe(409);
      await http()
        .post('/api/v1/phieu-xuat-hang')
        .set(as('ketoan'))
        .send({ khachHangId: khachId })
        .expect(403);
      await http().get('/api/v1/phieu-xuat-hang').expect(401);
    });

    it('cảnh báo FEFO mềm: dùng lô hạn muộn trong khi lô hạn sớm còn tồn', async () => {
      const loai = await createLoaiHang(app, tokens, 'FEFO');
      const hang = (
        await createHangHoa(app, tokens, loai.id, { tenSP: 'FEFO' })
      ).id;
      const late = await stockLot(vnDate(300), 2, { hangHoaId: hang });
      const early = await stockLot(vnDate(40), 2, { hangHoaId: hang });
      const order = await newOrder([line(late), line(early)]);
      const detail = await getOrder(order.id);
      const flagsByLot = Object.fromEntries(
        detail.chiTiet.map((c) => [c.soLo.id, c.canhBao]),
      );
      expect(flagsByLot[late]).toEqual(['KHONG_THEO_FEFO']);
      expect(flagsByLot[early]).toEqual([]);
      // once issued the warning is no longer computed
      await issue(order.id).expect(200);
      expect(
        (await getOrder(order.id)).chiTiet.flatMap((c) => c.canhBao),
      ).toEqual([]);
    });
  });

  describe('xuất kho', () => {
    it('hai phiếu tranh cùng tồn: phiếu đầu xuất được, phiếu sau → 409, không âm', async () => {
      const lot = await stockLot(vnDate(300), 1);
      const first = await newOrder([line(lot)]);
      const second = await newOrder([line(lot)]);
      await issue(first.id).expect(200);
      const res = await issue(second.id);
      expect(res.status).toBe(409);
      expect((res.body as ErrorBody).code).toBe('TON_KHO_INSUFFICIENT');
      expect(await stock(lot)).toBe(0);
      expect((await getOrder(second.id)).trangThai).toBe('cho_xu_ly');
    });

    it('lỗi ở dòng sau → dòng trước không bị trừ (rollback toàn bộ)', async () => {
      const a = await stockLot(vnDate(300), 5);
      const b = await stockLot(vnDate(300), 5);
      const order = await newOrder([line(a), line(b)]);
      await prisma.tonKho.updateMany({
        where: { soLoId: b, viTriId: viTriA },
        data: { soLuong: 0 },
      });
      await prisma.bienDongTonKho.create({
        data: {
          soLoId: b,
          viTriId: viTriA,
          loai: 'dieu_chinh',
          soLuongThayDoi: -500,
          soLuongSau: 0,
        },
      });
      const res = await issue(order.id);
      expect((res.body as ErrorBody).code).toBe('TON_KHO_INSUFFICIENT');
      expect(await stock(a)).toBe(500);
    });

    it('hai xuất kho đồng thời cùng một phiếu → một 200, một 409; tồn chỉ giảm một lần', async () => {
      const lot = await stockLot(vnDate(300), 3);
      const order = await newOrder([line(lot, { soLuong: 2 })]);
      const results = await Promise.all([issue(order.id), issue(order.id)]);
      expect(results.map((r) => r.status).sort((x, y) => x - y)).toEqual([
        200, 409,
      ]);
      expect(await stock(lot)).toBe(100);
    });

    it('lô hết hạn trong lúc chờ → SO_LO_EXPIRED; khách ngừng hoạt động sau khi lập → lỗi', async () => {
      const lot = await stockLot(vnDate(300), 2);
      const order = await newOrder([line(lot)]);
      await prisma.soLo.update({
        where: { id: lot },
        data: { hanSuDung: new Date(`${vnDate(-1)}T00:00:00Z`) },
      });
      expect(((await issue(order.id)).body as ErrorBody).code).toBe(
        'SO_LO_EXPIRED',
      );
      expect(await stock(lot)).toBe(200);

      const lot2 = await stockLot(vnDate(300), 2);
      const customer = await newKhach({
        tenKH: 'Sẽ ngừng',
        ngayHetHanGPKD: vnDate(400),
      });
      const order2 = (
        await http()
          .post('/api/v1/phieu-xuat-hang')
          .set(as('kho'))
          .send({ khachHangId: customer.id, chiTiet: [line(lot2)] })
          .expect(201)
      ).body as OrderBody;
      await http()
        .patch(`/api/v1/khach-hang/${customer.id}`)
        .set(as('quanly'))
        .send({ trangThai: 'ngung_hoat_dong' })
        .expect(200);
      expect(((await issue(order2.id)).body as ErrorBody).code).toBe(
        'KHACH_HANG_INACTIVE',
      );
      expect(await stock(lot2)).toBe(200);
    });
  });

  describe('giao hàng', () => {
    it('chỉ từ đã xuất kho; ngày tương lai hoặc trước ngày xuất → 400', async () => {
      const lot = await stockLot(vnDate(300), 2);
      const order = await newOrder([line(lot)]);
      const deliver = (body: Record<string, unknown>) =>
        http()
          .post(`/api/v1/phieu-xuat-hang/${order.id}/giao-hang`)
          .set(as('kho'))
          .send(body);
      expect(((await deliver({})).body as ErrorBody).code).toBe(
        'PHIEU_XUAT_INVALID_STATE',
      );
      await issue(order.id).expect(200);
      await deliver({ ngayGiaoThucTe: vnDate(2) }).expect(400);
      await deliver({ ngayGiaoThucTe: vnDate(-3) }).expect(400);
      expect((await getOrder(order.id)).trangThai).toBe('da_xuat_kho');
      await deliver({ ngayGiaoThucTe: vnDate(0) }).expect(200);
      expect(((await deliver({})).body as ErrorBody).code).toBe(
        'PHIEU_XUAT_INVALID_STATE',
      );
    });
  });

  describe('chiết khấu thanh toán', () => {
    it('chiết khấu cộng thêm vào số trừ nợ; tiền thực thu không đổi; hủy phiếu thu hoàn lại', async () => {
      const lot = await stockLot(vnDate(300), 2);
      const order = await newOrder([line(lot)]); // 125000
      await issue(order.id).expect(200);
      const post = (body: Record<string, unknown>) =>
        http()
          .post('/api/v1/phieu-thu-cong-no')
          .set(as('ketoan'))
          .send({
            phieuXuatHangId: order.id,
            ngayThanhToan: vnDate(0),
            phuongThuc: 'tien_mat',
            ...body,
          });

      await post({
        soTien: '100000',
        tyLeChietKhau: '1',
        tienChietKhau: '1',
      }).expect(400);
      await post({ soTien: '100', tienChietKhau: '100.01' }).expect(400);

      const receipt = (
        await post({ soTien: '100000', tyLeChietKhau: '20' }).expect(201)
      ).body as ReceiptBody & {
        soTien: string;
        tienChietKhau: string;
        tyLeChietKhau: string;
        tongGiamNo: string;
        soTienChuaDoiTru: string;
      };
      expect(receipt).toMatchObject({
        soTien: '100000.00',
        tyLeChietKhau: '20.00',
        tienChietKhau: '20000.00',
        tongGiamNo: '120000.00',
        soTienChuaDoiTru: '0.00',
      });
      expect(receipt.phieuXuat.conNoSauKhiThu).toBe('5000.00');
      expect((await getOrder(order.id)).daThu).toBe('120000.00');

      // The discount counts against the debt: 5000.01 more is too much.
      const over = await post({ soTien: '5000.01' }).expect(422);
      expect((over.body as ErrorBody).code).toBe('PHIEU_THU_EXCEEDS_DEBT');
      await post({ soTien: '4000', tienChietKhau: '1000' }).expect(201);
      const settled = await getOrder(order.id);
      expect(settled.conNo).toBe('0.00');
      expect(settled.trangThaiThu).toBe('da_thu_du');

      await http()
        .post(`/api/v1/phieu-thu-cong-no/${receipt.id}/huy`)
        .set(as('ketoan'))
        .send({ lyDo: 'nhập nhầm' })
        .expect(200);
      expect((await getOrder(order.id)).conNo).toBe('120000.00');
    });
  });

  describe('thu tiền ngay', () => {
    it('xuất kho tự lập phiếu thu đủ tổng phiếu theo phương thức chọn; không phát sinh nợ', async () => {
      const lot = await stockLot(vnDate(300), 2);
      const order = await newOrder([line(lot)], {
        hinhThucThanhToan: 'thu_tien_ngay',
      });
      expect(order.hinhThucThanhToan).toBe('thu_tien_ngay');
      expect(
        await prisma.phieuThuCongNo.count({
          where: { phieuXuatHangId: order.id },
        }),
      ).toBe(0);

      const issued = (
        await issue(order.id)
          .send({ phuongThucThu: 'chuyen_khoan' })
          .expect(200)
      ).body as OrderBody & { thuTien: { id: string; soTien: string }[] };
      expect(issued.conNo).toBe('0.00');
      expect(issued.trangThaiThu).toBe('da_thu_du');
      expect(issued.thuTien).toHaveLength(1);
      expect(issued.thuTien[0]!.soTien).toBe('125000.00');
      const receipt = await prisma.phieuThuCongNo.findFirstOrThrow({
        where: { phieuXuatHangId: order.id },
      });
      expect(receipt.phuongThuc).toBe('chuyen_khoan');
      expect(receipt.createdById).not.toBeNull();

      // The receipt must be voided first, like any other receipt.
      const blocked = await cancel(order.id).expect(409);
      expect((blocked.body as ErrorBody).code).toBe(
        'PHIEU_XUAT_CANNOT_REVERSE',
      );
      await http()
        .post(`/api/v1/phieu-thu-cong-no/${receipt.id}/huy`)
        .set(as('ketoan'))
        .send({ lyDo: 'khách trả lại tiền' })
        .expect(200);
      await cancel(order.id).expect(200);
    });

    it('mặc định tiền mặt; phiếu ghi nợ thường không tự lập phiếu thu', async () => {
      const lot = await stockLot(vnDate(300), 2);
      const paid = await newOrder([line(lot)], {
        hinhThucThanhToan: 'thu_tien_ngay',
      });
      await issue(paid.id).expect(200);
      const receipt = await prisma.phieuThuCongNo.findFirstOrThrow({
        where: { phieuXuatHangId: paid.id },
      });
      expect(receipt.phuongThuc).toBe('tien_mat');

      const credit = await newOrder([line(lot)]);
      await issue(credit.id).expect(200);
      expect(
        await prisma.phieuThuCongNo.count({
          where: { phieuXuatHangId: credit.id },
        }),
      ).toBe(0);
      expect((await getOrder(credit.id)).conNo).toBe('125000.00');
    });

    it('không bị chặn bởi hạn mức nợ vì không phát sinh nợ', async () => {
      const limited = await newKhach({
        tenKH: 'Khách hạn mức nhỏ',
        diaChi: 'x',
        ngayHetHanGPKD: vnDate(400),
        soNoToiDa: '1000',
      });
      const lot = await stockLot(vnDate(300), 2);
      const order = (
        await http()
          .post('/api/v1/phieu-xuat-hang')
          .set(as('quanly'))
          .send({
            khachHangId: limited.id,
            hinhThucThanhToan: 'thu_tien_ngay',
            chiTiet: [line(lot)],
          })
          .expect(201)
      ).body as OrderBody;
      await issue(order.id, 'quanly').expect(200);
    });
  });

  describe('tình trạng nợ', () => {
    it('kế toán đổi tình trạng nợ phiếu đã xuất kho, ghi nhật ký, lọc được; phiếu nháp thì không', async () => {
      const lot = await stockLot(vnDate(300), 2);
      const draft = await newOrder([line(lot)]);
      const url = (id: string) => `/api/v1/phieu-xuat-hang/${id}/tinh-trang-no`;
      const bad = await http()
        .patch(url(draft.id))
        .set(as('ketoan'))
        .send({ tinhTrangNo: 'no_kho_doi' })
        .expect(409);
      expect((bad.body as ErrorBody).code).toBe('PHIEU_XUAT_INVALID_STATE');

      await issue(draft.id).expect(200);
      await http()
        .patch(url(draft.id))
        .set(as('kho'))
        .send({ tinhTrangNo: 'no_kho_doi' })
        .expect(403);
      await http()
        .patch(url(draft.id))
        .set(as('ketoan'))
        .send({ tinhTrangNo: 'sai' })
        .expect(400);
      const changed = (
        await http()
          .patch(url(draft.id))
          .set(as('ketoan'))
          .send({ tinhTrangNo: 'no_kho_doi', lyDo: 'Khách chây ì' })
          .expect(200)
      ).body as { tinhTrangNo: string };
      expect(changed.tinhTrangNo).toBe('no_kho_doi');

      const log = await prisma.nhatKyHeThong.findFirst({
        where: { hanhDong: 'phieu_xuat.debt_status', doiTuongId: draft.id },
      });
      expect(log?.lyDo).toBe('Khách chây ì');

      const filtered = (
        await http()
          .get('/api/v1/phieu-xuat-hang?tinhTrangNo=no_kho_doi')
          .set(as('ketoan'))
          .expect(200)
      ).body as Page<Id>;
      expect(filtered.items.map((o) => o.id)).toEqual([draft.id]);

      await cancel(draft.id).expect(200);
      await http()
        .patch(url(draft.id))
        .set(as('ketoan'))
        .send({ tinhTrangNo: 'no_binh_thuong' })
        .expect(409);
    });
  });

  describe('hủy phiếu', () => {
    it('hủy phiếu chờ xử lý (kể cả NVK): không đụng tồn; thiếu lý do → 400; hủy lại → 409', async () => {
      const lot = await stockLot(vnDate(300), 2);
      const order = await newOrder([line(lot)]);
      expect(
        ((await cancel(order.id, 'kho')).body as OrderBody).trangThai,
      ).toBe('da_huy');
      expect(await stock(lot)).toBe(200);
      expect(((await cancel(order.id)).body as ErrorBody).code).toBe(
        'PHIEU_XUAT_INVALID_STATE',
      );
      await http()
        .post(`/api/v1/phieu-xuat-hang/${order.id}/huy`)
        .set(as('quanly'))
        .send({})
        .expect(400);
    });

    it('hủy sau khi xuất: NVK 403; quản lý hoàn tồn về đúng vị trí cũ và ghi nhật ký', async () => {
      const lot = await stockLot(vnDate(300), 2);
      const order = await newOrder([line(lot, { soLuong: 2 })]);
      await issue(order.id).expect(200);
      await cancel(order.id, 'kho').expect(403);
      expect(await stock(lot)).toBe(0);
      await cancel(order.id).expect(200);
      expect(await stock(lot)).toBe(200);
      expect(
        await prisma.bienDongTonKho.count({
          where: { soLoId: lot, loai: 'huy_xuat' },
        }),
      ).toBe(1);
      expect(
        await prisma.nhatKyHeThong.count({
          where: {
            hanhDong: 'phieu_xuat.cancel_after_issue',
            doiTuongId: order.id,
          },
        }),
      ).toBe(1);
    });

    it('vị trí cũ đã ngừng sử dụng vẫn hoàn tồn được', async () => {
      const vt = (
        await http()
          .post('/api/v1/vi-tri')
          .set(as('quanly'))
          .send({ khoId, tenViTri: 'Tạm' })
          .expect(201)
      ).body.id as string;
      const lot = await stockLot(vnDate(300), 1, { viTriId: vt });
      const order = await newOrder([line(lot, { viTriId: vt })]);
      await issue(order.id).expect(200);
      await http()
        .patch(`/api/v1/vi-tri/${vt}`)
        .set(as('quanly'))
        .send({ trangThai: false })
        .expect(200);
      await cancel(order.id).expect(200);
      expect(await stock(lot, vt)).toBe(100);
    });

    it('còn phiếu thu hiệu lực → 409; hủy phiếu thu rồi hủy phiếu xuất → 200; đã giao thì không hủy được', async () => {
      const lot = await stockLot(vnDate(300), 2);
      const order = await newOrder([line(lot)]);
      await issue(order.id).expect(200);
      const receipt = (await collect(order.id, '50000').expect(201))
        .body as ReceiptBody;
      const blocked = await cancel(order.id);
      expect(blocked.status).toBe(409);
      expect((blocked.body as ErrorBody).code).toBe(
        'PHIEU_XUAT_CANNOT_REVERSE',
      );
      await http()
        .post(`/api/v1/phieu-thu-cong-no/${receipt.id}/huy`)
        .set(as('ketoan'))
        .send({ lyDo: 'nhập nhầm' })
        .expect(200);
      await cancel(order.id).expect(200);

      const lot2 = await stockLot(vnDate(300), 1);
      const delivered = await newOrder([line(lot2)]);
      await issue(delivered.id).expect(200);
      await http()
        .post(`/api/v1/phieu-xuat-hang/${delivered.id}/giao-hang`)
        .set(as('kho'))
        .send({})
        .expect(200);
      expect(((await cancel(delivered.id)).body as ErrorBody).code).toBe(
        'PHIEU_XUAT_INVALID_STATE',
      );
    });
  });

  describe('thu công nợ', () => {
    it('phiếu chờ xử lý → 409; phiếu không có → 404; số tiền và ngày sai', async () => {
      const lot = await stockLot(vnDate(300), 2);
      const draft = await newOrder([line(lot)]);
      expect(((await collect(draft.id, '1000')).body as ErrorBody).code).toBe(
        'PHIEU_THU_ORDER_INVALID_STATE',
      );
      expect(
        (await collect('00000000-0000-4000-8000-000000000000', '1')).status,
      ).toBe(404);

      await issue(draft.id).expect(200);
      expect((await collect(draft.id, '0')).status).toBe(400);
      expect((await collect(draft.id, '10.123')).status).toBe(400);
      expect(
        ((await collect(draft.id, '10', 'ketoan', vnDate(2))).body as ErrorBody)
          .code,
      ).toBe('PHIEU_THU_DATE_INVALID');
      expect(
        (
          (await collect(draft.id, '10', 'ketoan', vnDate(-30)))
            .body as ErrorBody
        ).code,
      ).toBe('PHIEU_THU_DATE_INVALID');
    });

    it('hủy một khoản → nợ tăng lại; hủy lần hai → 409; khách ngừng hoạt động vẫn thu được nợ cũ', async () => {
      const customer = await newKhach({
        tenKH: 'Nợ cũ',
        ngayHetHanGPKD: vnDate(400),
      });
      const lot = await stockLot(vnDate(300), 2);
      const order = (
        await http()
          .post('/api/v1/phieu-xuat-hang')
          .set(as('kho'))
          .send({ khachHangId: customer.id, chiTiet: [line(lot)] })
          .expect(201)
      ).body as OrderBody;
      await issue(order.id).expect(200);
      await http()
        .patch(`/api/v1/khach-hang/${customer.id}`)
        .set(as('quanly'))
        .send({ trangThai: 'ngung_hoat_dong' })
        .expect(200);

      const receipt = (await collect(order.id, '25000').expect(201))
        .body as ReceiptBody;
      const voidIt = () =>
        http()
          .post(`/api/v1/phieu-thu-cong-no/${receipt.id}/huy`)
          .set(as('admin'))
          .send({ lyDo: 'sai số tiền' });
      expect(((await voidIt().expect(200)).body as ReceiptBody).daHuy).toBe(
        true,
      );
      expect(((await voidIt()).body as ErrorBody).code).toBe(
        'PHIEU_THU_ALREADY_VOID',
      );
      expect((await getOrder(order.id)).conNo).toBe('125000.00');
    });

    it('hai phiếu thu đồng thời cùng thu hết nợ → một 201, một 422', async () => {
      const lot = await stockLot(vnDate(300), 1);
      const order = await newOrder([line(lot, { donGia: '125000' })]);
      await issue(order.id).expect(200);
      const results = await Promise.all([
        collect(order.id, '125000'),
        collect(order.id, '125000'),
      ]);
      expect(results.map((r) => r.status).sort((x, y) => x - y)).toEqual([
        201, 422,
      ]);
      expect((await getOrder(order.id)).conNo).toBe('0.00');
    });

    it('công nợ khách: khớp tổng, nhóm tuổi nợ đúng theo ngày xuất kho', async () => {
      const customer = await newKhach({
        tenKH: 'Aging',
        ngayHetHanGPKD: vnDate(400),
      });
      const mk = async (days: number) => {
        const lot = await stockLot(vnDate(300), 1);
        const order = (
          await http()
            .post('/api/v1/phieu-xuat-hang')
            .set(as('kho'))
            .send({ khachHangId: customer.id, chiTiet: [line(lot)] })
            .expect(201)
        ).body as OrderBody;
        await issue(order.id).expect(200);
        await prisma.phieuXuatHang.update({
          where: { id: order.id },
          data: { ngayXuatKho: new Date(`${vnDate(-days)}T00:00:00Z`) },
        });
        return order.id;
      };
      await mk(10);
      await mk(45);
      await mk(100);

      const res = await http()
        .get(`/api/v1/khach-hang/${customer.id}/cong-no`)
        .set(as('quanly'))
        .expect(200);
      const body = res.body as {
        tongPhaiThu: string;
        conNo: string;
        vuotHanMuc: boolean | null;
        phieuConNo: { soNgayNo: number; nhomTuoiNo: string }[];
      };
      expect(body.conNo).toBe('375000.00');
      expect(body.vuotHanMuc).toBeNull();
      expect(body.phieuConNo.map((p) => [p.soNgayNo, p.nhomTuoiNo])).toEqual([
        [100, '>90'],
        [45, '31-60'],
        [10, '0-30'],
      ]);
      await http()
        .get(`/api/v1/khach-hang/${customer.id}/cong-no`)
        .set(as('kho'))
        .expect(403);
    });

    it('ma trận role: NVK không đọc/ghi phiếu thu, QL chỉ đọc, kế toán và admin ghi', async () => {
      await http().get('/api/v1/phieu-thu-cong-no').set(as('kho')).expect(403);
      await http()
        .get('/api/v1/phieu-thu-cong-no')
        .set(as('quanly'))
        .expect(200);
      const lot = await stockLot(vnDate(300), 1);
      const order = await newOrder([line(lot)]);
      await issue(order.id).expect(200);
      await collect(order.id, '1000', 'quanly').expect(403);
      await collect(order.id, '1000', 'admin').expect(201);
    });
  });

  describe('danh sách và lọc', () => {
    it('lọc theo trạng thái (nhiều giá trị), trạng thái thu, khách, lô, khoảng ngày; sort lạ → 400', async () => {
      const list = async (qs: string) =>
        (
          await http()
            .get(`/api/v1/phieu-xuat-hang?${qs}`)
            .set(as('ketoan'))
            .expect(200)
        ).body as Page<OrderBody>;
      const all = await list('pageSize=100');
      expect(all.meta.total).toBeGreaterThan(8);
      expect(
        (await list('trangThai=da_xuat_kho,da_giao&pageSize=100')).items.every(
          (o) => o.trangThai !== 'cho_xu_ly',
        ),
      ).toBe(true);
      expect(
        (await list('trangThaiThu=thu_mot_phan')).items.every(
          (o) => o.trangThaiThu === 'thu_mot_phan',
        ),
      ).toBe(true);
      expect(
        (await list('trangThaiThu=chua_thu')).items.every(
          (o) => o.trangThaiThu === 'chua_thu',
        ),
      ).toBe(true);
      expect(
        (await list(`khachHangId=${khachId}&pageSize=100`)).meta.total,
      ).toBeGreaterThan(0);
      const byProduct = (await list(`hangHoaId=${hangId}`)).meta.total;
      expect(byProduct).toBeGreaterThan(0);
      expect(byProduct).toBeLessThan(all.meta.total);
      expect((await list(`hangHoaId=${lanhId}`)).meta.total).toBe(0);
      expect(
        (await list(`createdAtFrom=${vnDate(1)}&createdAtTo=${vnDate(2)}`)).meta
          .total,
      ).toBe(0);
      expect(
        (await list(`ngayXuatKhoFrom=${vnDate(0)}&ngayXuatKhoTo=${vnDate(0)}`))
          .meta.total,
      ).toBeGreaterThan(0);
      await http()
        .get('/api/v1/phieu-xuat-hang?sort=ghiChu:asc')
        .set(as('ketoan'))
        .expect(400);
    });
  });
});
