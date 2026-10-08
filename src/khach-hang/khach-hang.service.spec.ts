import { Prisma, type KhachHang } from '@prisma/client';
import type { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import type { ClockService } from '../common/clock/clock.service.js';
import type { CodeGeneratorService } from '../common/code-generator/code-generator.service.js';
import { addDays, parseDateOnly } from '../common/clock/vn-date.js';
import type { DieuKhoanThanhToanService } from '../dieu-khoan-thanh-toan/dieu-khoan-thanh-toan.service.js';
import type { NhanVienKinhDoanhService } from '../nhan-vien-kinh-doanh/nhan-vien-kinh-doanh.service.js';
import type { NhomDoiTacService } from '../nhom-doi-tac/nhom-doi-tac.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { KhachHangService } from './khach-hang.service.js';

const TODAY = parseDateOnly('2026-10-01');
const NOW = new Date('2026-10-01T03:00:00Z');
const actor: AuthenticatedUser = {
  id: 'u1',
  maNV: 'NV0001',
  username: 'u',
  hoTen: 'U',
  email: null,
  role: { maRole: 'KE_TOAN', tenRole: 'Kế toán' },
};

const make = (id: string, over: Partial<KhachHang> = {}): KhachHang => ({
  id,
  maKH: `KH${id}`,
  tenKH: `Khách ${id}`,
  diaChi: null,
  maSoThue: null,
  email: null,
  SDT: null,
  nguoiDaiDien: null,
  SDTNDD: null,
  trangThai: 'hoat_dong',
  soGiayPhepKinhDoanh: null,
  ngayCapGPKD: null,
  ngayHetHanGPKD: null,
  createdById: null,
  updatedById: null,
  createdAt: NOW,
  updatedAt: NOW,
  // Fields added for the MISA screens: all optional or defaulted.
  loaiChuThe: 'to_chuc',
  xungHo: null,
  dienGiai: null,
  soCCCD: null,
  soHoChieu: null,
  ngayCap: null,
  noiCap: null,
  dtCoDinh: null,
  fax: null,
  website: null,
  soNgayDuocNo: null,
  soNoToiDa: new Prisma.Decimal(0),
  quocGia: 'Việt Nam',
  tinhTp: null,
  quanHuyen: null,
  xaPhuong: null,
  lienHeHoTen: null,
  lienHeChucDanh: null,
  lienHeDienThoai: null,
  lienHeEmail: null,
  lienHeDiaChi: null,
  daiDienTheoPhapLuat: null,
  hoaDonTenNguoiNhan: null,
  hoaDonDienThoai: null,
  hoaDonDiaChi: null,
  hoaDonEmail: null,
  nhomDoiTacId: null,
  dieuKhoanThanhToanId: null,
  nhanVienBanHangId: null,
  // `undefined` means "column default" in Prisma, so it must not override the defaults above.
  ...Object.fromEntries(
    Object.entries(over).filter(([, v]) => v !== undefined),
  ),
});

function setup(
  seed: KhachHang[],
  ordersByCustomer: Record<string, number> = {},
) {
  const store = new Map(seed.map((k) => [k.id, { ...k }]));
  let seq = 0;
  const khachHang = {
    findUnique: vi.fn(
      async ({ where }: { where: { id?: string; maSoThue?: string } }) => {
        if (where.id) return store.get(where.id) ?? null;
        return (
          [...store.values()].find((k) => k.maSoThue === where.maSoThue) ?? null
        );
      },
    ),
    findMany: vi.fn(async (_args: unknown) => [...store.values()]),
    count: vi.fn(async (_args: unknown) => store.size),
    create: vi.fn(async ({ data }: { data: Partial<KhachHang> }) => {
      const row = make(`n${++seq}`, data);
      store.set(row.id, row);
      return row;
    }),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<KhachHang>;
      }) => {
        const next = { ...store.get(where.id)! } as Record<string, unknown>;
        for (const [k, v] of Object.entries(data))
          if (v !== undefined) next[k] = v;
        store.set(where.id, next as unknown as KhachHang);
        return next as unknown as KhachHang;
      },
    ),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      store.delete(where.id);
    }),
  };
  const phieuXuatHang = {
    count: vi.fn(
      async ({ where }: { where: { khachHangId: string } }) =>
        ordersByCustomer[where.khachHangId] ?? 0,
    ),
  };
  const client = { khachHang, phieuXuatHang };
  const prisma = {
    ...client,
    $transaction: vi.fn(async (fn: (tx: typeof client) => Promise<unknown>) =>
      fn(client),
    ),
  } as unknown as PrismaService;
  const next = vi.fn(async () => `KH${String(++seq).padStart(5, '0')}`);
  const record = vi.fn().mockResolvedValue({});
  const clock = {
    today: () => TODAY,
    now: () => NOW,
  } as unknown as ClockService;
  return {
    service: new KhachHangService(
      prisma,
      { next } as unknown as CodeGeneratorService,
      { record } as unknown as AuditService,
      clock,
      { assertExists: vi.fn() } as unknown as NhomDoiTacService,
      { findByIdOrThrow: vi.fn() } as unknown as DieuKhoanThanhToanService,
      { assertUsable: vi.fn() } as unknown as NhanVienKinhDoanhService,
    ),
    khachHang,
    store,
    record,
  };
}

