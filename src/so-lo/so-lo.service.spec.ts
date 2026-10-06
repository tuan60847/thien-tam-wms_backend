import type { SoLo } from '@prisma/client';
import type { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import type { ClockService } from '../common/clock/clock.service.js';
import type { HangHoaService } from '../hang-hoa/hang-hoa.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { SoLoService } from './so-lo.service.js';

const actor = { id: 'u1' } as AuthenticatedUser;
const TODAY = new Date('2026-10-06T00:00:00Z');
const day = (s: string) => new Date(`${s}T00:00:00Z`);
const hangHoa = { id: 'h1', maSP: 'SP1', tenSP: 'Thuốc' };

const lot = (over: Partial<SoLo> = {}): SoLo => ({
  id: 'l1',
  tenLo: 'L1',
  ngaySX: null,
  hanSuDung: day('2027-10-06'),
  trangThai: 'con_han',
  hangHoaId: 'h1',
  createdById: 'u1',
  updatedById: 'u1',
  createdAt: TODAY,
  updatedAt: TODAY,
  ...over,
});

interface Options {
  lots?: SoLo[];
  stock?: number; // TonKho rows for any lot
  movements?: number;
  issuedLines?: number;
  receiptLines?: number;
  receivableError?: unknown;
  config?: Partial<{
    minShelfLifeDaysReceive: number;
    minShelfLifeDaysIssue: number;
  }>;
}

function setup(options: Options = {}) {
  const store = new Map((options.lots ?? []).map((l) => [l.id, l]));
  let seq = 0;
  const withHang = (l: SoLo) => ({ ...l, hangHoa });
  const byName = (hangHoaId: string, tenLo: string) =>
    [...store.values()].find(
      (l) => l.hangHoaId === hangHoaId && l.tenLo === tenLo,
    );

  const tx = {
    soLo: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: {
            id?: string;
            hangHoaId_tenLo?: { hangHoaId: string; tenLo: string };
          };
        }) => {
          const row = where.id
            ? store.get(where.id)
            : byName(
                where.hangHoaId_tenLo!.hangHoaId,
                where.hangHoaId_tenLo!.tenLo,
              );
          return row ? withHang(row) : null;
        },
      ),
      create: vi.fn(async ({ data }: { data: Partial<SoLo> }) => {
        const row = lot({ id: `n${++seq}`, ...data });
        store.set(row.id, row);
        return withHang(row);
      }),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<SoLo>;
        }) => {
          const next = { ...store.get(where.id)! };
          for (const [k, v] of Object.entries(data))
            if (v !== undefined) Object.assign(next, { [k]: v });
          store.set(where.id, next);
          return withHang(next);
        },
      ),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        store.delete(where.id);
      }),
      updateMany: vi.fn(async () => ({ count: 2 })),
    },
    tonKho: {
      count: vi.fn(async () => options.stock ?? 0),
      aggregate: vi.fn(async () => ({
        _sum: { soLuong: options.stock ? 40 : null },
      })),
    },
    bienDongTonKho: { count: vi.fn(async () => options.movements ?? 0) },
    chiTietPhieuNhapHang: {
      count: vi.fn(async () => options.receiptLines ?? 0),
    },
    chiTietPhieuXuatHang: {
      count: vi.fn(async () => options.issuedLines ?? 0),
    },
  };
  const prisma = {
    ...tx,
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  } as unknown as PrismaService;
  const findByIdOrThrow = vi.fn(async () => ({ id: 'h1' }));
  const assertReceivable = vi.fn(() => {
    if (options.receivableError) throw options.receivableError;
  });
  const hang = {
    findByIdOrThrow,
    assertReceivable,
  } as unknown as HangHoaService;
  const record = vi.fn().mockResolvedValue({});
  const audit = { record } as unknown as AuditService;
  const clock = { today: () => TODAY } as unknown as ClockService;
  const config = {
    expiryWarningDays: 90,
    minShelfLifeDaysReceive: 0,
    minShelfLifeDaysIssue: 0,
    ...options.config,
  } as never;
  const service = new SoLoService(prisma, hang, audit, clock, config);
  return { service, store, tx, record, assertReceivable };
}

