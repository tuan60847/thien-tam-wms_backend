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
interface Page<T> {
  items: T[];
  meta: { total: number };
}
interface OrderBody extends Id {
  conNo: string;
  trangThaiThu: string | null;
  giaTriTraLai: string;
  chiTiet: { id: string; soLo: Id }[];
}
interface ReturnBody extends Id {
  maTraLai: string;
  trangThai: string;
  giaTri: string;
  chiTiet: {
    id: string;
    maChiTiet: string;
    soLuongCoBan: number;
    donGia: string;
    tienChietKhau: string;
    thanhTien: string;
    donViTinh: string;
  }[];
}

describe('Trả lại hàng bán (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: Tokens;
  const http = () => request(app.getHttpServer());
  const as = (user: string) => bearer(tokens, user);

  let nccId: string;
  let hangId: string;
  let lanhId: string;
  let viTriA: string;
  let viTriB: string;
  let viTriLanh: string;
  let khachId: string;

  const stock = async (soLoId: string, viTriId = viTriA) =>
    (await prisma.tonKho.findFirst({ where: { soLoId, viTriId } }))?.soLuong ??
    0;

  const receive = async (
    hangHoaId: string,
    viTri: string,
    hop: number,
  ): Promise<string> => {
    const created = (
      await http()
        .post('/api/v1/phieu-nhap-hang')
        .set(as('kho'))
        .send({
          nhaCungCapId: nccId,
          chiTiet: [
            {
              soLo: {
                hangHoaId,
                tenLo: `L${Math.random()}`,
                hanSuDung: vnDate(400),
              },
              viTriId: viTri,
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
  // 2 hộp × 125000 = 250000 (200 viên), issued.
  const issuedOrder = async (
    over: { hang?: string; viTri?: string; khach?: string } = {},
  ) => {
    const lot = await receive(over.hang ?? hangId, over.viTri ?? viTriA, 10);
    const order = (
      await http()
        .post('/api/v1/phieu-xuat-hang')
        .set(as('kho'))
        .send({
          khachHangId: over.khach ?? khachId,
          chiTiet: [
            {
              soLoId: lot,
              viTriId: over.viTri ?? viTriA,
              donViTinh: 'hộp',
              soLuong: 2,
              donGia: '125000',
            },
          ],
        })
        .expect(201)
    ).body as Id;
    await http()
      .post(`/api/v1/phieu-xuat-hang/${order.id}/xuat-kho`)
      .set(as('kho'))
      .expect(200);
    const detail = await getOrder(order.id);
    return { order: detail, lot, lineId: detail.chiTiet[0]!.id };
  };
  const getOrder = async (id: string) =>
    (
      await http()
        .get(`/api/v1/phieu-xuat-hang/${id}`)
        .set(as('ketoan'))
        .expect(200)
    ).body as OrderBody;
  const create = (
    phieuXuatHangId: string,
    chiTiet: unknown[],
    extra: Record<string, unknown> = {},
    user = 'kho',
  ) =>
    http()
      .post('/api/v1/tra-lai-hang-ban')
      .set(as(user))
      .send({ phieuXuatHangId, chiTiet, ...extra });
  const draft = async (
    phieuXuatHangId: string,
    lineId: string,
    soLuong = 1,
    extra: Record<string, unknown> = {},
  ) =>
    (
      await create(phieuXuatHangId, [
        { chiTietPhieuXuatHangId: lineId, soLuong, ...extra },
      ]).expect(201)
    ).body as ReturnBody;
  const confirm = (id: string, user = 'quanly') =>
    http().post(`/api/v1/tra-lai-hang-ban/${id}/xac-nhan`).set(as(user));
  const cancel = (id: string, user = 'quanly') =>
    http()
      .post(`/api/v1/tra-lai-hang-ban/${id}/huy`)
      .set(as(user))
      .send({ lyDo: 'nhầm' });

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
    khachId = (
      await http()
        .post('/api/v1/khach-hang')
        .set(as('ketoan'))
        .send({ tenKH: 'Nhà thuốc A', ngayHetHanGPKD: vnDate(400) })
        .expect(201)
    ).body.id as string;
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
        .send({ tenKho: 'Kho' })
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

  it('lập nháp: mã TL…, lô/giá lấy từ dòng xuất, chưa đổi tồn và công nợ', async () => {
    const { order, lot, lineId } = await issuedOrder();
    const before = await stock(lot);
    const ret = await draft(order.id, lineId, 1);
    expect(ret.maTraLai).toMatch(/^TL\d{6}\d{4}$/);
    expect(ret.trangThai).toBe('cho_xac_nhan');
    expect(ret.chiTiet[0]).toMatchObject({
      maChiTiet: `${ret.maTraLai}-01`,
      donViTinh: 'hộp',
      soLuongCoBan: 100,
      donGia: '125000.00',
      thanhTien: '125000.00',
    });
    expect(ret.giaTri).toBe('125000.00');
    expect(await stock(lot)).toBe(before);
    expect((await getOrder(order.id)).conNo).toBe('250000.00');
  });

  it('xác nhận: nhập lại kho đúng vị trí, ghi sổ biến động tra_hang, giảm công nợ, đối soát không lệch', async () => {
    const { order, lot, lineId } = await issuedOrder();
    const before = await stock(lot);
    const ret = await draft(order.id, lineId, 1);
    const done = (await confirm(ret.id).expect(200)).body as ReturnBody;
    expect(done.trangThai).toBe('da_nhap_kho');
    expect(await stock(lot)).toBe(before + 100);

    const after = await getOrder(order.id);
    expect(after).toMatchObject({
      conNo: '125000.00',
      giaTriTraLai: '125000.00',
      trangThaiThu: 'thu_mot_phan',
    });

    const log = await http()
      .get(`/api/v1/ton-kho/bien-dong?soLoId=${lot}&loai=tra_hang`)
      .set(as('ketoan'))
      .expect(200);
    expect(
      (log.body as Page<{ soLuongThayDoi: number; thamChieu: { id: string } }>)
        .items,
    ).toMatchObject([{ soLuongThayDoi: 100, thamChieu: { id: ret.id } }]);
    expect(
      (
        await http()
          .get('/api/v1/ton-kho/doi-soat')
          .set(as('admin'))
          .expect(200)
      ).body,
    ).toMatchObject({ soDongLech: 0 });

    // returning everything leaves nothing owed
    const rest = await draft(order.id, lineId, 1);
    await confirm(rest.id).expect(200);
    expect(await getOrder(order.id)).toMatchObject({
      conNo: '0.00',
      trangThaiThu: 'da_thu_du',
    });
  });

  it('trả quá số đã bán (kể cả các phiếu nháp khác) → 422; xác nhận hai lần → 409', async () => {
    const { order, lineId } = await issuedOrder();
    const over = await create(order.id, [
      { chiTietPhieuXuatHangId: lineId, soLuong: 3 },
    ]);
    expect(over.status).toBe(422);
    expect((over.body as ErrorBody).code).toBe('TRA_LAI_QUANTITY_EXCEEDED');

    const first = await draft(order.id, lineId, 1);
    const second = await create(order.id, [
      { chiTietPhieuXuatHangId: lineId, soLuong: 2 },
    ]);
    expect((second.body as ErrorBody).code).toBe('TRA_LAI_QUANTITY_EXCEEDED');
    await draft(order.id, lineId, 1);

    await confirm(first.id).expect(200);
    const again = await confirm(first.id);
    expect(again.status).toBe(409);
    expect((again.body as ErrorBody).code).toBe('TRA_LAI_INVALID_STATE');
  });

  it('đổi đơn vị tính: trả theo viên cần đơn giá; số viên quy đổi đúng và có chiết khấu', async () => {
    const { order, lot, lineId } = await issuedOrder();
    const noPrice = await create(order.id, [
      { chiTietPhieuXuatHangId: lineId, soLuong: 30, donViTinh: 'viên' },
    ]);
    expect(noPrice.status).toBe(400);
    const bad = await create(order.id, [
      {
        chiTietPhieuXuatHangId: lineId,
        soLuong: 1,
        donViTinh: 'thùng',
        donGia: '1000',
      },
    ]);
    expect((bad.body as ErrorBody).code).toBe('TRA_LAI_UNIT_INVALID');

    const ret = (
      await create(order.id, [
        {
          chiTietPhieuXuatHangId: lineId,
          soLuong: 30,
          donViTinh: 'viên',
          donGia: '1250',
          tyLeChietKhau: '10',
        },
      ]).expect(201)
    ).body as ReturnBody;
    // 30 × 1250 = 37500; 10% = 3750 → 33750
    expect(ret.chiTiet[0]).toMatchObject({
      soLuongCoBan: 30,
      tienChietKhau: '3750.00',
      thanhTien: '33750.00',
    });
    const before = await stock(lot);
    await confirm(ret.id).expect(200);
    expect(await stock(lot)).toBe(before + 30);
    expect((await getOrder(order.id)).conNo).toBe('216250.00');
  });

  it('đã thu đủ thì không trả được (cần hoàn tiền): 422 và vẫn là nháp; bỏ đối trừ rồi trả được', async () => {
    const { order, lot, lineId } = await issuedOrder();
    const receipt = (
      await http()
        .post('/api/v1/phieu-thu-cong-no')
        .set(as('ketoan'))
        .send({
          phieuXuatHangId: order.id,
          soTien: '250000',
          ngayThanhToan: vnDate(0),
          phuongThuc: 'tien_mat',
        })
        .expect(201)
    ).body as Id;
    const ret = await draft(order.id, lineId, 1);
    const before = await stock(lot);
    const res = await confirm(ret.id);
    expect(res.status).toBe(422);
    expect((res.body as ErrorBody).code).toBe('TRA_LAI_EXCEEDS_DEBT');
    expect(await stock(lot)).toBe(before);
    expect(
      (
        (
          await http()
            .get(`/api/v1/tra-lai-hang-ban/${ret.id}`)
            .set(as('ketoan'))
            .expect(200)
        ).body as ReturnBody
      ).trangThai,
    ).toBe('cho_xac_nhan');

    await http()
      .post(`/api/v1/phieu-thu-cong-no/${receipt.id}/huy`)
      .set(as('ketoan'))
      .send({ lyDo: 'hoàn tiền' })
      .expect(200);
    await confirm(ret.id).expect(200);
  });

  it('hủy: nháp (kể cả NVK) không đụng tồn; đã nhập lại kho chỉ quản lý, trừ tồn và nợ tăng lại', async () => {
    const { order, lot, lineId } = await issuedOrder();
    const nhap = await draft(order.id, lineId, 1);
    expect(((await cancel(nhap.id, 'kho')).body as ReturnBody).trangThai).toBe(
      'da_huy',
    );

    const ret = await draft(order.id, lineId, 1);
    await confirm(ret.id).expect(200);
    const afterReturn = await stock(lot);
    await cancel(ret.id, 'kho').expect(403);
    await cancel(ret.id, 'quanly').expect(200);
    expect(await stock(lot)).toBe(afterReturn - 100);
    expect((await getOrder(order.id)).conNo).toBe('250000.00');
    expect(
      await prisma.nhatKyHeThong.count({
        where: { hanhDong: 'tra_lai.cancel_after_receipt', doiTuongId: ret.id },
      }),
    ).toBe(1);
    expect(((await cancel(ret.id)).body as ErrorBody).code).toBe(
      'TRA_LAI_INVALID_STATE',
    );
  });

  it('hủy phiếu đã nhập lại khi hàng đã đi mất → 409 và rollback', async () => {
    const { order, lot, lineId } = await issuedOrder();
    const ret = await draft(order.id, lineId, 2);
    await confirm(ret.id).expect(200);
    // someone takes the returned goods out of the location through a stock adjustment
    await http()
      .post('/api/v1/ton-kho/dieu-chinh')
      .set(as('quanly'))
      .send({ soLoId: lot, viTriId: viTriA, soLuongMoi: 0, lyDo: 'xuất đi' })
      .expect(201);
    const res = await cancel(ret.id);
    expect(res.status).toBe(409);
    expect((res.body as ErrorBody).code).toBe('TRA_LAI_CANNOT_REVERSE');
    expect(
      (
        (
          await http()
            .get(`/api/v1/tra-lai-hang-ban/${ret.id}`)
            .set(as('ketoan'))
            .expect(200)
        ).body as ReturnBody
      ).trangThai,
    ).toBe('da_nhap_kho');
  });

  it('phiếu xuất đã có phiếu trả lại không hủy được; phiếu xuất nháp/đã hủy không trả được', async () => {
    const { order, lineId } = await issuedOrder();
    const ret = await draft(order.id, lineId, 1);
    await confirm(ret.id).expect(200);
    const blocked = await http()
      .post(`/api/v1/phieu-xuat-hang/${order.id}/huy`)
      .set(as('quanly'))
      .send({ lyDo: 'x' });
    expect(blocked.status).toBe(409);
    expect((blocked.body as ErrorBody).code).toBe('PHIEU_XUAT_CANNOT_REVERSE');

    const lot = await receive(hangId, viTriA, 3);
    const pending = (
      await http()
        .post('/api/v1/phieu-xuat-hang')
        .set(as('kho'))
        .send({
          khachHangId: khachId,
          chiTiet: [
            {
              soLoId: lot,
              viTriId: viTriA,
              donViTinh: 'hộp',
              soLuong: 1,
              donGia: '125000',
            },
          ],
        })
        .expect(201)
    ).body as Id;
    const res = await create(pending.id, []);
    expect(res.status).toBe(422);
    expect((res.body as ErrorBody).code).toBe('TRA_LAI_ORDER_INVALID');
    expect(
      (await create('00000000-0000-4000-8000-000000000000', [])).status,
    ).toBe(404);
  });

  it('dòng không thuộc phiếu xuất hoặc trùng → 422; xác nhận phiếu rỗng → 422; ngày sai → 422', async () => {
    const one = await issuedOrder();
    const other = await issuedOrder();
    const foreign = await create(one.order.id, [
      { chiTietPhieuXuatHangId: other.lineId, soLuong: 1 },
    ]);
    expect((foreign.body as ErrorBody).code).toBe('TRA_LAI_LINE_INVALID');
    const dup = await create(one.order.id, [
      { chiTietPhieuXuatHangId: one.lineId, soLuong: 1 },
      { chiTietPhieuXuatHangId: one.lineId, soLuong: 1 },
    ]);
    expect((dup.body as ErrorBody).code).toBe('TRA_LAI_LINE_INVALID');

    const empty = (await create(one.order.id, []).expect(201))
      .body as ReturnBody;
    const res = await confirm(empty.id);
    expect(res.status).toBe(422);
    expect((res.body as ErrorBody).code).toBe('TRA_LAI_EMPTY');

    for (const ngayTraLai of [vnDate(2), vnDate(-30)]) {
      const bad = await create(one.order.id, [], { ngayTraLai });
      expect((bad.body as ErrorBody).code).toBe('TRA_LAI_DATE_INVALID');
    }
  });

  it('trả vào vị trí khác; hàng lạnh phải về vị trí cấp đông', async () => {
    const normal = await issuedOrder();
    const moved = await draft(normal.order.id, normal.lineId, 1, {
      viTriId: viTriB,
    });
    await confirm(moved.id).expect(200);
    expect(await stock(normal.lot, viTriB)).toBe(100);

    const coldLot = await receive(lanhId, viTriLanh, 5);
    const coldOrder = (
      await http()
        .post('/api/v1/phieu-xuat-hang')
        .set(as('kho'))
        .send({
          khachHangId: khachId,
          chiTiet: [
            {
              soLoId: coldLot,
              viTriId: viTriLanh,
              donViTinh: 'hộp',
              soLuong: 1,
              donGia: '125000',
            },
          ],
        })
        .expect(201)
    ).body as Id;
    await http()
      .post(`/api/v1/phieu-xuat-hang/${coldOrder.id}/xuat-kho`)
      .set(as('kho'))
      .expect(200);
    const detail = await getOrder(coldOrder.id);
    const wrong = await create(coldOrder.id, [
      {
        chiTietPhieuXuatHangId: detail.chiTiet[0]!.id,
        soLuong: 1,
        viTriId: viTriA,
      },
    ]);
    expect(wrong.status).toBe(422);
    expect((wrong.body as ErrorBody).code).toBe('TON_KHO_COLD_CHAIN_VIOLATION');
  });

  it('sửa nháp thay dòng; xóa nháp; phiếu đã xác nhận không sửa/xóa được', async () => {
    const { order, lineId } = await issuedOrder();
    const ret = await draft(order.id, lineId, 1);
    const patched = (
      await http()
        .patch(`/api/v1/tra-lai-hang-ban/${ret.id}`)
        .set(as('kho'))
        .send({
          chiTiet: [{ chiTietPhieuXuatHangId: lineId, soLuong: 2 }],
          lyDo: 'hết hạn',
        })
        .expect(200)
    ).body as ReturnBody;
    expect(patched.giaTri).toBe('250000.00');
    await http()
      .delete(`/api/v1/tra-lai-hang-ban/${ret.id}`)
      .set(as('kho'))
      .expect(204);
    await http()
      .get(`/api/v1/tra-lai-hang-ban/${ret.id}`)
      .set(as('kho'))
      .expect(404);

    const real = await draft(order.id, lineId, 1);
    await confirm(real.id).expect(200);
    const edit = await http()
      .patch(`/api/v1/tra-lai-hang-ban/${real.id}`)
      .set(as('kho'))
      .send({ lyDo: 'x' });
    expect((edit.body as ErrorBody).code).toBe('TRA_LAI_INVALID_STATE');
    expect(
      (
        await http()
          .delete(`/api/v1/tra-lai-hang-ban/${real.id}`)
          .set(as('kho'))
      ).status,
    ).toBe(409);
  });

  it('hai xác nhận đồng thời → đúng một thành công, tồn chỉ tăng một lần', async () => {
    const { order, lot, lineId } = await issuedOrder();
    const ret = await draft(order.id, lineId, 1);
    const before = await stock(lot);
    const results = await Promise.all([confirm(ret.id), confirm(ret.id)]);
    expect(results.map((r) => r.status).sort((x, y) => x - y)).toEqual([
      200, 409,
    ]);
    expect(await stock(lot)).toBe(before + 100);
  });

  it('danh sách và lọc; phân quyền: kế toán chỉ đọc, NVK không xác nhận', async () => {
    const list = async (qs: string) =>
      (
        await http()
          .get(`/api/v1/tra-lai-hang-ban?${qs}`)
          .set(as('ketoan'))
          .expect(200)
      ).body as Page<ReturnBody>;
    const all = await list('pageSize=100');
    expect(all.meta.total).toBeGreaterThan(5);
    expect(
      (await list('trangThai=da_nhap_kho,da_huy&pageSize=100')).items.every(
        (r) => r.trangThai !== 'cho_xac_nhan',
      ),
    ).toBe(true);
    expect((await list(`khachHangId=${khachId}&pageSize=100`)).meta.total).toBe(
      all.meta.total,
    );
    expect(
      (await list(`ngayTraLaiFrom=${vnDate(1)}&ngayTraLaiTo=${vnDate(2)}`)).meta
        .total,
    ).toBe(0);
    await http()
      .get('/api/v1/tra-lai-hang-ban?sort=lyDo:asc')
      .set(as('ketoan'))
      .expect(400);

    const { order, lineId } = await issuedOrder();
    await create(order.id, [], {}, 'ketoan').expect(403);
    const ret = await draft(order.id, lineId, 1);
    await confirm(ret.id, 'kho').expect(403);
    await confirm(ret.id, 'ketoan').expect(403);
    await http().get('/api/v1/tra-lai-hang-ban').expect(401);
  });
});
