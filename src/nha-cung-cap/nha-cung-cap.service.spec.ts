import { Prisma, type NhaCungCap } from '@prisma/client';
import type { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import type { ClockService } from '../common/clock/clock.service.js';
import type { CodeGeneratorService } from '../common/code-generator/code-generator.service.js';
import { addDays, parseDateOnly } from '../common/clock/vn-date.js';
import type { DieuKhoanThanhToanService } from '../dieu-khoan-thanh-toan/dieu-khoan-thanh-toan.service.js';
import type { NhanVienKinhDoanhService } from '../nhan-vien-kinh-doanh/nhan-vien-kinh-doanh.service.js';
import type { NhomDoiTacService } from '../nhom-doi-tac/nhom-doi-tac.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { NhaCungCapService } from './nha-cung-cap.service.js';

const TODAY = parseDateOnly('2026-10-01');
const NOW = new Date('2026-10-01T03:00:00Z');
const FUTURE = addDays(TODAY, 365);
const actor: AuthenticatedUser = {
  id: 'u1',
  maNV: 'NV0001',
  username: 'u',
  hoTen: 'U',
  email: null,
  role: { maRole: 'QUAN_LY_KHO', tenRole: 'Quản lý kho' },
};

const make = (id: string, over: Partial<NhaCungCap> = {}): NhaCungCap => ({
  id,
  maNCC: `NCC${id}`,
  tenNCC: `NCC ${id}`,
  SDT: null,
  diaChi: null,
  tenNguoiPhuTrach: null,
  sdtNguoiPT: null,
  trangThaiXacMinh: 'chua_xac_minh',
  ghiChu: null,
  trangThai: true,
  soGiayPhepKinhDoanh: null,
  ngayCapGPKD: null,
  noiCapGPKD: null,
  ngayHetHanGPKD: null,
  soGCNDuDieuKienKinhDoanhDuoc: null,
  ngayCapGCNDuoc: null,
  noiCapGCNDuoc: null,
  ngayHetHanGCNDuoc: null,
  xacMinhAt: null,
  xacMinhById: null,
  createdById: null,
  updatedById: null,
  createdAt: NOW,
  updatedAt: NOW,
  // Fields added for the MISA screens: all optional or defaulted.
  loaiChuThe: 'to_chuc',
  maSoThue: null,
  soCCCD: null,
  email: null,
  dtCoDinh: null,
  fax: null,
  website: null,
  soNgayDuocNo: null,
  soNoToiDa: new Prisma.Decimal(0),
  quocGia: 'Việt Nam',
  tinhTp: null,
  quanHuyen: null,
  xaPhuong: null,
  nhomDoiTacId: null,
  dieuKhoanThanhToanId: null,
  nhanVienMuaHangId: null,
  // `undefined` means "column default" in Prisma, so it must not override the defaults above.
  ...Object.fromEntries(
    Object.entries(over).filter(([, v]) => v !== undefined),
  ),
});

const fullLicense: Partial<NhaCungCap> = {
  soGiayPhepKinhDoanh: 'GP-1',
  ngayCapGPKD: addDays(TODAY, -400),
  ngayHetHanGPKD: FUTURE,
  soGCNDuDieuKienKinhDoanhDuoc: 'GCN-1',
  ngayCapGCNDuoc: addDays(TODAY, -400),
  ngayHetHanGCNDuoc: FUTURE,
};

function setup(
  seed: NhaCungCap[],
  receiptsBySupplier: Record<string, number> = {},
) {
  const store = new Map(seed.map((n) => [n.id, { ...n }]));
  let seq = 0;
  const withRel = (n: NhaCungCap) => ({
    ...n,
    xacMinhBoi: n.xacMinhById
      ? { id: n.xacMinhById, maNV: 'NV0001', hoTen: 'U' }
      : null,
  });
  const nhaCungCap = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      const row = store.get(where.id);
      return row ? withRel(row) : null;
    }),
    findMany: vi.fn(async () => [...store.values()].map(withRel)),
    count: vi.fn(async () => store.size),
    create: vi.fn(async ({ data }: { data: Partial<NhaCungCap> }) => {
      const row = make(`n${++seq}`, data);
      store.set(row.id, row);
      return withRel(row);
    }),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<NhaCungCap>;
      }) => {
        const next = { ...store.get(where.id)! } as Record<string, unknown>;
        for (const [k, v] of Object.entries(data))
          if (v !== undefined) next[k] = v;
        store.set(where.id, next as unknown as NhaCungCap);
        return withRel(next as unknown as NhaCungCap);
      },
    ),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      store.delete(where.id);
    }),
  };
  const phieuNhapHang = {
    count: vi.fn(
      async ({ where }: { where: { nhaCungCapId: string } }) =>
        receiptsBySupplier[where.nhaCungCapId] ?? 0,
    ),
  };
  const client = { nhaCungCap, phieuNhapHang };
  const prisma = {
    ...client,
    $transaction: vi.fn(async (fn: (tx: typeof client) => Promise<unknown>) =>
      fn(client),
    ),
  } as unknown as PrismaService;
  const record = vi.fn().mockResolvedValue({});
  const next = vi.fn(async () => `NCC${String(++seq).padStart(4, '0')}`);
  const clock = {
    today: () => TODAY,
    now: () => NOW,
  } as unknown as ClockService;
  return {
    service: new NhaCungCapService(
      prisma,
      { next } as unknown as CodeGeneratorService,
      { record } as unknown as AuditService,
      clock,
      { assertExists: vi.fn() } as unknown as NhomDoiTacService,
      { findByIdOrThrow: vi.fn() } as unknown as DieuKhoanThanhToanService,
      { assertUsable: vi.fn() } as unknown as NhanVienKinhDoanhService,
    ),
    store,
    nhaCungCap,
    record,
  };
}