describe('SoLoService', () => {
  describe('create', () => {
    it('tạo lô, ghi người tạo; trạng thái tính theo hạn dùng', async () => {
      const { service, tx } = setup();
      const created = await service.create(
        {
          hangHoaId: 'h1',
          tenLo: 'L9',
          ngaySX: '2026-01-01',
          hanSuDung: '2026-11-01',
        },
        actor,
      );
      expect(created).toMatchObject({
        tenLo: 'L9',
        trangThai: 'can_date',
        soNgayConLai: 26,
        ngaySX: '2026-01-01',
      });
      expect(tx.soLo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdById: 'u1',
            updatedById: 'u1',
          }),
        }),
      );
    });

    it('hạn dùng đã qua → SO_LO_EXPIRED; ngày SX tương lai → SO_LO_DATE_INVALID; không ghi', async () => {
      const { service, tx } = setup();
      await expect(
        service.create(
          { hangHoaId: 'h1', tenLo: 'A', hanSuDung: '2026-10-05' },
          actor,
        ),
      ).rejects.toMatchObject({ code: 'SO_LO_EXPIRED' });
      await expect(
        service.create(
          {
            hangHoaId: 'h1',
            tenLo: 'A',
            ngaySX: '2026-10-07',
            hanSuDung: '2027-01-01',
          },
          actor,
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
      await expect(
        service.create(
          {
            hangHoaId: 'h1',
            tenLo: 'A',
            ngaySX: '2026-10-01',
            hanSuDung: '2026-10-01',
          },
          actor,
        ),
      ).rejects.toMatchObject({ code: 'SO_LO_DATE_INVALID' });
      expect(tx.soLo.create).not.toHaveBeenCalled();
    });

    it('trùng tên trong cùng hàng → SO_LO_NAME_TAKEN; hàng không nhận được → lỗi của hàng', async () => {
      const { service } = setup({ lots: [lot({ tenLo: 'L1' })] });
      await expect(
        service.create(
          { hangHoaId: 'h1', tenLo: 'L1', hanSuDung: '2027-01-01' },
          actor,
        ),
      ).rejects.toMatchObject({ code: 'SO_LO_NAME_TAKEN' });
      const blocked = setup({ receivableError: new Error('hang ngung') });
      await expect(
        blocked.service.create(
          { hangHoaId: 'h1', tenLo: 'X', hanSuDung: '2027-01-01' },
          actor,
        ),
      ).rejects.toThrow('hang ngung');
    });
  });

  describe('findOne', () => {
    it('kèm tổng tồn, số vị trí còn hàng và cờ đã phát sinh chứng từ', async () => {
      const { service } = setup({ lots: [lot()], stock: 2, receiptLines: 1 });
      await expect(service.findOne('l1')).resolves.toMatchObject({
        tongTon: 40,
        soViTri: 2,
        daPhatSinhChungTu: true,
      });
    });

    it('không có → SO_LO_NOT_FOUND', async () => {
      await expect(setup().service.findOne('x')).rejects.toMatchObject({
        code: 'SO_LO_NOT_FOUND',
      });
    });
  });

  describe('update', () => {
    it('đổi hạn dùng lô chưa phát sinh: ghi nhật ký trước/sau', async () => {
      const { service, record } = setup({ lots: [lot()] });
      const updated = await service.update(
        'l1',
        { hanSuDung: '2028-01-01', lyDo: 'nhập nhầm' },
        actor,
      );
      expect(updated.hanSuDung).toBe('2028-01-01');
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          hanhDong: 'so_lo.expiry_change',
          truoc: { ngaySX: null, hanSuDung: '2027-10-06' },
          sau: { ngaySX: null, hanSuDung: '2028-01-01' },
          lyDo: 'nhập nhầm',
        }),
        expect.anything(),
      );
    });

    it('lô đã có biến động: đổi hạn phải có lý do', async () => {
      const { service, tx } = setup({ lots: [lot()], movements: 3 });
      await expect(
        service.update('l1', { hanSuDung: '2028-01-01' }, actor),
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
      });
      expect(tx.soLo.update).not.toHaveBeenCalled();
      await expect(
        service.update('l1', { hanSuDung: '2028-01-01', lyDo: 'sửa' }, actor),
      ).resolves.toMatchObject({ hanSuDung: '2028-01-01' });
    });

    it('lô đã xuất kho → SO_LO_EXPIRY_LOCKED', async () => {
      const { service } = setup({ lots: [lot()], issuedLines: 1 });
      await expect(
        service.update('l1', { hanSuDung: '2028-01-01', lyDo: 'x' }, actor),
      ).rejects.toMatchObject({ code: 'SO_LO_EXPIRY_LOCKED' });
    });

    it('hạn không sau ngày SX → SO_LO_DATE_INVALID', async () => {
      const { service } = setup({ lots: [lot({ ngaySX: day('2026-01-01') })] });
      await expect(
        service.update('l1', { hanSuDung: '2026-01-01' }, actor),
      ).rejects.toMatchObject({ code: 'SO_LO_DATE_INVALID' });
    });

    it('gửi lại đúng giá trị cũ không tính là đổi: không nhật ký, không cần lý do', async () => {
      const { service, record } = setup({
        lots: [lot()],
        movements: 5,
        issuedLines: 1,
      });
      await service.update('l1', { hanSuDung: '2027-10-06' }, actor);
      expect(record).not.toHaveBeenCalled();
    });

    it('đổi tên: lô chưa có lịch sử được; có lịch sử → SO_LO_IN_USE; trùng tên → SO_LO_NAME_TAKEN', async () => {
      const free = setup({ lots: [lot(), lot({ id: 'l2', tenLo: 'L2' })] });
      await expect(
        free.service.update('l1', { tenLo: 'L2' }, actor),
      ).rejects.toMatchObject({
        code: 'SO_LO_NAME_TAKEN',
      });
      await expect(
        free.service.update('l1', { tenLo: 'L3' }, actor),
      ).resolves.toMatchObject({ tenLo: 'L3' });
      const used = setup({ lots: [lot()], stock: 1 });
      await expect(
        used.service.update('l1', { tenLo: 'L3' }, actor),
      ).rejects.toMatchObject({
        code: 'SO_LO_IN_USE',
      });
    });

    it('không có → SO_LO_NOT_FOUND', async () => {
      await expect(
        setup().service.update('x', { tenLo: 'A' }, actor),
      ).rejects.toMatchObject({
        code: 'SO_LO_NOT_FOUND',
      });
    });
  });

  describe('remove', () => {
    it('xóa lô chưa phát sinh', async () => {
      const { service, store } = setup({ lots: [lot()] });
      await service.remove('l1');
      expect(store.size).toBe(0);
    });

    it.each([
      ['có dòng tồn', { stock: 1 }],
      ['có biến động', { movements: 1 }],
      ['có dòng phiếu nhập', { receiptLines: 1 }],
      ['có dòng phiếu xuất', { issuedLines: 1 }],
    ] as [string, Options][])(
      '%s → SO_LO_IN_USE, không xóa',
      async (_n, extra) => {
        const { service, store } = setup({ lots: [lot()], ...extra });
        await expect(service.remove('l1')).rejects.toMatchObject({
          code: 'SO_LO_IN_USE',
        });
        expect(store.size).toBe(1);
      },
    );
  });

  describe('assertReceivable / assertIssuable', () => {
    it('hạn đúng hôm nay vẫn dùng được; hôm qua thì hết hạn', () => {
      const { service } = setup();
      expect(() =>
        service.assertReceivable({ hanSuDung: TODAY }),
      ).not.toThrow();
      expect(() =>
        service.assertIssuable({ hanSuDung: day('2026-10-05') }),
      ).toThrow();
    });

    it('áp hạn dùng tối thiểu theo cấu hình riêng cho nhập và xuất', () => {
      const { service } = setup({
        config: { minShelfLifeDaysReceive: 30, minShelfLifeDaysIssue: 10 },
      });
      const soon = { hanSuDung: day('2026-10-26') }; // 20 days left
      expect(() => service.assertReceivable(soon)).toThrow();
      expect(() => service.assertIssuable(soon)).not.toThrow();
    });
  });

  describe('resolveOrCreate', () => {
    const input = {
      hangHoaId: 'h1',
      tenLo: 'L1',
      hanSuDung: day('2027-10-06'),
    };

    it('lô đã có và cùng hạn → dùng lại, không tạo', async () => {
      const { service, tx } = setup({ lots: [lot()] });
      await expect(
        service.resolveOrCreate(input, actor, tx as never),
      ).resolves.toMatchObject({ id: 'l1' });
      expect(tx.soLo.create).not.toHaveBeenCalled();
    });

    it('lô đã có nhưng hạn khác → SO_LO_DATE_INVALID (không âm thầm đổi hạn)', async () => {
      const { service, tx } = setup({ lots: [lot()] });
      await expect(
        service.resolveOrCreate(
          { ...input, hanSuDung: day('2028-01-01') },
          actor,
          tx as never,
        ),
      ).rejects.toMatchObject({ code: 'SO_LO_DATE_INVALID' });
    });

    it('ngày SX không gửi thì không so sánh; gửi khác thì lỗi', async () => {
      const { service, tx } = setup({
        lots: [lot({ ngaySX: day('2026-01-01') })],
      });
      await expect(
        service.resolveOrCreate(input, actor, tx as never),
      ).resolves.toBeDefined();
      await expect(
        service.resolveOrCreate(
          { ...input, ngaySX: day('2026-02-01') },
          actor,
          tx as never,
        ),
      ).rejects.toMatchObject({ code: 'SO_LO_DATE_INVALID' });
    });

    it('chưa có → tạo mới', async () => {
      const { service, tx } = setup();
      await service.resolveOrCreate(input, actor, tx as never);
      expect(tx.soLo.create).toHaveBeenCalledOnce();
    });
  });

  describe('refreshExpiryStatuses', () => {
    it('cập nhật ba nhóm và trả số dòng đổi của từng nhóm', async () => {
      const { service, tx } = setup();
      await expect(service.refreshExpiryStatuses()).resolves.toEqual({
        hetHan: 2,
        canDate: 2,
        conHan: 2,
      });
      expect(tx.soLo.updateMany).toHaveBeenCalledTimes(3);
      expect(tx.soLo.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hanSuDung: { lt: TODAY }, trangThai: { not: 'het_han' } },
        }),
      );
    });
  });

  describe('findAll', () => {
    it('lọc trangThai thành khoảng ngày dựa trên hạn dùng (không dùng cột cache)', async () => {
      const findMany = vi.fn(async () => []);
      const { service, tx } = setup();
      Object.assign(tx.soLo, { findMany, count: vi.fn(async () => 0) });
      await service.findAll({ page: 1, pageSize: 20, trangThai: 'het_han' });
      const where = (
        findMany.mock.calls[0] as unknown as [
          { where: { hanSuDung: { lte: Date } } },
        ]
      )[0].where;
      expect(where.hanSuDung.lte).toEqual(day('2026-10-05'));
    });

    it('sort ngoài whitelist → VALIDATION_FAILED', () => {
      const { service } = setup();
      expect(() =>
        service.findAll({ page: 1, pageSize: 20, sort: 'ngaySX:asc' }),
      ).toThrow();
    });
  });
});
