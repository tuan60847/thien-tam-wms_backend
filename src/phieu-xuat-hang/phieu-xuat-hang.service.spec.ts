import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { AppException } from '../common/errors/app.exception.js';
import { PhieuXuatHangService } from './phieu-xuat-hang.service.js';

const TODAY = new Date('2026-10-06T00:00:00Z');
const admin = { id: 'u1', role: { maRole: 'ADMIN' } } as AuthenticatedUser;
const keeper = {
  id: 'u2',
  role: { maRole: 'NHAN_VIEN_KHO' },
} as AuthenticatedUser;
const manager = {
  id: 'u3',
  role: { maRole: 'QUAN_LY_KHO' },
} as AuthenticatedUser;

interface Line {
  id: string;
  maChiTietPhieuXuatHang: string;
  soLoId: string;
  viTriId: string;
  soLuongCoBan: number;
  soLo: { hanSuDung: Date; hangHoa: { isCanGiuLanh: boolean } };
}

const line = (n: number, over: Partial<Line> = {}): Line => ({
  id: `c${n}`,
  maChiTietPhieuXuatHang: `PX-0${n}`,
  soLoId: `lot${n}`,
  viTriId: 'v1',
  soLuongCoBan: 10 * n,
  soLo: {
    hanSuDung: new Date('2027-01-01T00:00:00Z'),
    hangHoa: { isCanGiuLanh: false },
  },
  ...over,
});

function setup(
  options: {
    state?: string | null;
    lines?: Line[];
    receipts?: number;
    issueError?: unknown; // thrown by assertIssuable
    customerError?: unknown;
  } = {},
) {
  const state = options.state === undefined ? 'cho_xu_ly' : options.state;
  const lines = options.lines ?? [line(1), line(2)];
  const tx = {
    phieuXuatHang: {
      updateMany: vi.fn(
        async ({ where }: { where: { trangThai: string } }) => ({
          count: state === where.trangThai ? 1 : 0,
        }),
      ),
      findUnique: vi.fn(async () => (state ? { id: 'p1' } : null)),
      findUniqueOrThrow: vi.fn(async () => ({
        id: 'p1',
        khachHangId: 'kh',
        phuongTienVanChuyenId: null,
        ngayXuatKho: TODAY,
        chiTietPhieuXuatHangs: lines,
      })),
      update: vi.fn(async () => ({})),
    },
    phieuThuCongNo: { count: vi.fn(async () => options.receipts ?? 0) },
    chiTietPhieuXuatHang: { findMany: vi.fn(async () => lines) },
    $queryRaw: vi.fn(async () => (state ? [{ trang_thai: state }] : [])),
  };
  const prisma = {
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  } as never;
  const assertCanBuy = vi.fn(() => {
    if (options.customerError) throw options.customerError;
  });
  const assertIssuable = vi.fn(() => {
    if (options.issueError) throw options.issueError;
  });
  const decrease = vi.fn(async (_m: { soLoId: string }, ..._r: unknown[]) => ({
    id: 't',
    soLuong: 0,
  }));
  const increase = vi.fn(async (_m: { soLoId: string }, ..._r: unknown[]) => ({
    id: 't',
    soLuong: 1,
  }));
  const record = vi.fn().mockResolvedValue({});
  const assertUsable = vi.fn(async () => ({}));
  const service = new PhieuXuatHangService(
    prisma,
    {} as never,
    { record } as never,
    {
      today: () => TODAY,
      now: () => new Date('2026-10-06T08:00:00Z'),
    } as never,
    {
      findByIdOrThrow: vi.fn(async () => ({
        id: 'kh',
        soNoToiDa: new Prisma.Decimal(0),
      })),
      assertCanBuy,
    } as never,
    { assertUsable } as never,
    { assertIssuable } as never,
    {} as never,
    {} as never,
    {} as never,
    { increase, decrease } as never,
    { assertUsable: vi.fn() } as never,
    { findByIdOrThrow: vi.fn() } as never,
    { setContext: vi.fn(), info: vi.fn() } as never,
    { expiryWarningDays: 90 } as never,
  );
  vi.spyOn(service, 'findOne').mockResolvedValue({ id: 'p1' } as never);
  return {
    service,
    tx,
    increase,
    decrease,
    record,
    assertCanBuy,
    assertIssuable,
    assertUsable,
  };
}