describe('NhaCungCapService', () => {
  describe('create', () => {
    it('sinh maNCC, mặc định chưa xác minh và hoạt động, lưu người tạo', async () => {
      const { service, nhaCungCap } = setup([]);
      const result = await service.create(
        { tenNCC: 'Dược Hậu Giang', SDT: '0901234567' },
        actor,
      );
      expect(result).toMatchObject({
        maNCC: expect.stringMatching(/^NCC\d{4}$/),
        trangThaiXacMinh: 'chua_xac_minh',
        trangThai: true,
        xacMinhBoi: null,
        giayPhep: { gpkd: 'chua_khai_bao', gcn: 'chua_khai_bao' },
      });
      expect(
        (nhaCungCap.create.mock.calls[0]![0].data as { createdById: string })
          .createdById,
      ).toBe('u1');
    });

    it('lưu và trả ngày dạng YYYY-MM-DD, tính trạng thái hai giấy phép riêng', async () => {
      const { service } = setup([]);
      const result = await service.create(
        {
          tenNCC: 'X',
          soGiayPhepKinhDoanh: 'GP-1',
          ngayCapGPKD: '2024-01-01',
          ngayHetHanGPKD: '2027-10-01',
          ngayCapGCNDuoc: '2024-01-01',
          ngayHetHanGCNDuoc: '2026-10-10',
        },
        actor,
      );
      expect(result).toMatchObject({
        ngayHetHanGPKD: '2027-10-01',
        ngayHetHanGCNDuoc: '2026-10-10',
        giayPhep: { gpkd: 'con_han', gcn: 'sap_het_han' },
      });
    });

    it('ngày hết hạn GCN trước ngày cấp → VALIDATION_FAILED chỉ đúng field', async () => {
      const { service } = setup([]);
      await expect(
        service.create(
          {
            tenNCC: 'X',
            ngayCapGCNDuoc: '2026-05-02',
            ngayHetHanGCNDuoc: '2026-05-01',
          },
          actor,
        ),
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        details: [expect.objectContaining({ field: 'ngayHetHanGCNDuoc' })],
      });
    });
  });

  describe('update', () => {
    it('sửa thông tin liên hệ không làm mất xác minh', async () => {
      const { service, record } = setup([
        make('a', {
          ...fullLicense,
          trangThaiXacMinh: 'da_xac_minh',
          xacMinhById: 'u9',
          xacMinhAt: NOW,
        }),
      ]);
      const result = await service.update(
        'a',
        { SDT: '0911111111', tenNCC: 'Tên mới' },
        actor,
      );
      expect(result.trangThaiXacMinh).toBe('da_xac_minh');
      expect(record).not.toHaveBeenCalled();
    });

    it('gửi lại đúng giá trị giấy phép hiện có → vẫn giữ xác minh', async () => {
      const { service } = setup([
        make('a', {
          ...fullLicense,
          trangThaiXacMinh: 'da_xac_minh',
          xacMinhById: 'u9',
          xacMinhAt: NOW,
        }),
      ]);
      const result = await service.update(
        'a',
        { soGiayPhepKinhDoanh: 'GP-1', ngayHetHanGPKD: '2027-10-01' },
        actor,
      );
      expect(result.trangThaiXacMinh).toBe('da_xac_minh');
    });

    it.each([
      ['số GPKD', { soGiayPhepKinhDoanh: 'GP-2' }],
      ['ngày hết hạn GCN', { ngayHetHanGCNDuoc: '2030-01-01' }],
      ['nơi cấp GPKD', { noiCapGPKD: 'Sở khác' }],
    ])(
      'đổi %s của NCC đã xác minh → về chua_xac_minh, xóa người xác minh, ghi nhật ký',
      async (_n, patch) => {
        const { service, record } = setup([
          make('a', {
            ...fullLicense,
            trangThaiXacMinh: 'da_xac_minh',
            xacMinhById: 'u9',
            xacMinhAt: NOW,
          }),
        ]);
        const result = await service.update('a', patch, actor);
        expect(result).toMatchObject({
          trangThaiXacMinh: 'chua_xac_minh',
          xacMinhAt: null,
          xacMinhBoi: null,
        });
        expect(record).toHaveBeenCalledWith(
          expect.objectContaining({
            hanhDong: 'nha_cung_cap.unverify',
            truoc: { trangThaiXacMinh: 'da_xac_minh' },
            sau: { trangThaiXacMinh: 'chua_xac_minh' },
          }),
          expect.anything(),
        );
      },
    );

    it('NCC bị từ chối sửa hồ sơ → về chua_xac_minh để xác minh lại', async () => {
      const { service } = setup([
        make('a', { ...fullLicense, trangThaiXacMinh: 'tu_choi' }),
      ]);
      const result = await service.update(
        'a',
        { soGiayPhepKinhDoanh: 'GP-NEW' },
        actor,
      );
      expect(result.trangThaiXacMinh).toBe('chua_xac_minh');
    });

    it('NCC chưa xác minh sửa hồ sơ → không ghi nhật ký', async () => {
      const { service, record } = setup([make('a')]);
      await service.update('a', { soGiayPhepKinhDoanh: 'GP-1' }, actor);
      expect(record).not.toHaveBeenCalled();
    });

    it('ngừng hoạt động / hoạt động lại', async () => {
      const { service } = setup([make('a')]);
      await expect(
        service.update('a', { trangThai: false }, actor),
      ).resolves.toMatchObject({ trangThai: false });
    });

    it('chỉ đổi ngày hết hạn sang trước ngày cấp hiện có → VALIDATION_FAILED', async () => {
      const { service } = setup([make('a', { ...fullLicense })]);
      await expect(
        service.update('a', { ngayHetHanGPKD: '2020-01-01' }, actor),
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
      });
    });

    it('không tồn tại → NHA_CUNG_CAP_NOT_FOUND', async () => {
      const { service } = setup([]);
      await expect(
        service.update('x', { tenNCC: 'A' }, actor),
      ).rejects.toMatchObject({
        code: 'NHA_CUNG_CAP_NOT_FOUND',
      });
    });
  });

  describe('verify', () => {
    it('hồ sơ đủ, còn hạn → da_xac_minh, ghi xacMinhAt/By và nhật ký nha_cung_cap.verify', async () => {
      const { service, record } = setup([make('a', { ...fullLicense })]);
      const result = await service.verify(
        'a',
        { ketQua: 'da_xac_minh' },
        actor,
      );
      expect(result).toMatchObject({
        trangThaiXacMinh: 'da_xac_minh',
        xacMinhAt: NOW,
        xacMinhBoi: { id: 'u1' },
      });
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          hanhDong: 'nha_cung_cap.verify',
          doiTuongId: 'a',
        }),
        expect.anything(),
      );
    });

    it('thiếu hồ sơ → NHA_CUNG_CAP_LICENSE_INCOMPLETE, không đổi trạng thái', async () => {
      const { service, nhaCungCap } = setup([
        make('a', { ...fullLicense, soGCNDuDieuKienKinhDoanhDuoc: null }),
      ]);
      await expect(
        service.verify('a', { ketQua: 'da_xac_minh' }, actor),
      ).rejects.toMatchObject({
        code: 'NHA_CUNG_CAP_LICENSE_INCOMPLETE',
      });
      expect(nhaCungCap.update).not.toHaveBeenCalled();
    });

    it('giấy phép hết hạn → NHA_CUNG_CAP_LICENSE_EXPIRED', async () => {
      const { service } = setup([
        make('a', { ...fullLicense, ngayHetHanGPKD: addDays(TODAY, -1) }),
      ]);
      await expect(
        service.verify('a', { ketQua: 'da_xac_minh' }, actor),
      ).rejects.toMatchObject({
        code: 'NHA_CUNG_CAP_LICENSE_EXPIRED',
      });
    });

    it('từ chối không cần đủ hồ sơ, lưu lý do vào nhật ký nha_cung_cap.reject', async () => {
      const { service, record } = setup([make('a')]);
      const result = await service.verify(
        'a',
        { ketQua: 'tu_choi', ghiChu: 'Giấy phép giả' },
        actor,
      );
      expect(result.trangThaiXacMinh).toBe('tu_choi');
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          hanhDong: 'nha_cung_cap.reject',
          lyDo: 'Giấy phép giả',
        }),
        expect.anything(),
      );
    });

    it('xác minh lại NCC đã xác minh → cập nhật người và thời điểm', async () => {
      const { service } = setup([
        make('a', {
          ...fullLicense,
          trangThaiXacMinh: 'da_xac_minh',
          xacMinhById: 'u9',
          xacMinhAt: addDays(NOW, -30),
        }),
      ]);
      const result = await service.verify(
        'a',
        { ketQua: 'da_xac_minh' },
        actor,
      );
      expect(result).toMatchObject({
        xacMinhAt: NOW,
        xacMinhBoi: { id: 'u1' },
      });
    });

    it('không tồn tại → NHA_CUNG_CAP_NOT_FOUND', async () => {
      const { service } = setup([]);
      await expect(
        service.verify('x', { ketQua: 'tu_choi', ghiChu: 'x' }, actor),
      ).rejects.toMatchObject({
        code: 'NHA_CUNG_CAP_NOT_FOUND',
      });
    });
  });

  describe('remove', () => {
    it('chưa có phiếu nhập → xóa', async () => {
      const { service, store } = setup([make('a')]);
      await service.remove('a');
      expect(store.has('a')).toBe(false);
    });

    it('đã có phiếu nhập → NHA_CUNG_CAP_IN_USE kèm số phiếu', async () => {
      const { service, nhaCungCap } = setup([make('a')], { a: 4 });
      await expect(service.remove('a')).rejects.toMatchObject({
        code: 'NHA_CUNG_CAP_IN_USE',
        details: { soPhieuNhap: 4 },
      });
      expect(nhaCungCap.delete).not.toHaveBeenCalled();
    });

    it('không tồn tại → NHA_CUNG_CAP_NOT_FOUND', async () => {
      const { service } = setup([]);
      await expect(service.remove('x')).rejects.toMatchObject({
        code: 'NHA_CUNG_CAP_NOT_FOUND',
      });
    });
  });

  describe('assertCanSupply (dùng bởi phiếu nhập)', () => {
    it('đã xác minh, hoạt động, còn hạn → được; giấy phép hết hạn sau đó → bị chặn', async () => {
      const { service } = setup([]);
      const verified = {
        ...make('a', { ...fullLicense, trangThaiXacMinh: 'da_xac_minh' }),
        xacMinhBoi: null,
      };
      expect(() => service.assertCanSupply(verified)).not.toThrow();
      expect(() =>
        service.assertCanSupply({
          ...verified,
          ngayHetHanGCNDuoc: addDays(TODAY, -1),
        }),
      ).toThrow(
        expect.objectContaining({ code: 'NHA_CUNG_CAP_LICENSE_EXPIRED' }),
      );
    });
  });
});
