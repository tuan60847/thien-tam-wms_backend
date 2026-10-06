import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { AppException } from '../common/errors/app.exception.js';
import { PhieuNhapHangService } from './phieu-nhap-hang.service.js';

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
  maChiTietPhieuNhapHang: string;
  soLoId: string;
  viTriId: string;
  soLuongCoBan: number;
  soLo: {
    hanSuDung: Date;
    hangHoa: { trangThai: boolean; isCanGiuLanh: boolean };
  };
}

const line = (n: number, over: Partial<Line> = {}): Line => ({
  id: `c${n}`,
  maChiTietPhieuNhapHang: `PN-0${n}`,
  soLoId: `lot${n}`,
  viTriId: 'v1',
  soLuongCoBan: 10 * n,
  soLo: {
    hanSuDung: new Date('2027-01-01T00:00:00Z'),
    hangHoa: { trangThai: true, isCanGiuLanh: false },
  },
  ...over,
});

function setup(
  options: {
    state?: string | null; // state of the receipt row; null = missing
    lines?: Line[];
    payments?: number;
    insufficient?: string[]; // soLoIds that cannot be taken back out
    accessError?: unknown;
  } = {},
) {
  const state = options.state === undefined ? 'cho_xac_nhan' : options.state;
  const lines = options.lines ?? [line(1), line(2)];
  const tx = {
    phieuNhapHang: {
      updateMany: vi.fn(
        async ({ where }: { where: { trangThai: string } }) => ({
          count: state === where.trangThai ? 1 : 0,
        }),
      ),
      findUnique: vi.fn(async () => (state ? { trangThai: state } : null)),
      findUniqueOrThrow: vi.fn(async () => ({
        id: 'p1',
        nhaCungCapId: 'ncc',
        phuongTienVanChuyenId: null,
        chiTietPhieuNhapHangs: lines,
      })),
      update: vi.fn(async () => ({})),
    },
    phieuThanhToan: { count: vi.fn(async () => options.payments ?? 0) },
    chiTietPhieuNhapHang: { findMany: vi.fn(async () => lines) },
    $queryRaw: vi.fn(async () => (state ? [{ trang_thai: state }] : [])),
  };
  const prisma = {
    ...tx,
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
    phieuNhapHang: {
      ...tx.phieuNhapHang,
      findUnique: vi.fn(async () => null),
    },
  } as never;
  const findByIdOrThrow = vi.fn(async () => ({ id: 'ncc' }));
  const assertCanSupply = vi.fn(() => {
    if (options.accessError) throw options.accessError;
  });
  const assertUsable = vi.fn(async () => ({}));
  const increase = vi.fn(
    async (_move: { soLoId: string }, ..._rest: unknown[]) => ({
      id: 't',
      soLuong: 1,
    }),
  );
  const decrease = vi.fn(
    async (move: { soLoId: string }, ..._rest: unknown[]) => {
      if (options.insufficient?.includes(move.soLoId)) {
        throw new AppException('TON_KHO_INSUFFICIENT', {
          details: { conLai: 3 },
        });
      }
      return { id: 't', soLuong: 0 };
    },
  );
  const record = vi.fn().mockResolvedValue({});
  const assertLot = vi.fn();
  const assertProduct = vi.fn();
  const service = new PhieuNhapHangService(
    prisma,
    {} as never,
    { record } as never,
    {
      today: () => TODAY,
      now: () => new Date('2026-10-06T08:00:00Z'),
    } as never,
    { findByIdOrThrow, assertCanSupply } as never,
    { assertUsable } as never,
    { assertReceivable: assertLot } as never,
    { assertReceivable: assertProduct } as never,
    {} as never,
    {} as never,
    { increase, decrease } as never,
    { setContext: vi.fn(), info: vi.fn() } as never,
    { expiryWarningDays: 90 } as never,
  );
  // findOne is covered by e2e; the unit tests care about the transaction body.
  vi.spyOn(service, 'findOne').mockResolvedValue({ id: 'p1' } as never);
  return {
    service,
    tx,
    increase,
    decrease,
    record,
    assertUsable,
    assertCanSupply,
    assertLot,
    assertProduct,
  };
}

