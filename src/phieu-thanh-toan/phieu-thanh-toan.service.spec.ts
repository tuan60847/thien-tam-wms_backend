import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { PhieuThanhToanService } from './phieu-thanh-toan.service.js';

const TODAY = new Date('2026-10-06T00:00:00Z');
const actor = { id: 'u1' } as AuthenticatedUser;
const dto = {
  phieuNhapHangId: 'p1',
  soTien: '400000',
  ngayThanhToan: '2026-10-05',
  phuongThuc: 'chuyen_khoan' as const,
};

function setup(
  options: {
    receipt?: { trang_thai: string; ngay_nhan_hang: Date | null } | null;
    conNo?: string;
    voidCount?: number;
    paymentExists?: boolean;
    ncc?: { id: string } | null;
    receipts?: unknown[];
  } = {},
) {
  const receipt =
    options.receipt === undefined
      ? {
          trang_thai: 'da_nhap_kho',
          ngay_nhan_hang: new Date('2026-10-01T00:00:00Z'),
        }
      : options.receipt;
  const tx = {
    $queryRaw: vi.fn(async () => (receipt ? [receipt] : [])),
    phieuThanhToan: {
      create: vi.fn(async () => ({ id: 'tt1' })),
      updateMany: vi.fn(async () => ({ count: options.voidCount ?? 1 })),
      findUnique: vi.fn(async () =>
        options.paymentExists ? { id: 'tt1' } : null,
      ),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
    nhaCungCap: {
      findUnique: vi.fn(async () =>
        options.ncc === undefined
          ? { id: 'ncc', maNCC: 'NCC0001', tenNCC: 'A' }
          : options.ncc,
      ),
    },
    phieuNhapHang: { findMany: vi.fn(async () => options.receipts ?? []) },
  } as never;
  const getPaymentSummary = vi.fn(async () => ({
    conNo: new Prisma.Decimal(options.conNo ?? '1000000'),
  }));
  const next = vi.fn(async () => 'TT2610060001');
  const record = vi.fn().mockResolvedValue({});
  const service = new PhieuThanhToanService(
    prisma,
    { next } as never,
    { record } as never,
    {
      today: () => TODAY,
      now: () => new Date('2026-10-06T08:00:00Z'),
    } as never,
    { getPaymentSummary } as never,
    { setContext: vi.fn(), info: vi.fn() } as never,
  );
  vi.spyOn(service, 'findOne').mockResolvedValue({ id: 'tt1' } as never);
  return { service, tx, getPaymentSummary, record };
}

describe('PhieuThanhToanService', () => {
  describe('create', () => {
    it('trả một phần: sinh mã TT, lưu người lập, không vượt nợ', async () => {
      const { service, tx } = setup();
      await service.create(dto, actor);
      expect(tx.phieuThanhToan.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          maPhieuThanhToan: 'TT2610060001',
          phieuNhapHangId: 'p1',
          createdById: 'u1',
          phuongThuc: 'chuyen_khoan',
        }),
      });
    });

    it('trả đúng bằng số còn nợ được; hơn 1 đồng → EXCEEDS_DEBT kèm conNo', async () => {
      const exact = setup({ conNo: '400000' });
      await expect(exact.service.create(dto, actor)).resolves.toBeDefined();
      const over = setup({ conNo: '399999.99' });
      await expect(over.service.create(dto, actor)).rejects.toMatchObject({
        code: 'PHIEU_THANH_TOAN_EXCEEDS_DEBT',
        details: { conNo: '399999.99' },
      });
      expect(over.tx.phieuThanhToan.create).not.toHaveBeenCalled();
    });

    it('khóa dòng phiếu nhập là truy vấn đầu tiên trong giao dịch', async () => {
      const { service, tx, getPaymentSummary } = setup();
      await service.create(dto, actor);
      expect(tx.$queryRaw.mock.invocationCallOrder[0]!).toBeLessThan(
        getPaymentSummary.mock.invocationCallOrder[0]!,
      );
    });

    it.each([
      [
        'nháp',
        { trang_thai: 'cho_xac_nhan', ngay_nhan_hang: null },
        'PHIEU_THANH_TOAN_RECEIPT_INVALID_STATE',
      ],
      [
        'đã hủy',
        { trang_thai: 'da_huy', ngay_nhan_hang: null },
        'PHIEU_THANH_TOAN_RECEIPT_INVALID_STATE',
      ],
      ['không tồn tại', null, 'PHIEU_NHAP_NOT_FOUND'],
    ])('phiếu nhập %s → %s', async (_n, receipt, code) => {
      const { service } = setup({ receipt });
      await expect(service.create(dto, actor)).rejects.toMatchObject({ code });
    });

    it('ngày tương lai hoặc trước ngày nhận hàng → PHIEU_THANH_TOAN_DATE_INVALID', async () => {
      const { service } = setup();
      await expect(
        service.create({ ...dto, ngayThanhToan: '2026-10-07' }, actor),
      ).rejects.toMatchObject({ code: 'PHIEU_THANH_TOAN_DATE_INVALID' });
      await expect(
        service.create({ ...dto, ngayThanhToan: '2026-09-30' }, actor),
      ).rejects.toMatchObject({ code: 'PHIEU_THANH_TOAN_DATE_INVALID' });
    });
  });

  describe('voidPayment', () => {
    it('hủy có lý do: ghi nhật ký phieu_thanh_toan.void', async () => {
      const { service, record, tx } = setup();
      await service.voidPayment('tt1', { lyDo: 'sai số tiền' }, actor);
      expect(tx.phieuThanhToan.updateMany).toHaveBeenCalledWith({
        where: { id: 'tt1', huyAt: null },
        data: expect.objectContaining({
          huyById: 'u1',
          lyDoHuy: 'sai số tiền',
        }),
      });
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          hanhDong: 'phieu_thanh_toan.void',
          lyDo: 'sai số tiền',
        }),
        tx,
      );
    });

    it('đã hủy → ALREADY_VOID; không có → NOT_FOUND; không ghi nhật ký', async () => {
      const done = setup({ voidCount: 0, paymentExists: true });
      await expect(
        done.service.voidPayment('tt1', { lyDo: 'x' }, actor),
      ).rejects.toMatchObject({
        code: 'PHIEU_THANH_TOAN_ALREADY_VOID',
      });
      expect(done.record).not.toHaveBeenCalled();
      const missing = setup({ voidCount: 0, paymentExists: false });
      await expect(
        missing.service.voidPayment('tt1', { lyDo: 'x' }, actor),
      ).rejects.toMatchObject({
        code: 'PHIEU_THANH_TOAN_NOT_FOUND',
      });
    });
  });

  describe('congNoNhaCungCap', () => {
    const receipt = (
      id: string,
      ngay: string,
      tong: string,
      payments: { soTien: string; huy: boolean }[],
    ) => ({
      id,
      maPhieuNhapHang: id.toUpperCase(),
      ngayNhanHang: new Date(`${ngay}T00:00:00Z`),
      chiTietPhieuNhapHangs: [{ soLuong: 1, donGia: new Prisma.Decimal(tong) }],
      phieuThanhToans: payments.map((p) => ({
        soTien: new Prisma.Decimal(p.soTien),
        huyAt: p.huy ? new Date() : null,
      })),
    });
    const receipts = [
      receipt('a', '2026-10-01', '1000', [
        { soTien: '400', huy: false },
        { soTien: '100', huy: true },
      ]),
      receipt('b', '2026-10-03', '500', [{ soTien: '500', huy: false }]),
    ];

    it('bỏ thanh toán đã hủy, bỏ phiếu đã trả hết, tính số ngày nợ theo hôm nay', async () => {
      const { service } = setup({ receipts });
      const result = await service.congNoNhaCungCap('ncc', {});
      expect(result).toMatchObject({
        tongPhaiTra: '1500.00',
        daThanhToan: '900.00',
        conNo: '600.00',
      });
      expect(result.phieuConNo).toEqual([
        expect.objectContaining({
          phieuNhapId: 'a',
          conNo: '600.00',
          soNgayNo: 5,
        }),
      ]);
    });

    it('chiConNo=false giữ cả phiếu đã trả hết', async () => {
      const { service } = setup({ receipts });
      const result = await service.congNoNhaCungCap('ncc', { chiConNo: false });
      expect(result.phieuConNo.map((p) => p.phieuNhapId)).toEqual(['a', 'b']);
    });

    it('NCC không tồn tại → NHA_CUNG_CAP_NOT_FOUND', async () => {
      const { service } = setup({ ncc: null });
      await expect(service.congNoNhaCungCap('x', {})).rejects.toMatchObject({
        code: 'NHA_CUNG_CAP_NOT_FOUND',
      });
    });
  });
});