describe('PhieuXuatHangService', () => {
  describe('issue', () => {
    it('trừ tồn từng dòng theo thứ tự cố định, loai xuat_kho, thamChieu đúng, set ngày/người xuất', async () => {
      const { service, decrease, tx } = setup({ lines: [line(2), line(1)] });
      await service.issue('p1', admin);
      expect(tx.phieuXuatHang.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p1', trangThai: 'cho_xu_ly' },
          data: expect.objectContaining({
            trangThai: 'da_xuat_kho',
            xuatKhoById: 'u1',
            ngayXuatKho: TODAY,
          }),
        }),
      );
      expect(decrease.mock.calls.map((c) => c[0].soLoId)).toEqual([
        'lot1',
        'lot2',
      ]);
      expect(decrease).toHaveBeenCalledWith(
        expect.objectContaining({
          loai: 'xuat_kho',
          soLuongCoBan: 10,
          thamChieu: { loai: 'phieu_xuat_hang', id: 'p1' },
        }),
        admin,
        tx,
      );
    });

    it('không còn là nháp → INVALID_STATE; không tồn tại → NOT_FOUND; không trừ tồn', async () => {
      const done = setup({ state: 'da_xuat_kho' });
      await expect(done.service.issue('p1', admin)).rejects.toMatchObject({
        code: 'PHIEU_XUAT_INVALID_STATE',
      });
      expect(done.decrease).not.toHaveBeenCalled();
      await expect(
        setup({ state: null }).service.issue('p1', admin),
      ).rejects.toMatchObject({
        code: 'PHIEU_XUAT_NOT_FOUND',
      });
    });

    it('phiếu rỗng → PHIEU_XUAT_EMPTY', async () => {
      await expect(
        setup({ lines: [] }).service.issue('p1', admin),
      ).rejects.toMatchObject({
        code: 'PHIEU_XUAT_EMPTY',
      });
    });

    it('kiểm lại khách và hạn dùng từng lô khi xuất; lỗi thì không trừ tồn', async () => {
      const ok = setup();
      await ok.service.issue('p1', admin);
      expect(ok.assertCanBuy).toHaveBeenCalledOnce();
      expect(ok.assertIssuable).toHaveBeenCalledTimes(2);

      const expired = new AppException('SO_LO_EXPIRED');
      const bad = setup({ issueError: expired });
      await expect(bad.service.issue('p1', admin)).rejects.toBe(expired);
      expect(bad.decrease).not.toHaveBeenCalled();

      const inactive = new AppException('KHACH_HANG_INACTIVE');
      await expect(
        setup({ customerError: inactive }).service.issue('p1', admin),
      ).rejects.toBe(inactive);
    });

    it('thiếu tồn ở một dòng: lỗi lan ra (giao dịch rollback)', async () => {
      const { service, decrease } = setup();
      decrease.mockRejectedValueOnce(new AppException('TON_KHO_INSUFFICIENT'));
      await expect(service.issue('p1', admin)).rejects.toMatchObject({
        code: 'TON_KHO_INSUFFICIENT',
      });
    });
  });

  describe('deliver', () => {
    it('chuyển sang da_giao với ngày mặc định hôm nay', async () => {
      const { service, tx } = setup({ state: 'da_xuat_kho' });
      await service.deliver('p1', {}, keeper);
      expect(tx.phieuXuatHang.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p1', trangThai: 'da_xuat_kho' },
          data: expect.objectContaining({
            trangThai: 'da_giao',
            ngayGiaoThucTe: TODAY,
          }),
        }),
      );
    });

    it('ngày tương lai → 400 trước khi mở giao dịch; trước ngày xuất kho → 400; sai trạng thái → 409', async () => {
      const { service, tx } = setup({ state: 'da_xuat_kho' });
      await expect(
        service.deliver('p1', { ngayGiaoThucTe: '2026-10-07' }, keeper),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(tx.phieuXuatHang.updateMany).not.toHaveBeenCalled();
      await expect(
        service.deliver('p1', { ngayGiaoThucTe: '2026-10-05' }, keeper),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
      await expect(
        setup({ state: 'cho_xu_ly' }).service.deliver('p1', {}, keeper),
      ).rejects.toMatchObject({ code: 'PHIEU_XUAT_INVALID_STATE' });
    });
  });

  describe('cancel', () => {
    it('hủy phiếu chờ xử lý (kể cả NVK): không đụng tồn, nhật ký phieu_xuat.cancel', async () => {
      const { service, increase, record, tx } = setup();
      await service.cancel('p1', { lyDo: 'khách hủy' }, keeper);
      expect(increase).not.toHaveBeenCalled();
      expect(tx.phieuXuatHang.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            trangThai: 'da_huy',
            huyById: 'u2',
            lyDoHuy: 'khách hủy',
          }),
        }),
      );
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({ hanhDong: 'phieu_xuat.cancel' }),
        tx,
      );
    });

    it('đã xuất kho: NVK → AUTH_FORBIDDEN; quản lý → hoàn tồn huy_xuat về đúng vị trí, bỏ qua kiểm vị trí hoạt động', async () => {
      const denied = setup({ state: 'da_xuat_kho' });
      await expect(
        denied.service.cancel('p1', { lyDo: 'x' }, keeper),
      ).rejects.toMatchObject({
        code: 'AUTH_FORBIDDEN',
      });
      expect(denied.increase).not.toHaveBeenCalled();

      const ok = setup({ state: 'da_xuat_kho' });
      await ok.service.cancel('p1', { lyDo: 'x' }, manager);
      expect(ok.increase).toHaveBeenCalledTimes(2);
      expect(ok.increase).toHaveBeenCalledWith(
        expect.objectContaining({
          loai: 'huy_xuat',
          viTriId: 'v1',
          soLuongCoBan: 10,
          boQuaKiemTraViTriHoatDong: true,
        }),
        manager,
        ok.tx,
      );
      expect(ok.record).toHaveBeenCalledWith(
        expect.objectContaining({ hanhDong: 'phieu_xuat.cancel_after_issue' }),
        ok.tx,
      );
    });

    it('còn phiếu thu hiệu lực → CANNOT_REVERSE, chưa hoàn tồn', async () => {
      const { service, increase } = setup({
        state: 'da_xuat_kho',
        receipts: 1,
      });
      await expect(
        service.cancel('p1', { lyDo: 'x' }, admin),
      ).rejects.toMatchObject({
        code: 'PHIEU_XUAT_CANNOT_REVERSE',
      });
      expect(increase).not.toHaveBeenCalled();
    });

    it('đã giao hoặc đã hủy → INVALID_STATE; không tồn tại → NOT_FOUND', async () => {
      for (const state of ['da_giao', 'da_huy']) {
        await expect(
          setup({ state }).service.cancel('p1', { lyDo: 'x' }, admin),
        ).rejects.toMatchObject({ code: 'PHIEU_XUAT_INVALID_STATE' });
      }
      await expect(
        setup({ state: null }).service.cancel('p1', { lyDo: 'x' }, admin),
      ).rejects.toMatchObject({ code: 'PHIEU_XUAT_NOT_FOUND' });
    });
  });

  describe('update / remove', () => {
    it('phiếu không còn là nháp → INVALID_STATE; không có → NOT_FOUND', async () => {
      const done = setup({ state: 'da_xuat_kho' });
      await expect(done.service.remove('p1', admin)).rejects.toMatchObject({
        code: 'PHIEU_XUAT_INVALID_STATE',
      });
      await expect(
        setup({ state: null }).service.update('p1', {}, admin),
      ).rejects.toMatchObject({
        code: 'PHIEU_XUAT_NOT_FOUND',
      });
    });
  });

  describe('getReceivableSummary', () => {
    it('tổng = hàng − chiết khấu + thuế; đã thu (chỉ phiếu thu hiệu lực); còn nợ', async () => {
      const { service } = setup();
      const client = {
        chiTietPhieuXuatHang: {
          findMany: vi.fn(async () => [
            {
              soLuong: 2,
              donGia: new Prisma.Decimal('125000'),
              tienChietKhau: new Prisma.Decimal('25000'),
              tienThueGtgt: new Prisma.Decimal('18000'),
            },
            {
              soLuong: 1,
              donGia: new Prisma.Decimal('50000'),
              tienChietKhau: new Prisma.Decimal('0'),
              tienThueGtgt: new Prisma.Decimal('0'),
            },
          ]),
        },
        phieuThuCongNo: {
          aggregate: vi.fn(async () => ({
            _sum: { soTien: new Prisma.Decimal('100000') },
          })),
        },
      };
      const result = await service.getReceivableSummary('p1', client as never);
      expect(
        [result.tongTien, result.daThu, result.conNo].map((v) => v.toFixed(2)),
      ).toEqual(['293000.00', '100000.00', '193000.00']);
      expect(client.phieuThuCongNo.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { phieuXuatHangId: 'p1', huyAt: null },
        }),
      );
    });
  });

  it('assertUsable không được gọi khi phiếu không có xe', async () => {
    const { service, assertUsable } = setup();
    await service.issue('p1', admin);
    expect(assertUsable).not.toHaveBeenCalled();
  });
});
