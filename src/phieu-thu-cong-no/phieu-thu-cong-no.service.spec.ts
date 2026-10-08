import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { PhieuThuCongNoService } from './phieu-thu-cong-no.service.js';

const TODAY = new Date('2026-10-06T00:00:00Z');
const actor = { id: 'u1' } as AuthenticatedUser;
const dto = {
  phieuXuatHangId: 'p1',
  soTien: '300000',
  ngayThanhToan: '2026-10-05',
  phuongThuc: 'tien_mat' as const,
};

function setup(
  options: {
    order?: { trang_thai: string; ngay_xuat_kho: Date | null } | null;
    conNo?: string;
    voidCount?: number;
    receiptExists?: boolean;
    customer?: {
      id: string;
      maKH: string;
      tenKH: string;
      soNoToiDa: Prisma.Decimal;
    } | null;
    orders?: unknown[];
  } = {},
) {
  const order =
    options.order === undefined
      ? {
          trang_thai: 'da_xuat_kho',
          ngay_xuat_kho: new Date('2026-10-01T00:00:00Z'),
        }
      : options.order;
  const tx = {
    $queryRaw: vi.fn(async () => (order ? [order] : [])),
    phieuThuCongNo: {
      create: vi.fn(async () => ({ id: 'pt1' })),
      updateMany: vi.fn(async () => ({ count: options.voidCount ?? 1 })),
      findUnique: vi.fn(async () =>
        options.receiptExists ? { id: 'pt1' } : null,
      ),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
    khachHang: {
      findUnique: vi.fn(async () =>
        options.customer === undefined
          ? {
              id: 'kh',
              maKH: 'KH00001',
              tenKH: 'A',
              soNoToiDa: new Prisma.Decimal(0),
            }
          : options.customer,
      ),
    },
    phieuXuatHang: { findMany: vi.fn(async () => options.orders ?? []) },
  } as never;
  const getReceivableSummary = vi.fn(async () => ({
    conNo: new Prisma.Decimal(options.conNo ?? '1000000'),
  }));
  const record = vi.fn().mockResolvedValue({});
  const service = new PhieuThuCongNoService(
    prisma,
    { next: vi.fn(async () => 'PT2610060001') } as never,
    { record } as never,
    {
      today: () => TODAY,
      now: () => new Date('2026-10-06T08:00:00Z'),
    } as never,
    { getReceivableSummary } as never,
    { assertUsable: vi.fn() } as never,
    { setContext: vi.fn(), info: vi.fn() } as never,
  );
  vi.spyOn(service, 'findOne').mockResolvedValue({ id: 'pt1' } as never);
  return { service, tx, getReceivableSummary, record };
}

describe('PhieuThuCongNoService', () => {
  describe('create', () => {
    it('thu một phần: sinh mã PT, lưu người lập và phương thức', async () => {
      const { service, tx } = setup();
      await service.create(dto, actor);
      expect(tx.phieuThuCongNo.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          maPhieuThuCongNo: 'PT2610060001',
          phieuXuatHangId: 'p1',
          createdById: 'u1',
          phuongThuc: 'tien_mat',
        }),
      });
    });

    it('bằng đúng số còn nợ được; hơn 1 đồng → EXCEEDS_DEBT kèm conNo, không ghi', async () => {
      await expect(
        setup({ conNo: '300000' }).service.create(dto, actor),
      ).resolves.toBeDefined();
      const over = setup({ conNo: '299999.99' });
      await expect(over.service.create(dto, actor)).rejects.toMatchObject({
        code: 'PHIEU_THU_EXCEEDS_DEBT',
        details: { conNo: '299999.99' },
      });
      expect(over.tx.phieuThuCongNo.create).not.toHaveBeenCalled();
    });

    it('khóa dòng phiếu xuất trước khi tính nợ', async () => {
      const { service, tx, getReceivableSummary } = setup();
      await service.create(dto, actor);
      expect(tx.$queryRaw.mock.invocationCallOrder[0]!).toBeLessThan(
        getReceivableSummary.mock.invocationCallOrder[0]!,
      );
    });

    it('phiếu da_giao thu được; chờ xử lý / đã hủy → ORDER_INVALID_STATE; không có → PHIEU_XUAT_NOT_FOUND', async () => {
      await expect(
        setup({
          order: { trang_thai: 'da_giao', ngay_xuat_kho: null },
        }).service.create(dto, actor),
      ).resolves.toBeDefined();
      for (const trang_thai of ['cho_xu_ly', 'da_huy']) {
        await expect(
          setup({ order: { trang_thai, ngay_xuat_kho: null } }).service.create(
            dto,
            actor,
          ),
        ).rejects.toMatchObject({ code: 'PHIEU_THU_ORDER_INVALID_STATE' });
      }
      await expect(
        setup({ order: null }).service.create(dto, actor),
      ).rejects.toMatchObject({
        code: 'PHIEU_XUAT_NOT_FOUND',
      });
    });

    it('ngày tương lai hoặc trước ngày xuất kho → PHIEU_THU_DATE_INVALID', async () => {
      const { service } = setup();
      await expect(
        service.create({ ...dto, ngayThanhToan: '2026-10-07' }, actor),
      ).rejects.toMatchObject({ code: 'PHIEU_THU_DATE_INVALID' });
      await expect(
        service.create({ ...dto, ngayThanhToan: '2026-09-30' }, actor),
      ).rejects.toMatchObject({ code: 'PHIEU_THU_DATE_INVALID' });
    });
  });

  describe('voidReceipt', () => {
    it('hủy có lý do: ghi nhật ký phieu_thu.void', async () => {
      const { service, record, tx } = setup();
      await service.voidReceipt('pt1', { lyDo: 'sai' }, actor);
      expect(tx.phieuThuCongNo.updateMany).toHaveBeenCalledWith({
        where: { id: 'pt1', huyAt: null },
        data: expect.objectContaining({ huyById: 'u1', lyDoHuy: 'sai' }),
      });
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({ hanhDong: 'phieu_thu.void', lyDo: 'sai' }),
        tx,
      );
    });

    it('đã hủy → ALREADY_VOID; không có → NOT_FOUND; không ghi nhật ký', async () => {
      const done = setup({ voidCount: 0, receiptExists: true });
      await expect(
        done.service.voidReceipt('pt1', { lyDo: 'x' }, actor),
      ).rejects.toMatchObject({
        code: 'PHIEU_THU_ALREADY_VOID',
      });
      expect(done.record).not.toHaveBeenCalled();
      await expect(
        setup({ voidCount: 0 }).service.voidReceipt(
          'pt1',
          { lyDo: 'x' },
          actor,
        ),
      ).rejects.toMatchObject({ code: 'PHIEU_THU_NOT_FOUND' });
    });
  });

  describe('congNoKhachHang', () => {
    const order = (
      id: string,
      ngay: string,
      tong: string,
      receipts: { soTien: string; huy: boolean }[],
      due: string | null = null,
    ) => ({
      id,
      maPhieuXuatHang: id.toUpperCase(),
      ngayXuatKho: new Date(`${ngay}T00:00:00Z`),
      hanThanhToan: due ? new Date(`${due}T00:00:00Z`) : null,
      chiTietPhieuXuatHangs: [
        {
          soLuong: 1,
          donGia: new Prisma.Decimal(tong),
          tienChietKhau: new Prisma.Decimal(0),
          tienThueGtgt: new Prisma.Decimal(0),
        },
      ],
      phieuThuCongNos: receipts.map((r) => ({
        soTien: new Prisma.Decimal(r.soTien),
        huyAt: r.huy ? new Date() : null,
      })),
    });
    const orders = [
      order('a', '2026-08-01', '1000', [
        { soTien: '400', huy: false },
        { soTien: '100', huy: true },
      ]),
      order('b', '2026-10-03', '500', [{ soTien: '500', huy: false }]),
    ];

    it('bỏ phiếu thu đã hủy và phiếu đã thu đủ; tính tuổi nợ và nhóm theo hôm nay', async () => {
      const result = await setup({ orders }).service.congNoKhachHang('kh', {});
      expect(result).toMatchObject({
        tongPhaiThu: '1500.00',
        daThu: '900.00',
        conNo: '600.00',
        vuotHanMuc: null,
      });
      expect(result.phieuConNo).toEqual([
        expect.objectContaining({
          phieuXuatId: 'a',
          conNo: '600.00',
          soNgayNo: 66,
          nhomTuoiNo: '61-90',
        }),
      ]);
    });

    it('hạn mức: có hạn mức thì trả hanMucCongNo và vuotHanMuc theo công nợ; hạn thanh toán → số ngày quá hạn', async () => {
      const dueOrders = [
        order(
          'a',
          '2026-08-01',
          '1000',
          [{ soTien: '400', huy: false }],
          '2026-10-01',
        ),
        order('b', '2026-10-03', '500', [], '2026-11-01'),
      ];
      const over = await setup({
        orders: dueOrders,
        customer: {
          id: 'kh',
          maKH: 'KH00001',
          tenKH: 'A',
          soNoToiDa: new Prisma.Decimal('1000'),
        },
      }).service.congNoKhachHang('kh', {});
      expect(over.khachHang.hanMucCongNo).toBe('1000.00');
      expect(over.conNo).toBe('1100.00');
      expect(over.vuotHanMuc).toBe(true);
      expect(
        over.phieuConNo.map((p) => [p.phieuXuatId, p.soNgayQuaHan]),
      ).toEqual([
        ['a', 5],
        ['b', null],
      ]);

      const within = await setup({
        orders: dueOrders,
        customer: {
          id: 'kh',
          maKH: 'KH00001',
          tenKH: 'A',
          soNoToiDa: new Prisma.Decimal('1100'),
        },
      }).service.congNoKhachHang('kh', {});
      expect(within.vuotHanMuc).toBe(false);
    });

    it('chiConNo=false giữ cả phiếu đã thu đủ; khách không có → KHACH_HANG_NOT_FOUND', async () => {
      const all = await setup({ orders }).service.congNoKhachHang('kh', {
        chiConNo: false,
      });
      expect(all.phieuConNo.map((p) => p.phieuXuatId)).toEqual(['a', 'b']);
      await expect(
        setup({ customer: null }).service.congNoKhachHang('x', {}),
      ).rejects.toMatchObject({ code: 'KHACH_HANG_NOT_FOUND' });
    });
  });
});
