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
  details?: unknown;
}
interface Page<T> {
  items: T[];
  meta: { total: number };
}
interface ReceiptBody {
  id: string;
  soTien: string;
  daHuy: boolean;
  soTienChuaDoiTru: string;
  phieuXuat: { id: string };
  phanBo: {
    doiTruId: string;
    phieuXuatId: string;
    soTien: string;
    daBo: boolean;
  }[];
}
interface AllocationBody {
  id: string;
  soTienDoiTru: string;
  daBo: boolean;
}

describe('Thu gộp và đối trừ chứng từ (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: Tokens;
  const http = () => request(app.getHttpServer());
  const as = (user: string) => bearer(tokens, user);

  let nccId: string;
  let hangId: string;
  let viTriId: string;
  let lotId: string;

  const newCustomer = async (): Promise<Id> =>
    (
      await http()
        .post('/api/v1/khach-hang')
        .set(as('ketoan'))
        .send({ tenKH: `KH ${Math.random()}`, ngayHetHanGPKD: vnDate(400) })
        .expect(201)
    ).body as Id;
  // Order of 2 hộp × 125000 = 250000, issued (no VAT, no discount).
  const issuedOrder = async (khachHangId: string, daysAgo = 0): Promise<Id> => {
    const order = (
      await http()
        .post('/api/v1/phieu-xuat-hang')
        .set(as('kho'))
        .send({
          khachHangId,
          chiTiet: [
            {
              soLoId: lotId,
              viTriId,
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
    if (daysAgo) {
      await prisma.phieuXuatHang.update({
        where: { id: order.id },
        data: { ngayXuatKho: new Date(`${vnDate(-daysAgo)}T00:00:00Z`) },
      });
    }
    return order;
  };
  const thuGop = (body: Record<string, unknown>, user = 'ketoan') =>
    http()
      .post('/api/v1/phieu-thu-cong-no/thu-gop')
      .set(as(user))
      .send({ ngayThanhToan: vnDate(0), phuongThuc: 'chuyen_khoan', ...body });
  const doiTru = (body: Record<string, unknown>, user = 'ketoan') =>
    http().post('/api/v1/doi-tru-chung-tu').set(as(user)).send(body);
  const conNo = async (orderId: string): Promise<string> =>
    (
      await http()
        .get(`/api/v1/phieu-xuat-hang/${orderId}`)
        .set(as('ketoan'))
        .expect(200)
    ).body.conNo as string;
  const receipt = async (id: string): Promise<ReceiptBody> =>
    (
      await http()
        .get(`/api/v1/phieu-thu-cong-no/${id}`)
        .set(as('ketoan'))
        .expect(200)
    ).body as ReceiptBody;

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
    hangId = (await createHangHoa(app, tokens, loai.id)).id;
    const kho = (
      await http()
        .post('/api/v1/kho')
        .set(as('quanly'))
        .send({ tenKho: 'Kho' })
        .expect(201)
    ).body as Id;
    viTriId = (
      await http()
        .post('/api/v1/vi-tri')
        .set(as('quanly'))
        .send({ khoId: kho.id, tenViTri: 'A1' })
        .expect(201)
    ).body.id as string;
    const receiptIn = (
      await http()
        .post('/api/v1/phieu-nhap-hang')
        .set(as('kho'))
        .send({
          nhaCungCapId: nccId,
          chiTiet: [
            {
              soLo: {
                hangHoaId: hangId,
                tenLo: 'LOT-BIG',
                hanSuDung: vnDate(400),
              },
              viTriId,
              donViTinh: 'hộp',
              soLuong: 500,
              donGia: '90000',
            },
          ],
        })
        .expect(201)
    ).body as Id & { chiTiet: { soLo: Id }[] };
    await http()
      .post(`/api/v1/phieu-nhap-hang/${receiptIn.id}/xac-nhan`)
      .set(as('quanly'))
      .send({})
      .expect(200);
    lotId = receiptIn.chiTiet[0]!.soLo.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('thu gộp', () => {
    it('phân bổ tay: một phiếu thu trả đủ phiếu này, một phần phiếu kia', async () => {
      const khach = await newCustomer();
      const a = await issuedOrder(khach.id);
      const b = await issuedOrder(khach.id);
      const res = await thuGop({
        khachHangId: khach.id,
        soTien: '400000',
        phanBo: [
          { phieuXuatHangId: a.id, soTien: '250000' },
          { phieuXuatHangId: b.id, soTien: '150000' },
        ],
        nguoiNop: 'Chị Hương',
      }).expect(201);
      const body = res.body as ReceiptBody;
      expect(body.soTien).toBe('400000.00');
      expect(body.soTienChuaDoiTru).toBe('0.00');
      const byOrder = Object.fromEntries(
        body.phanBo.map((p) => [p.phieuXuatId, p.soTien]),
      );
      expect(byOrder).toEqual({ [a.id]: '250000.00', [b.id]: '150000.00' });
      expect(await conNo(a.id)).toBe('0.00');
      expect(await conNo(b.id)).toBe('100000.00');

      const detail = await http()
        .get(`/api/v1/phieu-xuat-hang/${b.id}`)
        .set(as('ketoan'))
        .expect(200);
      expect(detail.body).toMatchObject({
        trangThaiThu: 'thu_mot_phan',
        daThu: '150000.00',
      });
      // the combined receipt is found from either order
      const list = await http()
        .get(`/api/v1/phieu-thu-cong-no?phieuXuatHangId=${b.id}`)
        .set(as('ketoan'))
        .expect(200);
      expect((list.body as Page<Id>).items.map((r) => r.id)).toContain(body.id);
    });

    it('tự phân bổ FIFO: phiếu cũ nhất được trả trước; tiền dư ở lại phiếu thu', async () => {
      const khach = await newCustomer();
      const oldest = await issuedOrder(khach.id, 20);
      const middle = await issuedOrder(khach.id, 10);
      const newest = await issuedOrder(khach.id, 1);
      const res = (
        await thuGop({
          khachHangId: khach.id,
          soTien: '300000',
          tuDongPhanBo: true,
        }).expect(201)
      ).body as ReceiptBody;
      expect(res.phanBo.map((p) => [p.phieuXuatId, p.soTien])).toEqual([
        [oldest.id, '250000.00'],
        [middle.id, '50000.00'],
      ]);
      expect(res.phieuXuat.id).toBe(oldest.id);
      expect(await conNo(newest.id)).toBe('250000.00');

      // more money than the whole debt: everything is paid, the rest stays unapplied
      const big = (
        await thuGop({
          khachHangId: khach.id,
          soTien: '1000000',
          tuDongPhanBo: true,
        }).expect(201)
      ).body as ReceiptBody;
      expect(big.phanBo.reduce((s, p) => s + Number(p.soTien), 0)).toBe(450000);
      expect(big.soTienChuaDoiTru).toBe('550000.00');
      expect(await conNo(middle.id)).toBe('0.00');
    });

    it('khách hết nợ → 422 EXCEEDS_DEBT; thiếu hoặc thừa kiểu phân bổ → 400', async () => {
      const khach = await newCustomer();
      const clear = await thuGop({
        khachHangId: khach.id,
        soTien: '1000',
        tuDongPhanBo: true,
      });
      expect(clear.status).toBe(422);
      expect((clear.body as ErrorBody).code).toBe('PHIEU_THU_EXCEEDS_DEBT');
      const order = await issuedOrder(khach.id);
      expect(
        (await thuGop({ khachHangId: khach.id, soTien: '1000' })).status,
      ).toBe(400);
      expect(
        (
          await thuGop({
            khachHangId: khach.id,
            soTien: '1000',
            tuDongPhanBo: true,
            phanBo: [{ phieuXuatHangId: order.id, soTien: '1000' }],
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await thuGop({
            khachHangId: khach.id,
            soTien: '0',
            tuDongPhanBo: true,
          })
        ).status,
      ).toBe(400);
    });

    it('phân bổ sai: trùng phiếu, vượt số tiền thu, vượt nợ, khác khách, phiếu nháp, không tồn tại', async () => {
      const khach = await newCustomer();
      const other = await newCustomer();
      const mine = await issuedOrder(khach.id);
      const theirs = await issuedOrder(other.id);
      const draft = (
        await http()
          .post('/api/v1/phieu-xuat-hang')
          .set(as('kho'))
          .send({
            khachHangId: khach.id,
            chiTiet: [
              {
                soLoId: lotId,
                viTriId,
                donViTinh: 'hộp',
                soLuong: 1,
                donGia: '125000',
              },
            ],
          })
          .expect(201)
      ).body as Id;
      const code = async (body: Record<string, unknown>) =>
        ((await thuGop({ khachHangId: khach.id, ...body })).body as ErrorBody)
          .code;

      expect(
        await code({
          soTien: '2000',
          phanBo: [
            { phieuXuatHangId: mine.id, soTien: '1000' },
            { phieuXuatHangId: mine.id, soTien: '1000' },
          ],
        }),
      ).toBe('PHIEU_THU_ALLOCATION_INVALID');
      expect(
        await code({
          soTien: '1000',
          phanBo: [{ phieuXuatHangId: mine.id, soTien: '2000' }],
        }),
      ).toBe('PHIEU_THU_ALLOCATION_INVALID');
      expect(
        await code({
          soTien: '300000',
          phanBo: [{ phieuXuatHangId: mine.id, soTien: '250001' }],
        }),
      ).toBe('PHIEU_THU_EXCEEDS_DEBT');
      expect(
        await code({
          soTien: '1000',
          phanBo: [{ phieuXuatHangId: theirs.id, soTien: '1000' }],
        }),
      ).toBe('PHIEU_THU_CUSTOMER_MISMATCH');
      expect(
        await code({
          soTien: '1000',
          phanBo: [{ phieuXuatHangId: draft.id, soTien: '1000' }],
        }),
      ).toBe('PHIEU_THU_ORDER_INVALID_STATE');
      expect(
        await code({
          soTien: '1000',
          phanBo: [
            {
              phieuXuatHangId: '00000000-0000-4000-8000-000000000000',
              soTien: '1000',
            },
          ],
        }),
      ).toBe('PHIEU_XUAT_NOT_FOUND');
      const ghost = await thuGop({
        khachHangId: '00000000-0000-4000-8000-000000000000',
        soTien: '1000',
        tuDongPhanBo: true,
      });
      expect((ghost.body as ErrorBody).code).toBe('KHACH_HANG_NOT_FOUND');
      // nothing was written by the failed attempts
      expect(await conNo(mine.id)).toBe('250000.00');
    });

    it('hủy phiếu thu gộp trả nợ lại cho tất cả các phiếu xuất; phân quyền', async () => {
      const khach = await newCustomer();
      const a = await issuedOrder(khach.id);
      const b = await issuedOrder(khach.id);
      const res = (
        await thuGop({
          khachHangId: khach.id,
          soTien: '500000',
          phanBo: [
            { phieuXuatHangId: a.id, soTien: '250000' },
            { phieuXuatHangId: b.id, soTien: '250000' },
          ],
        }).expect(201)
      ).body as ReceiptBody;
      // an order with an active allocation cannot be cancelled
      const blocked = await http()
        .post(`/api/v1/phieu-xuat-hang/${a.id}/huy`)
        .set(as('quanly'))
        .send({ lyDo: 'x' });
      expect(blocked.status).toBe(409);
      expect((blocked.body as ErrorBody).code).toBe(
        'PHIEU_XUAT_CANNOT_REVERSE',
      );

      await http()
        .post(`/api/v1/phieu-thu-cong-no/${res.id}/huy`)
        .set(as('ketoan'))
        .send({ lyDo: 'nhầm' })
        .expect(200);
      expect(await conNo(a.id)).toBe('250000.00');
      expect(await conNo(b.id)).toBe('250000.00');
      const after = await receipt(res.id);
      expect(after).toMatchObject({ daHuy: true, soTienChuaDoiTru: '0.00' });
      expect(after.phanBo.every((p) => p.daBo)).toBe(true);
      await http()
        .post(`/api/v1/phieu-xuat-hang/${a.id}/huy`)
        .set(as('quanly'))
        .send({ lyDo: 'ok' })
        .expect(200);

      await thuGop(
        { khachHangId: khach.id, soTien: '1', tuDongPhanBo: true },
        'quanly',
      ).expect(403);
      await thuGop(
        { khachHangId: khach.id, soTien: '1', tuDongPhanBo: true },
        'kho',
      ).expect(403);
    });

    it('hai phiếu thu gộp đồng thời cùng trả hết một phiếu xuất → một thành công, một 422', async () => {
      const khach = await newCustomer();
      const order = await issuedOrder(khach.id);
      const send = () =>
        thuGop({
          khachHangId: khach.id,
          soTien: '250000',
          phanBo: [{ phieuXuatHangId: order.id, soTien: '250000' }],
        });
      const results = await Promise.all([send(), send()]);
      expect(results.map((r) => r.status).sort((x, y) => x - y)).toEqual([
        201, 422,
      ]);
      expect(await conNo(order.id)).toBe('0.00');
    });
  });

  describe('đối trừ chứng từ', () => {
    it('áp số tiền chưa đối trừ vào phiếu xuất khác; vượt số chưa đối trừ hoặc vượt nợ bị từ chối', async () => {
      const khach = await newCustomer();
      const a = await issuedOrder(khach.id);
      const b = await issuedOrder(khach.id);
      const rec = (
        await thuGop({
          khachHangId: khach.id,
          soTien: '500000',
          phanBo: [{ phieuXuatHangId: a.id, soTien: '250000' }],
        }).expect(201)
      ).body as ReceiptBody;
      expect(rec.soTienChuaDoiTru).toBe('250000.00');

      const over = await doiTru({
        phieuThuCongNoId: rec.id,
        phieuXuatHangId: b.id,
        soTienDoiTru: '250001',
      });
      expect(over.status).toBe(422);
      expect((over.body as ErrorBody).code).toBe('DOI_TRU_EXCEEDS_UNALLOCATED');

      const ok = await doiTru({
        phieuThuCongNoId: rec.id,
        phieuXuatHangId: b.id,
        soTienDoiTru: '200000',
      }).expect(201);
      expect(ok.body).toMatchObject({
        soTienDoiTru: '200000.00',
        daBo: false,
        phieuThuCongNo: { id: rec.id },
        phieuXuat: { id: b.id },
      });
      expect(await conNo(b.id)).toBe('50000.00');
      expect((await receipt(rec.id)).soTienChuaDoiTru).toBe('50000.00');

      // only 50000 is left on the receipt, and order b owes 50000
      const left = await doiTru({
        phieuThuCongNoId: rec.id,
        phieuXuatHangId: b.id,
        soTienDoiTru: '50001',
      });
      expect((left.body as ErrorBody).code).toBe('DOI_TRU_EXCEEDS_UNALLOCATED');
      await doiTru({
        phieuThuCongNoId: rec.id,
        phieuXuatHangId: b.id,
        soTienDoiTru: '50000',
      }).expect(201);
      expect(await conNo(b.id)).toBe('0.00');
    });

    it('phiếu thu của khách khác, phiếu thu đã hủy, phiếu xuất nháp hoặc không có → lỗi tương ứng', async () => {
      const khach = await newCustomer();
      const other = await newCustomer();
      const a = await issuedOrder(khach.id);
      const theirs = await issuedOrder(other.id);
      const rec = (
        await thuGop({
          khachHangId: khach.id,
          soTien: '300000',
          phanBo: [{ phieuXuatHangId: a.id, soTien: '100000' }],
        }).expect(201)
      ).body as ReceiptBody;
      const code = async (body: Record<string, unknown>) => {
        const res = await doiTru({
          phieuThuCongNoId: rec.id,
          soTienDoiTru: '1000',
          ...body,
        });
        return (res.body as ErrorBody).code;
      };
      expect(await code({ phieuXuatHangId: theirs.id })).toBe(
        'PHIEU_THU_CUSTOMER_MISMATCH',
      );
      expect(
        await code({ phieuXuatHangId: '00000000-0000-4000-8000-000000000000' }),
      ).toBe('PHIEU_XUAT_NOT_FOUND');
      const ghostReceipt = await doiTru({
        phieuThuCongNoId: '00000000-0000-4000-8000-000000000000',
        phieuXuatHangId: a.id,
        soTienDoiTru: '1000',
      });
      expect((ghostReceipt.body as ErrorBody).code).toBe('PHIEU_THU_NOT_FOUND');

      await http()
        .post(`/api/v1/phieu-thu-cong-no/${rec.id}/huy`)
        .set(as('ketoan'))
        .send({ lyDo: 'hủy' })
        .expect(200);
      expect(await code({ phieuXuatHangId: a.id })).toBe(
        'PHIEU_THU_ALREADY_VOID',
      );
      expect(
        (
          await doiTru({
            phieuThuCongNoId: rec.id,
            phieuXuatHangId: a.id,
            soTienDoiTru: '0',
          })
        ).status,
      ).toBe(400);
    });

    it('bỏ đối trừ: nợ của phiếu xuất tăng lại, tiền về số chưa đối trừ; bỏ hai lần → 409', async () => {
      const khach = await newCustomer();
      const a = await issuedOrder(khach.id);
      const b = await issuedOrder(khach.id);
      const rec = (
        await thuGop({
          khachHangId: khach.id,
          soTien: '300000',
          phanBo: [
            { phieuXuatHangId: a.id, soTien: '250000' },
            { phieuXuatHangId: b.id, soTien: '50000' },
          ],
        }).expect(201)
      ).body as ReceiptBody;
      const alloc = rec.phanBo.find((p) => p.phieuXuatId === a.id)!;
      const removed = await http()
        .post(`/api/v1/doi-tru-chung-tu/${alloc.doiTruId}/bo`)
        .set(as('ketoan'))
        .send({ lyDo: 'áp nhầm phiếu' })
        .expect(200);
      expect((removed.body as AllocationBody).daBo).toBe(true);
      expect(await conNo(a.id)).toBe('250000.00');
      expect((await receipt(rec.id)).soTienChuaDoiTru).toBe('250000.00');

      const again = await http()
        .post(`/api/v1/doi-tru-chung-tu/${alloc.doiTruId}/bo`)
        .set(as('ketoan'))
        .send({ lyDo: 'x' });
      expect(again.status).toBe(409);
      expect((again.body as ErrorBody).code).toBe('DOI_TRU_ALREADY_REMOVED');
      await http()
        .post(`/api/v1/doi-tru-chung-tu/${alloc.doiTruId}/bo`)
        .set(as('ketoan'))
        .send({})
        .expect(400);
      expect(
        (
          await http()
            .post(
              '/api/v1/doi-tru-chung-tu/00000000-0000-4000-8000-000000000000/bo',
            )
            .set(as('ketoan'))
            .send({ lyDo: 'x' })
        ).status,
      ).toBe(404);
      expect(
        await prisma.nhatKyHeThong.count({
          where: { hanhDong: 'doi_tru.remove', doiTuongId: alloc.doiTruId },
        }),
      ).toBe(1);

      // the freed money can be applied again, to the same order or another one
      await doiTru({
        phieuThuCongNoId: rec.id,
        phieuXuatHangId: a.id,
        soTienDoiTru: '250000',
      }).expect(201);
      expect(await conNo(a.id)).toBe('0.00');
    });

    it('danh sách và lọc; quản lý chỉ đọc, nhân viên kho không truy cập', async () => {
      const khach = await newCustomer();
      const a = await issuedOrder(khach.id);
      const rec = (
        await thuGop({
          khachHangId: khach.id,
          soTien: '100000',
          phanBo: [{ phieuXuatHangId: a.id, soTien: '100000' }],
        }).expect(201)
      ).body as ReceiptBody;
      const mine = await http()
        .get(`/api/v1/doi-tru-chung-tu?khachHangId=${khach.id}`)
        .set(as('quanly'))
        .expect(200);
      expect((mine.body as Page<AllocationBody>).meta.total).toBe(1);
      const byReceipt = await http()
        .get(`/api/v1/doi-tru-chung-tu?phieuThuCongNoId=${rec.id}&daBo=false`)
        .set(as('ketoan'))
        .expect(200);
      expect((byReceipt.body as Page<AllocationBody>).items).toHaveLength(1);
      const removedOnly = await http()
        .get(`/api/v1/doi-tru-chung-tu?khachHangId=${khach.id}&daBo=true`)
        .set(as('ketoan'))
        .expect(200);
      expect((removedOnly.body as Page<AllocationBody>).meta.total).toBe(0);
      const id = (mine.body as Page<AllocationBody>).items[0]!.id;
      await http()
        .get(`/api/v1/doi-tru-chung-tu/${id}`)
        .set(as('quanly'))
        .expect(200);
      await http()
        .get(`/api/v1/doi-tru-chung-tu/${id}`)
        .set(as('kho'))
        .expect(403);
      await http().get('/api/v1/doi-tru-chung-tu').expect(401);
      await doiTru(
        { phieuThuCongNoId: rec.id, phieuXuatHangId: a.id, soTienDoiTru: '1' },
        'quanly',
      ).expect(403);
      await http()
        .get('/api/v1/doi-tru-chung-tu?sort=ghiChu:asc')
        .set(as('ketoan'))
        .expect(400);
    });
  });

  it('phiếu thu một phiếu xuất (API cũ) tự ghi một khoản đối trừ; hủy phiếu thu bỏ khoản đó', async () => {
    const khach = await newCustomer();
    const order = await issuedOrder(khach.id);
    const single = (
      await http()
        .post('/api/v1/phieu-thu-cong-no')
        .set(as('ketoan'))
        .send({
          phieuXuatHangId: order.id,
          soTien: '100000',
          ngayThanhToan: vnDate(0),
          phuongThuc: 'tien_mat',
        })
        .expect(201)
    ).body as ReceiptBody;
    expect(single.phanBo).toHaveLength(1);
    expect(single).toMatchObject({ soTienChuaDoiTru: '0.00' });
    expect(await conNo(order.id)).toBe('150000.00');
    await http()
      .post(`/api/v1/phieu-thu-cong-no/${single.id}/huy`)
      .set(as('ketoan'))
      .send({ lyDo: 'sai' })
      .expect(200);
    expect(await conNo(order.id)).toBe('250000.00');
  });
});
