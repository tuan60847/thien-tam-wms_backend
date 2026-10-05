import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { bearer, loginAll, type Tokens } from './helpers/catalog.js';
import { createTestApp } from './helpers/create-app.js';
import { vnDate } from './helpers/dates.js';
import { migrateTestDatabase, resetAndSeed } from './helpers/test-db.js';

interface NccBody {
  id: string;
  maNCC: string;
  tenNCC: string;
  trangThai: boolean;
  trangThaiXacMinh: string;
  xacMinhAt: string | null;
  xacMinhBoi: { maNV: string } | null;
  giayPhep: { gpkd: string; gcn: string };
}
interface ErrorBody {
  code: string;
  details: unknown;
}
interface Page<T> {
  items: T[];
}

const fullLicense = () => ({
  soGiayPhepKinhDoanh: 'GP-001',
  ngayCapGPKD: '2023-01-01',
  noiCapGPKD: 'Sở KH&ĐT TP.HCM',
  ngayHetHanGPKD: vnDate(500),
  soGCNDuDieuKienKinhDoanhDuoc: 'GCN-001',
  ngayCapGCNDuoc: '2023-01-01',
  noiCapGCNDuoc: 'Sở Y tế TP.HCM',
  ngayHetHanGCNDuoc: vnDate(500),
});

