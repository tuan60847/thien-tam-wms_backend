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

describe('Báo cáo (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: Tokens;
  const http = () => request(app.getHttpServer());
  const as = (user: string) => bearer(tokens, user);
  const get = (path: string, user = 'ketoan') =>
    http().get(`/api/v1/bao-cao/${path}`).set(as(user));

  let nccId: string;
  let loaiId: string;
  let hangA: string; // 90000 / hộp, 1 hộp = 100 viên
  let hangB: string;
  let viTriA: string;
  let viTriB: string;
  let khoA: string;
  let khoB: string;
  let khachX: Id;
  let khachY: Id;
  let lotA1: string;
  let lotA2: string;
  let lotB1: string;

  const receive = async (
    hangHoaId: string,
    viTriId: string,
    hop: number,
    hanSuDung: string,
  ): Promise<string> => {
    const created = (
      await http()
        .post('/api/v1/phieu-nhap-hang')
        .set(as('kho'))
        .send({
          nhaCungCapId: nccId,
          chiTiet: [
            {
              soLo: { hangHoaId, tenLo: `L${Math.random()}`, hanSuDung },
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
      .post(`/api/v1/phieu-nhap-hang/${created.id}/xac-nhan`)
      .set(as('quanly'))
      .send({})
      .expect(200);
    return created.chiTiet[0]!.soLo.id;
  };
  const sell = async (
    khachHangId: string,
    soLoId: string,
    viTriId: string,
    hop: number,
    donGia = '125000',
  ) => {
    const order = (
      await http()
        .post('/api/v1/phieu-xuat-hang')
        .set(as('kho'))
        .send({
          khachHangId,
          chiTiet: [
            { soLoId, viTriId, donViTinh: 'hộp', soLuong: hop, donGia },
          ],
        })
        .expect(201)
    ).body as Id;
    await http()
      .post(`/api/v1/phieu-xuat-hang/${order.id}/xuat-kho`)
      .set(as('kho'))
      .expect(200);
    return order;
  };

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
          tenNCC: 'NCC Báo Cáo',
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
    loaiId = loai.id;
    hangA = (
      await createHangHoa(app, tokens, loai.id, { tenSP: 'A Paracetamol' })
    ).id;
    hangB = (
      await createHangHoa(app, tokens, loai.id, { tenSP: 'B Vitamin C' })
    ).id;
    const mkKho = async (tenKho: string, viTri: string) => {
      const kho = (
        await http()
          .post('/api/v1/kho')
          .set(as('quanly'))
          .send({ tenKho })
          .expect(201)
      ).body as Id;
      const vt = (
        await http()
          .post('/api/v1/vi-tri')
          .set(as('quanly'))
          .send({ khoId: kho.id, tenViTri: viTri })
          .expect(201)
      ).body as Id;
      return { kho: kho.id, vt: vt.id };
    };
    const a = await mkKho('Kho A', 'A1');
    const b = await mkKho('Kho B', 'B1');
    [khoA, viTriA, khoB, viTriB] = [a.kho, a.vt, b.kho, b.vt];

    const customer = async (tenKH: string) =>
      (
        await http()
          .post('/api/v1/khach-hang')
          .set(as('ketoan'))
          .send({ tenKH, ngayHetHanGPKD: vnDate(400) })
          .expect(201)
      ).body as Id;
    khachX = await customer('Nhà thuốc X');
    khachY = await customer('Nhà thuốc Y');

    // A1: 10 hộp, hạn xa; A2: 5 hộp, cận date (30 ngày); B1: 4 hộp hàng B, hạn xa.
    lotA1 = await receive(hangA, viTriA, 10, vnDate(400));
    lotA2 = await receive(hangA, viTriA, 5, vnDate(30));
    lotB1 = await receive(hangB, viTriB, 4, vnDate(400));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('tồn kho', () => {
    it('nhóm theo hàng hóa: tổng, khả dụng, cận date, giá trị theo giá vốn bình quân', async () => {
      const res = (await get('ton-kho').expect(200)).body as {
        items: {
          nhom: { ten: string };
          donViCoBan: string;
          tongTon: number;
          tonKhaDung: number;
          tonCanDate: number;
          tonHetHan: number;
          soLo: number;
          giaTriTon: string;
          thieuGiaVon: boolean;
        }[];
        tong: { tongTon: number; giaTriTon: string };
      };
      const a = res.items.find((i) => i.nhom.ten === 'A Paracetamol')!;
      expect(a).toMatchObject({
        donViCoBan: 'viên',
        tongTon: 1500,
        tonKhaDung: 1500,
        tonCanDate: 500,
        tonHetHan: 0,
        soLo: 2,
        thieuGiaVon: false,
        giaTriTon: '1350000.00', // 15 hộp × 90000
      });
      expect(res.tong).toMatchObject({
        tongTon: 1900,
        giaTriTon: '1710000.00',
      });
    });

    it('nhóm theo kho và loại hàng; lọc theo kho; giới hạn tên nhóm', async () => {
      const byKho = (await get('ton-kho?groupBy=kho').expect(200)).body as {
        items: { nhom: { ten: string }; tongTon: number }[];
      };
      expect(byKho.items.map((i) => [i.nhom.ten, i.tongTon])).toEqual([
        ['Kho A', 1500],
        ['Kho B', 400],
      ]);
      const byLoai = (await get('ton-kho?groupBy=loai-hang').expect(200))
        .body as { items: { tongTon: number }[] };
      expect(byLoai.items).toHaveLength(1);
      const onlyB = (await get(`ton-kho?khoId=${khoB}`).expect(200)).body as {
        items: { nhom: { ten: string } }[];
      };
      expect(onlyB.items.map((i) => i.nhom.ten)).toEqual(['B Vitamin C']);
      await get('ton-kho?groupBy=nhom-la').expect(400);
    });

    it('nhân viên kho xem được tồn nhưng không thấy giá trị / giá vốn', async () => {
      const res = (await get('ton-kho', 'kho').expect(200)).body as {
        items: Record<string, unknown>[];
        tong: Record<string, unknown>;
      };
      expect(res.items[0]).not.toHaveProperty('giaTriTon');
      expect(res.items[0]).not.toHaveProperty('thieuGiaVon');
      expect(res.tong).not.toHaveProperty('giaTriTon');
      const lots = (await get('ton-kho/theo-lo', 'kho').expect(200))
        .body as Page<Record<string, unknown>>;
      expect(lots.items[0]).not.toHaveProperty('giaVonCoBan');
      expect(lots.items[0]).not.toHaveProperty('giaTri');
    });

    it('tồn theo lô: sắp xếp hạn dùng, giá vốn và giá trị từng lô; lọc trạng thái lô', async () => {
      const res = (await get('ton-kho/theo-lo').expect(200)).body as Page<{
        soLo: { id: string; trangThai: string; soNgayConLai: number };
        soLuong: number;
        giaVonCoBan: string;
        giaTri: string;
      }>;
      expect(res.items[0]).toMatchObject({
        soLo: { id: lotA2, trangThai: 'can_date', soNgayConLai: 30 },
        soLuong: 500,
        giaVonCoBan: '900.00',
        giaTri: '450000.00',
      });
      expect(res.meta.total).toBe(3);
      const near = (
        await get('ton-kho/theo-lo?trangThaiLo=can_date').expect(200)
      ).body as Page<Id>;
      expect(near.meta.total).toBe(1);
      await get('ton-kho/theo-lo?sort=giaTri:asc').expect(400);
    });

    it('lô tạo bởi điều chỉnh không có giá vốn: không tính vào giá trị, báo thieuGiaVon', async () => {
      const lot = await prisma.soLo.create({
        data: {
          tenLo: 'ADJ',
          hangHoaId: hangB,
          hanSuDung: new Date(`${vnDate(300)}T00:00:00Z`),
        },
      });
      await http()
        .post('/api/v1/ton-kho/dieu-chinh')
        .set(as('quanly'))
        .send({
          soLoId: lot.id,
          viTriId: viTriB,
          soLuongMoi: 50,
          lyDo: 'kiểm kê dư',
        })
        .expect(201);
      const res = (await get('ton-kho').expect(200)).body as {
        items: {
          nhom: { ten: string };
          tongTon: number;
          giaTriTon: string;
          thieuGiaVon: boolean;
        }[];
      };
      const b = res.items.find((i) => i.nhom.ten === 'B Vitamin C')!;
      expect(b).toMatchObject({
        tongTon: 450,
        giaTriTon: '360000.00',
        thieuGiaVon: true,
      });
    });
  });

  describe('cận date và hết hạn', () => {
    it('cận date: theo số ngày, kèm tổng; ngoài ngưỡng thì không có', async () => {
      const res = (await get('can-date?soNgay=45').expect(200)).body as Page<{
        soLo: { id: string };
        soLuong: number;
      }> & {
        tong: { soLo: number; tongSoLuong: number; tongGiaTri: string };
      };
      expect(res.items.map((i) => i.soLo.id)).toEqual([lotA2]);
      expect(res.tong).toEqual({
        soLo: 1,
        tongSoLuong: 500,
        tongGiaTri: '450000.00',
      });
      expect(
        ((await get('can-date?soNgay=10').expect(200)).body as Page<Id>).meta
          .total,
      ).toBe(0);
      await get('can-date?soNgay=0').expect(400);
      await get('can-date?soNgay=366').expect(400);
    });

    it('hết hạn: lô quá hạn còn tồn; hạn đúng hôm nay vẫn là cận date, chưa hết hạn', async () => {
      await prisma.soLo.update({
        where: { id: lotB1 },
        data: { hanSuDung: new Date(`${vnDate(-1)}T00:00:00Z`) },
      });
      const expired = (await get('het-han').expect(200)).body as Page<{
        soLo: { id: string; trangThai: string; soNgayConLai: number };
      }> & {
        tong: { soLo: number };
      };
      expect(expired.items.map((i) => i.soLo.id)).toEqual([lotB1]);
      expect(expired.items[0]!.soLo).toMatchObject({
        trangThai: 'het_han',
        soNgayConLai: -1,
      });
      expect(expired.tong.soLo).toBe(1);

      await prisma.soLo.update({
        where: { id: lotB1 },
        data: { hanSuDung: new Date(`${vnDate(0)}T00:00:00Z`) },
      });
      expect(
        ((await get('het-han').expect(200)).body as Page<Id>).meta.total,
      ).toBe(0);
      const near = (await get('can-date?soNgay=1').expect(200)).body as Page<{
        soLo: { id: string };
      }>;
      expect(near.items.map((i) => i.soLo.id)).toEqual([lotB1]);
      await prisma.soLo.update({
        where: { id: lotB1 },
        data: { hanSuDung: new Date(`${vnDate(400)}T00:00:00Z`) },
      });
    });
  });

  describe('nhập - xuất - tồn', () => {
    it('đầu kỳ, nhập, xuất, huỷ, trả hàng, điều chỉnh và cuối kỳ khớp bất biến sổ cái', async () => {
      const order = await sell(khachX.id, lotA1, viTriA, 2); // -200
      const detail = (
        await http()
          .get(`/api/v1/phieu-xuat-hang/${order.id}`)
          .set(as('ketoan'))
          .expect(200)
      ).body as { chiTiet: Id[] };
      const ret = (
        await http()
          .post('/api/v1/tra-lai-hang-ban')
          .set(as('kho'))
          .send({
            phieuXuatHangId: order.id,
            chiTiet: [
              { chiTietPhieuXuatHangId: detail.chiTiet[0]!.id, soLuong: 1 },
            ],
          })
          .expect(201)
      ).body as Id;
      await http()
        .post(`/api/v1/tra-lai-hang-ban/${ret.id}/xac-nhan`)
        .set(as('quanly'))
        .send({})
        .expect(200); // +100
      await http()
        .post('/api/v1/ton-kho/chuyen-vi-tri')
        .set(as('kho'))
        .send({
          soLoId: lotA1,
          tuViTriId: viTriA,
          denViTriId: viTriB,
          soLuong: 1,
          donViTinh: 'hộp',
        })
        .expect(201); // A: -100, B: +100

      const res = (
        await get(
          `nhap-xuat-ton?tuNgay=${vnDate(0)}&denNgay=${vnDate(0)}&hangHoaId=${hangA}`,
        ).expect(200)
      ).body as {
        items: {
          tonDau: number;
          nhap: number;
          xuat: number;
          traHang: number;
          chuyenRong: number;
          tonCuoi: number;
        }[];
        tong: { tonCuoi: number };
        kyBaoCao: { tuNgay: string };
      };
      expect(res.items).toHaveLength(1);
      expect(res.items[0]).toMatchObject({
        tonDau: 0,
        nhap: 1500,
        xuat: -200,
        traHang: 100,
        chuyenRong: 0,
        tonCuoi: 1400,
      });
      expect(res.kyBaoCao.tuNgay).toBe(vnDate(0));

      // filtering one warehouse shows the transfer as net movement
      const kA = (
        await get(
          `nhap-xuat-ton?tuNgay=${vnDate(0)}&denNgay=${vnDate(0)}&hangHoaId=${hangA}&khoId=${khoA}`,
        ).expect(200)
      ).body as {
        items: { chuyenRong: number; tonCuoi: number }[];
      };
      expect(kA.items[0]).toMatchObject({ chuyenRong: -100, tonCuoi: 1300 });
      const kB = (
        await get(
          `nhap-xuat-ton?tuNgay=${vnDate(0)}&denNgay=${vnDate(0)}&hangHoaId=${hangA}&khoId=${khoB}`,
        ).expect(200)
      ).body as {
        items: { chuyenRong: number }[];
      };
      expect(kB.items[0]!.chuyenRong).toBe(100);
    });

    it('kỳ ở tương lai: không có phát sinh nên không có dòng; kỳ sau đó mang tồn đầu kỳ', async () => {
      const future = (
        await get(
          `nhap-xuat-ton?tuNgay=${vnDate(5)}&denNgay=${vnDate(6)}&hangHoaId=${hangA}`,
        ).expect(200)
      ).body as {
        items: { tonDau: number; nhap: number; tonCuoi: number }[];
      };
      expect(future.items[0]).toMatchObject({
        tonDau: 1400,
        nhap: 0,
        tonCuoi: 1400,
      });
      const past = (
        await get(
          `nhap-xuat-ton?tuNgay=${vnDate(-10)}&denNgay=${vnDate(-5)}`,
        ).expect(200)
      ).body as { items: unknown[] };
      expect(past.items).toHaveLength(0);
    });

    it('khoảng thời gian sai → 422; vượt 366 ngày → 422; thiếu tham số → 400; chỉ ADMIN/QL/KẾ TOÁN', async () => {
      expect(
        (
          (
            await get(
              `nhap-xuat-ton?tuNgay=${vnDate(1)}&denNgay=${vnDate(0)}`,
            ).expect(422)
          ).body as ErrorBody
        ).code,
      ).toBe('BAO_CAO_RANGE_INVALID');
      expect(
        (
          (
            await get(
              `nhap-xuat-ton?tuNgay=${vnDate(-400)}&denNgay=${vnDate(0)}`,
            ).expect(422)
          ).body as ErrorBody
        ).code,
      ).toBe('BAO_CAO_RANGE_TOO_LARGE');
      await get('nhap-xuat-ton').expect(400);
      await get(
        `nhap-xuat-ton?tuNgay=${vnDate(0)}&denNgay=${vnDate(0)}`,
        'kho',
      ).expect(403);
      await http().get('/api/v1/bao-cao/ton-kho').expect(401);
    });
  });

  describe('doanh thu', () => {
    let range: string;
    beforeAll(async () => {
      range = `tuNgay=${vnDate(-1)}&denNgay=${vnDate(1)}`;
      // X: 3 hộp A at 125000 with 10% discount via a second order; Y: 2 hộp A + 1 hộp B
      await sell(khachY.id, lotA1, viTriA, 2);
      const lotB = await receive(hangB, viTriB, 3, vnDate(400));
      const orderY2 = (
        await http()
          .post('/api/v1/phieu-xuat-hang')
          .set(as('kho'))
          .send({
            khachHangId: khachY.id,
            chiTiet: [
              {
                soLoId: lotB,
                viTriId: viTriB,
                donViTinh: 'hộp',
                soLuong: 1,
                donGia: '200000',
                tyLeChietKhau: '10',
                thueSuatGtgt: '0',
              },
            ],
          })
          .expect(201)
      ).body as Id;
      await http()
        .post(`/api/v1/phieu-xuat-hang/${orderY2.id}/xuat-kho`)
        .set(as('kho'))
        .expect(200);
      // a draft and a cancelled order must not count
      const draft = (
        await http()
          .post('/api/v1/phieu-xuat-hang')
          .set(as('kho'))
          .send({
            khachHangId: khachX.id,
            chiTiet: [
              {
                soLoId: lotA1,
                viTriId: viTriA,
                donViTinh: 'hộp',
                soLuong: 1,
                donGia: '125000',
              },
            ],
          })
          .expect(201)
      ).body as Id;
      await http()
        .post(`/api/v1/phieu-xuat-hang/${draft.id}/huy`)
        .set(as('quanly'))
        .send({ lyDo: 'hủy' })
        .expect(200);
    });

    it('tổng theo ngày: chỉ phiếu đã xuất kho; doanh thu = tiền hàng − chiết khấu; trừ hàng trả lại', async () => {
      const res = (await get(`doanh-thu?${range}`).expect(200)).body as {
        items: {
          nhom: { khoa: string };
          soPhieu: number;
          tienHang: string;
          doanhThu: string;
        }[];
        tong: Record<string, string | number>;
        groupBy: string;
      };
      expect(res.groupBy).toBe('ngay');
      expect(res.items).toHaveLength(1);
      expect(res.items[0]!.nhom.khoa).toBe(vnDate(0));
      // orders: X 2 hộp (250000), Y 2 hộp (250000), Y 1 hộp B (200000 − 10% = 180000)
      expect(res.tong).toMatchObject({
        soPhieu: 3,
        tienHang: '700000.00',
        chietKhau: '20000.00',
        doanhThu: '680000.00',
        giaTriTraLai: '125000.00',
        doanhThuThuan: '555000.00',
      });
    });

    it('nhóm theo khách, hàng hóa, tháng, người tạo; tổng không đếm trùng phiếu khi nhóm theo hàng', async () => {
      const byKhach = (
        await get(`doanh-thu?${range}&groupBy=khach-hang`).expect(200)
      ).body as {
        items: { nhom: { ten: string }; soPhieu: number; doanhThu: string }[];
      };
      expect(
        byKhach.items.map((i) => [i.nhom.ten, i.soPhieu, i.doanhThu]),
      ).toEqual([
        ['Nhà thuốc X', 1, '250000.00'],
        ['Nhà thuốc Y', 2, '430000.00'],
      ]);
      const byHang = (
        await get(`doanh-thu?${range}&groupBy=hang-hoa`).expect(200)
      ).body as {
        items: { nhom: { ten: string }; soLuongCoBan: number }[];
        tong: { soPhieu: number };
      };
      expect(byHang.items.map((i) => [i.nhom.ten, i.soLuongCoBan])).toEqual([
        ['A Paracetamol', 400],
        ['B Vitamin C', 100],
      ]);
      expect(byHang.tong.soPhieu).toBe(3);
      expect(
        (
          (await get(`doanh-thu?${range}&groupBy=thang`).expect(200)).body as {
            items: { nhom: { khoa: string } }[];
          }
        ).items[0]!.nhom.khoa,
      ).toBe(vnDate(0).slice(0, 7));
      const byUser = (
        await get(`doanh-thu?${range}&groupBy=nguoi-tao`).expect(200)
      ).body as { items: { nhom: { ten: string } }[] };
      expect(byUser.items).toHaveLength(1);
    });

    it('lọc theo khách / hàng / loại hàng; kỳ không có phiếu → toàn 0; tham số sai', async () => {
      const onlyX = (
        await get(`doanh-thu?${range}&khachHangId=${khachX.id}`).expect(200)
      ).body as { tong: { doanhThu: string; giaTriTraLai: string } };
      expect(onlyX.tong).toMatchObject({
        doanhThu: '250000.00',
        giaTriTraLai: '125000.00',
      });
      const noLoai = (
        await get(
          `doanh-thu?${range}&loaiHangId=00000000-0000-4000-8000-000000000000`,
        ).expect(200)
      ).body as { tong: { doanhThu: string } };
      expect(noLoai.tong.doanhThu).toBe('0.00');
      const past = (
        await get(
          `doanh-thu?tuNgay=${vnDate(-20)}&denNgay=${vnDate(-10)}`,
        ).expect(200)
      ).body as { items: unknown[]; tong: { soPhieu: number } };
      expect(past.items).toHaveLength(0);
      expect(past.tong.soPhieu).toBe(0);
      await get(`doanh-thu?${range}&groupBy=sai`).expect(400);
      await get(`doanh-thu?${range}`, 'kho').expect(403);
      expect(loaiId).toBeDefined();
    });

    it('top bán chạy: theo doanh thu và theo số lượng, giới hạn số dòng', async () => {
      const byRevenue = (await get(`top-ban-chay?${range}`).expect(200))
        .body as {
        items: { hang: number; hangHoa: { tenSP: string }; doanhThu: string }[];
      };
      expect(
        byRevenue.items.map((i) => [i.hang, i.hangHoa.tenSP, i.doanhThu]),
      ).toEqual([
        [1, 'A Paracetamol', '500000.00'],
        [2, 'B Vitamin C', '180000.00'],
      ]);
      const byQty = (
        await get(`top-ban-chay?${range}&tieuChi=so-luong&limit=1`).expect(200)
      ).body as { items: { hangHoa: { tenSP: string } }[] };
      expect(byQty.items.map((i) => i.hangHoa.tenSP)).toEqual([
        'A Paracetamol',
      ]);
      await get(`top-ban-chay?${range}&limit=51`).expect(400);
      await get(`top-ban-chay?${range}&tieuChi=khac`).expect(400);
    });
  });

  describe('công nợ', () => {
    it('phải thu: theo khách, nhóm tuổi nợ, trừ khoản đã thu và hàng trả lại', async () => {
      const before = (await get('cong-no-phai-thu').expect(200)).body as {
        items: {
          khachHang: { tenKH: string };
          tongConNo: string;
          nhom0_30: string;
          soPhieuConNo: number;
        }[];
        tong: { tongConNo: string; soPhieuConNo: number };
        denNgay: string;
      };
      // X: 250000 − returned 125000 = 125000; Y: 250000 + 180000 = 430000
      expect(before.items.map((i) => [i.khachHang.tenKH, i.tongConNo])).toEqual(
        [
          ['Nhà thuốc X', '125000.00'],
          ['Nhà thuốc Y', '430000.00'],
        ],
      );
      expect(before.items[0]).toMatchObject({
        nhom0_30: '125000.00',
        soPhieuConNo: 1,
      });
      expect(before.tong).toMatchObject({
        tongConNo: '555000.00',
        soPhieuConNo: 3,
      });
      expect(before.denNgay).toBe(vnDate(0));

      // pay Y's first order in full, and age Y's other order into the next bucket
      const orders = (
        await http()
          .get(
            `/api/v1/phieu-xuat-hang?khachHangId=${khachY.id}&sort=maPhieuXuatHang:asc`,
          )
          .set(as('ketoan'))
          .expect(200)
      ).body as Page<Id & { conNo: string }>;
      const first = orders.items[0]!;
      await http()
        .post('/api/v1/phieu-thu-cong-no')
        .set(as('ketoan'))
        .send({
          phieuXuatHangId: first.id,
          soTien: first.conNo,
          ngayThanhToan: vnDate(0),
          phuongThuc: 'tien_mat',
        })
        .expect(201);
      await prisma.phieuXuatHang.update({
        where: { id: orders.items[1]!.id },
        data: { ngayXuatKho: new Date(`${vnDate(-45)}T00:00:00Z`) },
      });
      const after = (
        await get(`cong-no-phai-thu?khachHangId=${khachY.id}`).expect(200)
      ).body as {
        items: { nhom0_30: string; nhom31_60: string; tongConNo: string }[];
      };
      expect(after.items).toHaveLength(1);
      expect(after.items[0]).toMatchObject({
        nhom0_30: '0.00',
        nhom31_60: expect.any(String),
      });
      expect(Number(after.items[0]!.nhom31_60)).toBeGreaterThan(0);
    });

    it('phải thu: khách đã trả hết bị ẩn mặc định, hiện khi chiConNo=false; ngày tương lai bị từ chối; chỉ vai trò tài chính', async () => {
      const paid = (await get('cong-no-phai-thu?chiConNo=false').expect(200))
        .body as { items: unknown[] };
      const onlyOwing = (await get('cong-no-phai-thu').expect(200)).body as {
        items: unknown[];
      };
      expect(paid.items.length).toBeGreaterThanOrEqual(onlyOwing.items.length);
      await get(`cong-no-phai-thu?denNgay=${vnDate(3)}`).expect(422);
      await get('cong-no-phai-thu', 'kho').expect(403);
      // as of 30 days ago only the order dated 45 days ago existed; 60 days ago nothing did
      const thirty = (
        await get(`cong-no-phai-thu?denNgay=${vnDate(-30)}`).expect(200)
      ).body as {
        items: { tongConNo: string }[];
      };
      expect(thirty.items).toHaveLength(1);
      const sixty = (
        await get(`cong-no-phai-thu?denNgay=${vnDate(-60)}`).expect(200)
      ).body as { items: unknown[] };
      expect(sixty.items).toHaveLength(0);
    });

    it('phải trả: theo nhà cung cấp, trừ khoản đã thanh toán', async () => {
      const res = (await get('cong-no-phai-tra').expect(200)).body as {
        items: {
          nhaCungCap: { tenNCC: string };
          tongConNo: string;
          nhom0_30: string;
        }[];
        tong: { tongConNo: string };
      };
      // receipts: 10 + 5 + 4 + 3 hộp = 22 × 90000 = 1980000
      expect(res.items).toHaveLength(1);
      expect(res.items[0]).toMatchObject({
        tongConNo: '1980000.00',
        nhom0_30: '1980000.00',
      });

      const receipt = (
        await http()
          .get('/api/v1/phieu-nhap-hang?pageSize=1&sort=createdAt:asc')
          .set(as('ketoan'))
          .expect(200)
      ).body as Page<Id & { conNo: string }>;
      await http()
        .post('/api/v1/phieu-thanh-toan')
        .set(as('ketoan'))
        .send({
          phieuNhapHangId: receipt.items[0]!.id,
          soTien: '900000',
          ngayThanhToan: vnDate(0),
          phuongThuc: 'chuyen_khoan',
        })
        .expect(201);
      const after = (await get('cong-no-phai-tra').expect(200)).body as {
        tong: { tongConNo: string };
      };
      expect(after.tong.tongConNo).toBe('1080000.00');
      await get(
        `cong-no-phai-tra?nhaCungCapId=00000000-0000-4000-8000-000000000000&chiConNo=false`,
      ).expect(200);
      await get('cong-no-phai-tra', 'kho').expect(403);
    });
  });
});