describe('KhachHangService', () => {
  describe('create', () => {
    it('sinh maKH, lưu người tạo, tính giayPhep theo ngày hiện tại', async () => {
      const { service, khachHang } = setup([]);
      const result = await service.create(
        {
          tenKH: 'Nhà thuốc Minh Châu',
          maSoThue: '0312345678',
          SDT: '0901234567',
          ngayCapGPKD: '2024-01-15',
          ngayHetHanGPKD: '2029-01-15',
        },
        actor,
      );
      expect(result).toMatchObject({
        maKH: expect.stringMatching(/^KH\d{5}$/),
        trangThai: 'hoat_dong',
        ngayCapGPKD: '2024-01-15',
        ngayHetHanGPKD: '2029-01-15',
        giayPhep: 'con_han',
      });
      const data = khachHang.create.mock.calls[0]![0].data as {
        createdById: string;
        updatedById: string;
      };
      expect([data.createdById, data.updatedById]).toEqual(['u1', 'u1']);
    });

    it('không khai báo giấy phép → giayPhep = chua_khai_bao', async () => {
      const { service } = setup([]);
      await expect(
        service.create({ tenKH: 'X' }, actor),
      ).resolves.toMatchObject({
        giayPhep: 'chua_khai_bao',
        ngayHetHanGPKD: null,
      });
    });

    it('MST trùng → KHACH_HANG_TAX_CODE_TAKEN, không tạo', async () => {
      const { service, khachHang } = setup([
        make('a', { maSoThue: '0312345678' }),
      ]);
      await expect(
        service.create({ tenKH: 'X', maSoThue: '0312345678' }, actor),
      ).rejects.toMatchObject({
        code: 'KHACH_HANG_TAX_CODE_TAKEN',
      });
      expect(khachHang.create).not.toHaveBeenCalled();
    });

    it('hai khách đều không có MST → được', async () => {
      const { service } = setup([make('a')]);
      await expect(
        service.create({ tenKH: 'X' }, actor),
      ).resolves.toBeDefined();
    });

    it('ngày hết hạn trước ngày cấp → VALIDATION_FAILED', async () => {
      const { service } = setup([]);
      await expect(
        service.create(
          {
            tenKH: 'X',
            ngayCapGPKD: '2026-05-02',
            ngayHetHanGPKD: '2026-05-01',
          },
          actor,
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    });
  });

  describe('findAll / findOne', () => {
    it('findAll map giayPhep cho từng khách', async () => {
      const { service } = setup([
        make('a', { ngayHetHanGPKD: addDays(TODAY, -1) }),
        make('b', { ngayHetHanGPKD: addDays(TODAY, 10) }),
        make('c', { ngayHetHanGPKD: addDays(TODAY, 200) }),
        make('d'),
      ]);
      const result = await service.findAll({ page: 1, pageSize: 20 });
      expect(result.items.map((i) => i.giayPhep)).toEqual([
        'het_han',
        'sap_het_han',
        'con_han',
        'chua_khai_bao',
      ]);
    });

    it.each([
      ['het_han', { lt: TODAY }],
      ['sap_het_han', { gte: TODAY, lte: addDays(TODAY, 30) }],
      ['con_han', { gt: addDays(TODAY, 30) }],
      ['chua_khai_bao', null],
    ] as const)(
      'lọc giayPhep=%s thành điều kiện trên ngày hết hạn (không dựa cột lưu đệm)',
      async (status, expected) => {
        const { service, khachHang } = setup([]);
        await service.findAll({ page: 1, pageSize: 20, giayPhep: status });
        const where = khachHang.findMany.mock.calls[0]![0] as {
          where: { ngayHetHanGPKD: unknown };
        };
        expect(where.where.ngayHetHanGPKD).toEqual(expected);
      },
    );

    it('không lọc giayPhep → không có điều kiện ngày', async () => {
      const { service, khachHang } = setup([]);
      await service.findAll({ page: 1, pageSize: 20 });
      const args = khachHang.findMany.mock.calls[0]![0] as {
        where: { ngayHetHanGPKD: unknown };
      };
      expect(args.where.ngayHetHanGPKD).toBeUndefined();
    });

    it('findOne không tồn tại → KHACH_HANG_NOT_FOUND', async () => {
      const { service } = setup([]);
      await expect(service.findOne('x')).rejects.toMatchObject({
        code: 'KHACH_HANG_NOT_FOUND',
      });
    });
  });

  describe('update', () => {
    it('đổi thông tin, ghi người sửa; xóa email bằng null', async () => {
      const { service, khachHang } = setup([make('a', { email: 'a@b.vn' })]);
      await expect(
        service.update('a', { tenKH: 'Mới', email: null }, actor),
      ).resolves.toMatchObject({
        tenKH: 'Mới',
        email: null,
      });
      expect(
        (khachHang.update.mock.calls[0]![0].data as { updatedById: string })
          .updatedById,
      ).toBe('u1');
    });

    it('đổi sang MST của khách khác → KHACH_HANG_TAX_CODE_TAKEN; giữ MST của mình → được', async () => {
      const { service } = setup([
        make('a', { maSoThue: '0312345678' }),
        make('b', { maSoThue: '0399999999' }),
      ]);
      await expect(
        service.update('a', { maSoThue: '0399999999' }, actor),
      ).rejects.toMatchObject({
        code: 'KHACH_HANG_TAX_CODE_TAKEN',
      });
      await expect(
        service.update('a', { maSoThue: '0312345678' }, actor),
      ).resolves.toBeDefined();
    });

    it('chỉ đổi ngày hết hạn sang trước ngày cấp hiện có → VALIDATION_FAILED', async () => {
      const { service } = setup([
        make('a', { ngayCapGPKD: parseDateOnly('2026-05-01') }),
      ]);
      await expect(
        service.update('a', { ngayHetHanGPKD: '2026-04-01' }, actor),
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
      });
    });

    it('xóa ngày hết hạn bằng null → giayPhep = chua_khai_bao', async () => {
      const { service } = setup([
        make('a', { ngayHetHanGPKD: addDays(TODAY, 100) }),
      ]);
      await expect(
        service.update('a', { ngayHetHanGPKD: null }, actor),
      ).resolves.toMatchObject({
        ngayHetHanGPKD: null,
        giayPhep: 'chua_khai_bao',
      });
    });

    it('đổi trạng thái → ghi nhật ký khach_hang.status_change; không đổi → không ghi', async () => {
      const { service, record } = setup([make('a')]);
      await service.update('a', { trangThai: 'ngung_hoat_dong' }, actor);
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          hanhDong: 'khach_hang.status_change',
          truoc: { trangThai: 'hoat_dong' },
          sau: { trangThai: 'ngung_hoat_dong' },
        }),
        expect.anything(),
      );
      record.mockClear();
      await service.update(
        'a',
        { trangThai: 'ngung_hoat_dong', tenKH: 'Khác' },
        actor,
      );
      expect(record).not.toHaveBeenCalled();
    });

    it('không tồn tại → KHACH_HANG_NOT_FOUND', async () => {
      const { service } = setup([]);
      await expect(
        service.update('x', { tenKH: 'A' }, actor),
      ).rejects.toMatchObject({
        code: 'KHACH_HANG_NOT_FOUND',
      });
    });
  });

  describe('remove', () => {
    it('chưa có phiếu xuất → xóa', async () => {
      const { service, store } = setup([make('a')]);
      await service.remove('a');
      expect(store.has('a')).toBe(false);
    });

    it('đã có phiếu xuất → KHACH_HANG_IN_USE kèm số phiếu', async () => {
      const { service, khachHang } = setup([make('a')], { a: 3 });
      await expect(service.remove('a')).rejects.toMatchObject({
        code: 'KHACH_HANG_IN_USE',
        details: { soPhieuXuat: 3 },
      });
      expect(khachHang.delete).not.toHaveBeenCalled();
    });

    it('không tồn tại → KHACH_HANG_NOT_FOUND', async () => {
      const { service } = setup([]);
      await expect(service.remove('x')).rejects.toMatchObject({
        code: 'KHACH_HANG_NOT_FOUND',
      });
    });
  });

  describe('assertCanBuy', () => {
    it('dùng ngày hiện tại của ClockService', () => {
      const { service } = setup([]);
      expect(() =>
        service.assertCanBuy(make('a', { ngayHetHanGPKD: TODAY })),
      ).not.toThrow();
      expect(() =>
        service.assertCanBuy(make('a', { ngayHetHanGPKD: addDays(TODAY, -1) })),
      ).toThrow(
        expect.objectContaining({ code: 'KHACH_HANG_LICENSE_EXPIRED' }),
      );
    });
  });
});