describe('Nhà cung cấp (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: Tokens;
  const http = () => request(app.getHttpServer());
  const as = (user: string) => bearer(tokens, user);
  const created = async (
    body: Record<string, unknown>,
    user = 'ketoan',
  ): Promise<NccBody> =>
    (
      await http()
        .post('/api/v1/nha-cung-cap')
        .set(as(user))
        .send(body)
        .expect(201)
    ).body as NccBody;
  const verify = (id: string, body: Record<string, unknown>, user = 'quanly') =>
    http().post(`/api/v1/nha-cung-cap/${id}/xac-minh`).set(as(user)).send(body);

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

  it('tạo NCC: sinh mã NCC, mặc định chưa xác minh và hoạt động, chuẩn hóa SĐT', async () => {
    const first = await created({
      tenNCC: '  Dược Hậu Giang ',
      SDT: '0292 3891 433',
      tenNguoiPhuTrach: 'Trần B',
    });
    expect(first).toMatchObject({
      maNCC: 'NCC0001',
      tenNCC: 'Dược Hậu Giang',
      trangThai: true,
      trangThaiXacMinh: 'chua_xac_minh',
      xacMinhAt: null,
      xacMinhBoi: null,
      giayPhep: { gpkd: 'chua_khai_bao', gcn: 'chua_khai_bao' },
    });
    expect((await created({ tenNCC: 'Imexpharm' })).maNCC).toBe('NCC0002');
  });

  it.each([
    ['thiếu tên', {}],
    ['SĐT sai', { tenNCC: 'A', SDT: '1' }],
    ['ngày sai định dạng', { tenNCC: 'A', ngayHetHanGPKD: '01/01/2030' }],
    ['trường lạ (maNCC)', { tenNCC: 'A', maNCC: 'NCC9999' }],
    [
      'trường lạ (trangThaiXacMinh)',
      { tenNCC: 'A', trangThaiXacMinh: 'da_xac_minh' },
    ],
  ])('dữ liệu sai (%s) → 400', async (_n, body) => {
    const res = await http()
      .post('/api/v1/nha-cung-cap')
      .set(as('ketoan'))
      .send(body)
      .expect(400);
    expect((res.body as ErrorBody).code).toBe('VALIDATION_FAILED');
  });

  describe('luồng xác minh', () => {
    it('thiếu hồ sơ → 422 LICENSE_INCOMPLETE kèm danh sách trường thiếu', async () => {
      const ncc = await created({
        tenNCC: 'Thiếu hồ sơ',
        soGiayPhepKinhDoanh: 'GP-1',
      });
      const res = await verify(ncc.id, { ketQua: 'da_xac_minh' }).expect(422);
      expect(res.body).toMatchObject({
        code: 'NHA_CUNG_CAP_LICENSE_INCOMPLETE',
      });
      expect(
        (res.body as { details: { thieu: string[] } }).details.thieu,
      ).toEqual(
        expect.arrayContaining([
          'ngayCapGPKD',
          'ngayHetHanGPKD',
          'soGCNDuDieuKienKinhDoanhDuoc',
          'ngayCapGCNDuoc',
          'ngayHetHanGCNDuoc',
        ]),
      );
    });

    it('đủ hồ sơ → quản lý xác minh được (ghi người và thời điểm); response có người xác minh', async () => {
      const ncc = await created({ tenNCC: 'Đủ hồ sơ', ...fullLicense() });
      const res = await verify(ncc.id, { ketQua: 'da_xac_minh' }).expect(200);
      expect(res.body).toMatchObject({
        trangThaiXacMinh: 'da_xac_minh',
        xacMinhBoi: { maNV: 'NV0005' },
        giayPhep: { gpkd: 'con_han', gcn: 'con_han' },
      });
      expect((res.body as NccBody).xacMinhAt).not.toBeNull();
      const log = await prisma.nhatKyHeThong.findFirstOrThrow({
        where: { hanhDong: 'nha_cung_cap.verify', doiTuongId: ncc.id },
      });
      expect(log.sau).toEqual({ trangThaiXacMinh: 'da_xac_minh' });
    });

    it('giấy phép đã hết hạn → 422 LICENSE_EXPIRED', async () => {
      const ncc = await created({
        tenNCC: 'Hết hạn',
        ...fullLicense(),
        ngayHetHanGCNDuoc: vnDate(-1),
      });
      const res = await verify(ncc.id, { ketQua: 'da_xac_minh' }).expect(422);
      expect((res.body as ErrorBody).code).toBe('NHA_CUNG_CAP_LICENSE_EXPIRED');
    });

    it('kế toán và nhân viên kho không được xác minh (403)', async () => {
      const ncc = await created({ tenNCC: 'Quyền xác minh', ...fullLicense() });
      await verify(ncc.id, { ketQua: 'da_xac_minh' }, 'ketoan').expect(403);
      await verify(ncc.id, { ketQua: 'da_xac_minh' }, 'kho').expect(403);
      await verify(ncc.id, { ketQua: 'da_xac_minh' }, 'admin').expect(200);
    });

    it('từ chối bắt buộc có lý do; lý do được lưu vào nhật ký nha_cung_cap.reject', async () => {
      const ncc = await created({ tenNCC: 'Bị từ chối' });
      await verify(ncc.id, { ketQua: 'tu_choi' }).expect(400);
      await verify(ncc.id, { ketQua: 'khac' }).expect(400);
      const res = await verify(ncc.id, {
        ketQua: 'tu_choi',
        ghiChu: 'Giấy phép không hợp lệ',
      }).expect(200);
      expect((res.body as NccBody).trangThaiXacMinh).toBe('tu_choi');
      const log = await prisma.nhatKyHeThong.findFirstOrThrow({
        where: { hanhDong: 'nha_cung_cap.reject', doiTuongId: ncc.id },
      });
      expect(log.lyDo).toBe('Giấy phép không hợp lệ');
    });

    it('sửa hồ sơ giấy phép của NCC đã xác minh → tự về chưa xác minh (có nhật ký); sửa SĐT thì không', async () => {
      const ncc = await created({ tenNCC: 'Đổi hồ sơ', ...fullLicense() });
      await verify(ncc.id, { ketQua: 'da_xac_minh' }).expect(200);

      const keep = await http()
        .patch(`/api/v1/nha-cung-cap/${ncc.id}`)
        .set(as('ketoan'))
        .send({ SDT: '0911111111', soGiayPhepKinhDoanh: 'GP-001' })
        .expect(200);
      expect((keep.body as NccBody).trangThaiXacMinh).toBe('da_xac_minh');

      const reset = await http()
        .patch(`/api/v1/nha-cung-cap/${ncc.id}`)
        .set(as('ketoan'))
        .send({ soGiayPhepKinhDoanh: 'GP-002' })
        .expect(200);
      expect(reset.body).toMatchObject({
        trangThaiXacMinh: 'chua_xac_minh',
        xacMinhAt: null,
        xacMinhBoi: null,
      });
      expect(
        await prisma.nhatKyHeThong.count({
          where: { hanhDong: 'nha_cung_cap.unverify', doiTuongId: ncc.id },
        }),
      ).toBe(1);

      await verify(ncc.id, { ketQua: 'da_xac_minh' }).expect(200);
    });

    it('xác minh NCC không tồn tại → 404', async () => {
      const res = await verify('7d3c9a84-1d3e-4c8d-9b5a-0c2f1e6a9b11', {
        ketQua: 'tu_choi',
        ghiChu: 'x',
      }).expect(404);
      expect((res.body as ErrorBody).code).toBe('NHA_CUNG_CAP_NOT_FOUND');
    });
  });

  describe('truy vấn và phân quyền', () => {
    it('lọc theo trạng thái xác minh, trạng thái, q (tên/mã); sort lạ → 400', async () => {
      const names = async (query: string) =>
        (
          (
            await http()
              .get(`/api/v1/nha-cung-cap?${query}&pageSize=100`)
              .set(as('kho'))
              .expect(200)
          ).body as Page<NccBody>
        ).items
          .map((n) => n.tenNCC)
          .sort();
      expect(await names('trangThaiXacMinh=tu_choi')).toEqual(['Bị từ chối']);
      expect(await names('q=NCC0001')).toEqual(['Dược Hậu Giang']);
      expect(await names('q=imex')).toEqual(['Imexpharm']);
      await http()
        .patch(
          `/api/v1/nha-cung-cap/${(await prisma.nhaCungCap.findFirstOrThrow({ where: { tenNCC: 'Imexpharm' } })).id}`,
        )
        .set(as('quanly'))
        .send({ trangThai: false })
        .expect(200);
      expect(await names('trangThai=false')).toEqual(['Imexpharm']);
      await http()
        .get('/api/v1/nha-cung-cap?sort=ghiChu:asc')
        .set(as('kho'))
        .expect(400);
      await http()
        .get('/api/v1/nha-cung-cap?trangThaiXacMinh=x')
        .set(as('kho'))
        .expect(400);
    });

    it('ai cũng đọc; nhân viên kho không tạo/sửa; kế toán/quản lý tạo-sửa; chỉ ADMIN xóa', async () => {
      const ncc = await created({ tenNCC: 'Phân quyền NCC' });
      await http().get('/api/v1/nha-cung-cap').expect(401);
      for (const user of ['kho', 'ketoan', 'quanly']) {
        await http()
          .get(`/api/v1/nha-cung-cap/${ncc.id}`)
          .set(as(user))
          .expect(200);
      }
      await http()
        .post('/api/v1/nha-cung-cap')
        .set(as('kho'))
        .send({ tenNCC: 'X' })
        .expect(403);
      await http()
        .patch(`/api/v1/nha-cung-cap/${ncc.id}`)
        .set(as('kho'))
        .send({ ghiChu: 'x' })
        .expect(403);
      await created({ tenNCC: 'Quản lý tạo' }, 'quanly');
      for (const user of ['kho', 'ketoan', 'quanly']) {
        await http()
          .delete(`/api/v1/nha-cung-cap/${ncc.id}`)
          .set(as(user))
          .expect(403);
      }
    });
  });

  describe('xóa', () => {
    it('đã có phiếu nhập → 409; chưa có → 204', async () => {
      const used = await created({ tenNCC: 'Đã có phiếu nhập' });
      await prisma.phieuNhapHang.create({
        data: { maPhieuNhapHang: 'PN-TEST-1', nhaCungCapId: used.id },
      });
      const blocked = await http()
        .delete(`/api/v1/nha-cung-cap/${used.id}`)
        .set(as('admin'))
        .expect(409);
      expect(blocked.body).toMatchObject({
        code: 'NHA_CUNG_CAP_IN_USE',
        details: { soPhieuNhap: 1 },
      });

      const free = await created({ tenNCC: 'Chưa có phiếu nhập' });
      await http()
        .delete(`/api/v1/nha-cung-cap/${free.id}`)
        .set(as('admin'))
        .expect(204);
      await http()
        .get(`/api/v1/nha-cung-cap/${free.id}`)
        .set(as('admin'))
        .expect(404);
    });
  });
});
