import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { bearer, loginAll, type Tokens } from './helpers/catalog.js';
import { createTestApp } from './helpers/create-app.js';
import { vnDate } from './helpers/dates.js';
import { migrateTestDatabase, resetAndSeed } from './helpers/test-db.js';

interface KhBody {
  id: string;
  maKH: string;
  tenKH: string;
  maSoThue: string | null;
  SDT: string | null;
  email: string | null;
  trangThai: string;
  ngayHetHanGPKD: string | null;
  giayPhep: string;
}
interface ErrorBody {
  code: string;
  details: unknown;
}
interface Page<T> {
  items: T[];
  meta: { total: number };
}

describe('Khách hàng (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: Tokens;
  const http = () => request(app.getHttpServer());
  const as = (user: string) => bearer(tokens, user);
  const create = (body: Record<string, unknown>, user = 'ketoan') =>
    http().post('/api/v1/khach-hang').set(as(user)).send(body);
  const created = async (body: Record<string, unknown>): Promise<KhBody> =>
    (await create(body).expect(201)).body as KhBody;

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

  it('tạo khách: sinh mã KH tăng dần, chuẩn hóa SĐT/email, trả ngày dạng YYYY-MM-DD', async () => {
    const first = await created({
      tenKH: '  Nhà thuốc Minh Châu ',
      maSoThue: '0312345678',
      SDT: '0901 234 567',
      email: 'MinhChau@Example.com',
      nguoiDaiDien: 'Nguyễn Văn A',
      soGiayPhepKinhDoanh: 'GP-001',
      ngayCapGPKD: '2024-01-15',
      ngayHetHanGPKD: vnDate(400),
    });
    expect(first).toMatchObject({
      maKH: 'KH00001',
      tenKH: 'Nhà thuốc Minh Châu',
      maSoThue: '0312345678',
      SDT: '0901234567',
      email: 'minhchau@example.com',
      trangThai: 'hoat_dong',
      giayPhep: 'con_han',
    });
    const second = await created({ tenKH: 'Nhà thuốc An Khang' });
    expect(second.maKH).toBe('KH00002');
    expect(second).toMatchObject({
      giayPhep: 'chua_khai_bao',
      ngayHetHanGPKD: null,
    });
  });

  it('MST trùng → 409; nhiều khách không có MST → được', async () => {
    const dup = await create({ tenKH: 'Khác', maSoThue: '0312345678' }).expect(
      409,
    );
    expect((dup.body as ErrorBody).code).toBe('KHACH_HANG_TAX_CODE_TAKEN');
    await created({ tenKH: 'Không MST 1' });
    await created({ tenKH: 'Không MST 2' });
  });

  it.each([
    ['thiếu tên', { tenKH: '' }],
    ['MST sai định dạng', { tenKH: 'A', maSoThue: '123' }],
    ['SĐT sai', { tenKH: 'A', SDT: '12345' }],
    ['email sai', { tenKH: 'A', email: 'khong-phai-email' }],
    ['ngày không có thật', { tenKH: 'A', ngayHetHanGPKD: '2026-02-30' }],
    ['trường lạ (maKH)', { tenKH: 'A', maKH: 'KH99999' }],
  ])('dữ liệu sai (%s) → 400 VALIDATION_FAILED', async (_n, body) => {
    const res = await create(body).expect(400);
    expect((res.body as ErrorBody).code).toBe('VALIDATION_FAILED');
  });

  it('ngày hết hạn GPKD trước ngày cấp → 400 chỉ đúng field', async () => {
    const res = await create({
      tenKH: 'A',
      ngayCapGPKD: '2026-05-02',
      ngayHetHanGPKD: '2026-05-01',
    }).expect(400);
    expect(res.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: [expect.objectContaining({ field: 'ngayHetHanGPKD' })],
    });
  });

  it('phân quyền: ai cũng đọc; quản lý/kế toán/admin tạo-sửa; nhân viên kho không; chỉ ADMIN xóa', async () => {
    const kh = await created({ tenKH: 'Phân quyền' });
    await http().get('/api/v1/khach-hang').expect(401);
    for (const user of ['kho', 'ketoan', 'quanly']) {
      await http().get(`/api/v1/khach-hang/${kh.id}`).set(as(user)).expect(200);
    }
    await create({ tenKH: 'Bị cấm' }, 'kho').expect(403);
    await http()
      .patch(`/api/v1/khach-hang/${kh.id}`)
      .set(as('kho'))
      .send({ diaChi: 'x' })
      .expect(403);
    await create({ tenKH: 'Quản lý tạo' }, 'quanly').expect(201);
    await http()
      .patch(`/api/v1/khach-hang/${kh.id}`)
      .set(as('ketoan'))
      .send({ diaChi: 'Số 1' })
      .expect(200);
    for (const user of ['kho', 'ketoan', 'quanly']) {
      await http()
        .delete(`/api/v1/khach-hang/${kh.id}`)
        .set(as(user))
        .expect(403);
    }
    await http()
      .delete(`/api/v1/khach-hang/${kh.id}`)
      .set(as('admin'))
      .expect(204);
  });

  describe('theo dõi giấy phép', () => {
    beforeAll(async () => {
      await created({ tenKH: 'GP hết hạn', ngayHetHanGPKD: vnDate(-1) });
      await created({ tenKH: 'GP hết hạn hôm nay', ngayHetHanGPKD: vnDate(0) });
      await created({ tenKH: 'GP sắp hết hạn', ngayHetHanGPKD: vnDate(30) });
      await created({ tenKH: 'GP còn xa', ngayHetHanGPKD: vnDate(31) });
    });

    const names = async (query: string) =>
      (
        (
          await http()
            .get(`/api/v1/khach-hang?${query}&pageSize=100`)
            .set(as('kho'))
            .expect(200)
        ).body as Page<KhBody>
      ).items
        .map((k) => k.tenKH)
        .sort();

    it('lọc giayPhep theo ngày hết hạn (hết hạn hôm nay vẫn tính là còn dùng)', async () => {
      expect(await names('giayPhep=het_han&q=GP')).toEqual(['GP hết hạn']);
      expect(await names('giayPhep=sap_het_han&q=GP')).toEqual([
        'GP hết hạn hôm nay',
        'GP sắp hết hạn',
      ]);
      expect(await names('giayPhep=con_han&q=GP')).toEqual(['GP còn xa']);
      expect(await names('giayPhep=chua_khai_bao&q=Không MST')).toEqual([
        'Không MST 1',
        'Không MST 2',
      ]);
    });

    it('response mang trạng thái giấy phép đã tính', async () => {
      const res = await http()
        .get('/api/v1/khach-hang?q=GP hết hạn hôm nay')
        .set(as('kho'))
        .expect(200);
      expect((res.body as Page<KhBody>).items[0]).toMatchObject({
        giayPhep: 'sap_het_han',
        ngayHetHanGPKD: vnDate(0),
      });
    });

    it('giayPhep sai giá trị → 400; sort theo ngayHetHanGPKD được', async () => {
      await http()
        .get('/api/v1/khach-hang?giayPhep=khac')
        .set(as('kho'))
        .expect(400);
      await http()
        .get('/api/v1/khach-hang?sort=ngayHetHanGPKD:asc')
        .set(as('kho'))
        .expect(200);
      await http()
        .get('/api/v1/khach-hang?sort=email:asc')
        .set(as('kho'))
        .expect(400);
    });
  });

  describe('cập nhật', () => {
    it('sửa thông tin; xóa email/MST bằng null; đổi MST sang MST của khách khác → 409', async () => {
      const a = await created({
        tenKH: 'Sửa A',
        maSoThue: '0399999991',
        email: 'a@x.vn',
      });
      await created({ tenKH: 'Sửa B', maSoThue: '0399999992' });

      const ok = await http()
        .patch(`/api/v1/khach-hang/${a.id}`)
        .set(as('ketoan'))
        .send({ tenKH: 'Sửa A2', email: null, diaChi: '1 Nguyễn Huệ' })
        .expect(200);
      expect(ok.body).toMatchObject({ tenKH: 'Sửa A2', email: null });

      const dup = await http()
        .patch(`/api/v1/khach-hang/${a.id}`)
        .set(as('ketoan'))
        .send({ maSoThue: '0399999992' })
        .expect(409);
      expect((dup.body as ErrorBody).code).toBe('KHACH_HANG_TAX_CODE_TAKEN');

      const keep = await http()
        .patch(`/api/v1/khach-hang/${a.id}`)
        .set(as('ketoan'))
        .send({ maSoThue: '0399999991' })
        .expect(200);
      expect((keep.body as KhBody).maSoThue).toBe('0399999991');
      const cleared = await http()
        .patch(`/api/v1/khach-hang/${a.id}`)
        .set(as('ketoan'))
        .send({ maSoThue: null })
        .expect(200);
      expect((cleared.body as KhBody).maSoThue).toBeNull();
    });

    it('ngừng hoạt động / hoạt động lại ghi nhật ký; không cho sửa maKH', async () => {
      const kh = await created({ tenKH: 'Ngừng hoạt động' });
      await http()
        .patch(`/api/v1/khach-hang/${kh.id}`)
        .set(as('quanly'))
        .send({ maKH: 'KH99999' })
        .expect(400);
      const off = await http()
        .patch(`/api/v1/khach-hang/${kh.id}`)
        .set(as('quanly'))
        .send({ trangThai: 'ngung_hoat_dong' })
        .expect(200);
      expect((off.body as KhBody).trangThai).toBe('ngung_hoat_dong');
      await http()
        .patch(`/api/v1/khach-hang/${kh.id}`)
        .set(as('quanly'))
        .send({ trangThai: 'hoat_dong' })
        .expect(200);
      await http()
        .patch(`/api/v1/khach-hang/${kh.id}`)
        .set(as('quanly'))
        .send({ trangThai: 'xyz' })
        .expect(400);

      const logs = await prisma.nhatKyHeThong.findMany({
        where: { hanhDong: 'khach_hang.status_change', doiTuongId: kh.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(logs.map((l) => l.sau)).toEqual([
        { trangThai: 'ngung_hoat_dong' },
        { trangThai: 'hoat_dong' },
      ]);
    });

    it('ngày hết hạn đổi sang trước ngày cấp hiện có → 400', async () => {
      const kh = await created({
        tenKH: 'Ngày GP',
        ngayCapGPKD: '2026-05-01',
        ngayHetHanGPKD: '2030-05-01',
      });
      await http()
        .patch(`/api/v1/khach-hang/${kh.id}`)
        .set(as('ketoan'))
        .send({ ngayHetHanGPKD: '2026-04-01' })
        .expect(400);
    });
  });

  describe('xóa', () => {
    it('đã có phiếu xuất → 409 KHACH_HANG_IN_USE; chưa có → 204; id lạ → 404/400', async () => {
      const used = await created({ tenKH: 'Đã có phiếu xuất' });
      await prisma.phieuXuatHang.create({
        data: { maPhieuXuatHang: 'PX-TEST-1', khachHangId: used.id },
      });
      const blocked = await http()
        .delete(`/api/v1/khach-hang/${used.id}`)
        .set(as('admin'))
        .expect(409);
      expect(blocked.body).toMatchObject({
        code: 'KHACH_HANG_IN_USE',
        details: { soPhieuXuat: 1 },
      });

      const free = await created({ tenKH: 'Chưa có phiếu xuất' });
      await http()
        .delete(`/api/v1/khach-hang/${free.id}`)
        .set(as('admin'))
        .expect(204);
      await http()
        .get(`/api/v1/khach-hang/${free.id}`)
        .set(as('admin'))
        .expect(404);
      await http().get('/api/v1/khach-hang/abc').set(as('admin')).expect(400);
    });
  });
});