describe('PhieuNhapHangService', () => {
  describe('confirm', () => {
    it('tăng tồn từng dòng theo thứ tự cố định với loai nhap_kho và thamChieu đúng', async () => {
      const { service, increase, tx } = setup({ lines: [line(2), line(1)] });
      await service.confirm('p1', {}, admin);
      expect(tx.phieuNhapHang.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p1', trangThai: 'cho_xac_nhan' },
          data: expect.objectContaining({
            trangThai: 'da_nhap_kho',
            xacNhanById: 'u1',
            ngayNhanHang: TODAY,
          }),
        }),
      );
      expect(increase.mock.calls.map((c) => c[0].soLoId)).toEqual([
        'lot1',
        'lot2',
      ]);
      expect(increase).toHaveBeenCalledWith(
        expect.objectContaining({
          loai: 'nhap_kho',
          soLuongCoBan: 10,
          thamChieu: { loai: 'phieu_nhap_hang', id: 'p1' },
        }),
        admin,
        tx,
      );
    });

    it('phiếu không còn là nháp → PHIEU_NHAP_INVALID_STATE, không tăng tồn', async () => {
      const { service, increase } = setup({ state: 'da_nhap_kho' });
      await expect(service.confirm('p1', {}, admin)).rejects.toMatchObject({
        code: 'PHIEU_NHAP_INVALID_STATE',
      });
      expect(increase).not.toHaveBeenCalled();
    });

    it('phiếu không tồn tại → PHIEU_NHAP_NOT_FOUND', async () => {
      const { service } = setup({ state: null });
      await expect(service.confirm('p1', {}, admin)).rejects.toMatchObject({
        code: 'PHIEU_NHAP_NOT_FOUND',
      });
    });

    it('phiếu rỗng → PHIEU_NHAP_EMPTY', async () => {
      const { service } = setup({ lines: [] });
      await expect(service.confirm('p1', {}, admin)).rejects.toMatchObject({
        code: 'PHIEU_NHAP_EMPTY',
      });
    });

    it('ngày nhận ở tương lai → PHIEU_NHAP_DATE_INVALID trước khi mở giao dịch', async () => {
      const { service, tx } = setup();
      await expect(
        service.confirm('p1', { ngayNhanHang: '2026-10-07' }, admin),
      ).rejects.toMatchObject({ code: 'PHIEU_NHAP_DATE_INVALID' });
      expect(tx.phieuNhapHang.updateMany).not.toHaveBeenCalled();
    });

    it('kiểm lại NCC, hàng, lô và xe lạnh khi xác nhận', async () => {
      const cold = line(1, {
        soLo: {
          hanSuDung: new Date('2027-01-01T00:00:00Z'),
          hangHoa: { trangThai: true, isCanGiuLanh: true },
        },
      });
      const {
        service,
        assertCanSupply,
        assertLot,
        assertProduct,
        assertUsable,
      } = setup({
        lines: [cold, line(2)],
      });
      await service.confirm('p1', {}, admin);
      expect(assertCanSupply).toHaveBeenCalledOnce();
      expect(assertLot).toHaveBeenCalledTimes(2);
      expect(assertProduct).toHaveBeenCalledTimes(2);
      // no vehicle on the receipt => nothing to check, but the cold flag is computed
      expect(assertUsable).not.toHaveBeenCalled();
    });

    it('NCC hết hạn giấy phép → lỗi lan ra, không tăng tồn', async () => {
      const error = new AppException('NHA_CUNG_CAP_LICENSE_EXPIRED');
      const { service, increase } = setup({ accessError: error });
      await expect(service.confirm('p1', {}, admin)).rejects.toBe(error);
      expect(increase).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('hủy nháp (kể cả NVK): không đụng tồn, ghi nhật ký phieu_nhap.cancel', async () => {
      const { service, decrease, record, tx } = setup();
      await service.cancel('p1', { lyDo: 'nhầm' }, keeper);
      expect(decrease).not.toHaveBeenCalled();
      expect(tx.phieuNhapHang.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            trangThai: 'da_huy',
            lyDoHuy: 'nhầm',
            huyById: 'u2',
          }),
        }),
      );
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({ hanhDong: 'phieu_nhap.cancel' }),
        tx,
      );
    });

    it('phiếu đã nhập kho: NVK → AUTH_FORBIDDEN; quản lý → trừ tồn huy_nhap từng dòng + nhật ký', async () => {
      const denied = setup({ state: 'da_nhap_kho' });
      await expect(
        denied.service.cancel('p1', { lyDo: 'x' }, keeper),
      ).rejects.toMatchObject({
        code: 'AUTH_FORBIDDEN',
      });
      expect(denied.decrease).not.toHaveBeenCalled();

      const ok = setup({ state: 'da_nhap_kho' });
      await ok.service.cancel('p1', { lyDo: 'x' }, manager);
      expect(ok.decrease).toHaveBeenCalledTimes(2);
      expect(ok.decrease).toHaveBeenCalledWith(
        expect.objectContaining({ loai: 'huy_nhap', soLuongCoBan: 10 }),
        manager,
        ok.tx,
      );
      expect(ok.record).toHaveBeenCalledWith(
        expect.objectContaining({
          hanhDong: 'phieu_nhap.cancel_after_receipt',
        }),
        ok.tx,
      );
    });

    it('còn phiếu thanh toán hiệu lực → CANNOT_REVERSE, chưa trừ tồn', async () => {
      const { service, decrease } = setup({
        state: 'da_nhap_kho',
        payments: 1,
      });
      await expect(
        service.cancel('p1', { lyDo: 'x' }, admin),
      ).rejects.toMatchObject({
        code: 'PHIEU_NHAP_CANNOT_REVERSE',
        details: { lyDo: 'co_phieu_thanh_toan' },
      });
      expect(decrease).not.toHaveBeenCalled();
    });

    it('thiếu tồn ở nhiều dòng → CANNOT_REVERSE liệt kê đủ các dòng thiếu', async () => {
      const { service } = setup({
        state: 'da_nhap_kho',
        lines: [line(1), line(2), line(3)],
        insufficient: ['lot1', 'lot3'],
      });
      await expect(
        service.cancel('p1', { lyDo: 'x' }, admin),
      ).rejects.toMatchObject({
        code: 'PHIEU_NHAP_CANNOT_REVERSE',
        details: {
          lyDo: 'thieu_ton',
          dong: [
            { maChiTietPhieuNhapHang: 'PN-01', conLai: 3, canTra: 10 },
            { maChiTietPhieuNhapHang: 'PN-03', conLai: 3, canTra: 30 },
          ],
        },
      });
    });

    it('đã hủy → INVALID_STATE; không tồn tại → NOT_FOUND', async () => {
      await expect(
        setup({ state: 'da_huy' }).service.cancel('p1', { lyDo: 'x' }, admin),
      ).rejects.toMatchObject({ code: 'PHIEU_NHAP_INVALID_STATE' });
      await expect(
        setup({ state: null }).service.cancel('p1', { lyDo: 'x' }, admin),
      ).rejects.toMatchObject({ code: 'PHIEU_NHAP_NOT_FOUND' });
    });
  });

  describe('update / remove', () => {
    it('phiếu đã xác nhận → INVALID_STATE; không có → NOT_FOUND', async () => {
      const done = setup({ state: 'da_nhap_kho' });
      done.tx.phieuNhapHang.findUnique.mockResolvedValue({
        trangThai: 'da_nhap_kho',
      });
      await expect(done.service.remove('p1', admin)).rejects.toMatchObject({
        code: 'PHIEU_NHAP_INVALID_STATE',
      });
      const missing = setup({ state: null });
      await expect(
        missing.service.update('p1', {}, admin),
      ).rejects.toMatchObject({
        code: 'PHIEU_NHAP_NOT_FOUND',
      });
    });
  });

  describe('getPaymentSummary', () => {
    it('tổng, đã trả (bỏ phiếu đã hủy do truy vấn lọc huyAt null) và còn nợ', async () => {
      const { service } = setup();
      const client = {
        chiTietPhieuNhapHang: {
          findMany: vi.fn(async () => [
            { soLuong: 3, donGia: new Prisma.Decimal('90000') },
            { soLuong: 1, donGia: new Prisma.Decimal('10000') },
          ]),
        },
        phieuThanhToan: {
          aggregate: vi.fn(async () => ({
            _sum: { soTien: new Prisma.Decimal('80000') },
          })),
        },
      };
      const result = await service.getPaymentSummary('p1', client as never);
      expect(
        [result.tongTien, result.daThanhToan, result.conNo].map((v) =>
          v.toFixed(2),
        ),
      ).toEqual(['280000.00', '80000.00', '200000.00']);
      expect(client.phieuThanhToan.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { phieuNhapHangId: 'p1', huyAt: null },
        }),
      );
    });

    it('chưa có thanh toán → daThanhToan 0', async () => {
      const { service } = setup();
      const client = {
        chiTietPhieuNhapHang: { findMany: vi.fn(async () => []) },
        phieuThanhToan: {
          aggregate: vi.fn(async () => ({ _sum: { soTien: null } })),
        },
      };
      const result = await service.getPaymentSummary('p1', client as never);
      expect(result.conNo.toFixed(2)).toBe('0.00');
    });
  });
});
