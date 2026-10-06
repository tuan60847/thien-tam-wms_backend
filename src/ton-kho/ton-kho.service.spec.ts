import type { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import type { ViTriService } from '../kho-vi-tri/vi-tri.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { TyLeQuyDoiService } from '../ty-le-quy-doi/ty-le-quy-doi.service.js';
import type { TonKhoQueryService } from './ton-kho-query.service.js';
import { TonKhoService } from './ton-kho.service.js';

const actor = { id: 'u1' } as AuthenticatedUser;

interface Row {
  id: string;
  soLoId: string;
  viTriId: string;
  soLuong: number;
}

function setup(
  options: {
    stock?: Row[];
    cold?: boolean; // the lot's product needs cold storage
    coldLocations?: string[];
  } = {},
) {
  const rows = new Map<string, Row>();
  const key = (soLoId: string, viTriId: string) => `${soLoId}|${viTriId}`;
  for (const r of options.stock ?? []) rows.set(key(r.soLoId, r.viTriId), r);
  const ledger: Record<string, unknown>[] = [];
  let seq = 0;
  const composite = (w: {
    soLoId_viTriId: { soLoId: string; viTriId: string };
  }) =>
    rows.get(key(w.soLoId_viTriId.soLoId, w.soLoId_viTriId.viTriId)) ?? null;

  const tx = {
    soLo: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === 'missing'
          ? null
          : {
              id: where.id,
              hangHoaId: 'h1',
              hangHoa: { id: 'h1', isCanGiuLanh: options.cold ?? false },
            },
      ),
    },
    tonKho: {
      findUnique: vi.fn(async ({ where }: never) => composite(where)),
      findUniqueOrThrow: vi.fn(async ({ where }: never) => composite(where)!),
      create: vi.fn(async ({ data }: { data: Omit<Row, 'id'> }) => {
        const row = { id: `t${++seq}`, ...data };
        rows.set(key(data.soLoId, data.viTriId), row);
        return row;
      }),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: {
            id?: string;
            soLoId?: string;
            viTriId?: string;
            soLuong: number | { gte: number };
          };
          data: { soLuong: number | { decrement: number } };
        }) => {
          const row = where.id
            ? [...rows.values()].find((r) => r.id === where.id)
            : rows.get(key(where.soLoId!, where.viTriId!));
          const ok =
            row &&
            (typeof where.soLuong === 'number'
              ? row.soLuong === where.soLuong
              : row.soLuong >= where.soLuong.gte);
          if (!row || !ok) return { count: 0 };
          row.soLuong =
            typeof data.soLuong === 'number'
              ? data.soLuong
              : row.soLuong - data.soLuong.decrement;
          return { count: 1 };
        },
      ),
    },
    bienDongTonKho: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        ledger.push(data);
        return data;
      }),
    },
    // INSERT ... ON DUPLICATE KEY UPDATE: values = [id, qty, soLoId, viTriId, qty]
    $executeRaw: vi.fn(
      async (
        _s: TemplateStringsArray,
        ...v: [string, number, string, string, number]
      ) => {
        const existing = rows.get(key(v[2], v[3]));
        if (existing) existing.soLuong += v[1];
        else
          rows.set(key(v[2], v[3]), {
            id: v[0],
            soLoId: v[2],
            viTriId: v[3],
            soLuong: v[1],
          });
        return 1;
      },
    ),
  };
  const prisma = {
    ...tx,
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  } as unknown as PrismaService;

  const locationOf = (id: string) => ({
    id,
    isCapDong: options.coldLocations?.includes(id) ?? false,
  });
  const findByIdOrThrow = vi.fn(async (id: string) => locationOf(id));
  const assertReceivable = vi.fn(async (id: string) => locationOf(id));
  const viTri = {
    findByIdOrThrow,
    assertReceivable,
  } as unknown as ViTriService;
  const toBase = vi.fn(async (_h: string, n: number) => n);
  const units = { toBase } as unknown as TyLeQuyDoiService;
  const findOne = vi.fn(async (id: string) => ({ id }));
  const query = { findOne } as unknown as TonKhoQueryService;
  const record = vi.fn().mockResolvedValue({});
  const audit = { record } as unknown as AuditService;
  const logger = { setContext: vi.fn(), info: vi.fn() };

  const service = new TonKhoService(
    prisma,
    viTri,
    units,
    query,
    audit,
    logger as never,
  );
  const quantity = (soLoId: string, viTriId: string) =>
    rows.get(key(soLoId, viTriId))?.soLuong ?? 0;
  return {
    service,
    tx,
    ledger,
    record,
    quantity,
    toBase,
    viTri: { findByIdOrThrow, assertReceivable },
  };
}

const row = (
  soLoId: string,
  viTriId: string,
  soLuong: number,
  id = 't0',
): Row => ({
  id,
  soLoId,
  viTriId,
  soLuong,
});

describe('TonKhoService', () => {
  describe('increase', () => {
    it('tạo dòng tồn mới và ghi một dòng sổ biến động cùng giao dịch', async () => {
      const { service, tx, ledger, quantity } = setup();
      const result = await service.increase(
        {
          soLoId: 'l1',
          viTriId: 'v1',
          soLuongCoBan: 10,
          loai: 'nhap_kho',
          thamChieu: { loai: 'phieu_nhap', id: 'p1' },
        },
        actor,
        tx as never,
      );
      expect(result.soLuong).toBe(10);
      expect(quantity('l1', 'v1')).toBe(10);
      expect(ledger).toEqual([
        expect.objectContaining({
          loai: 'nhap_kho',
          soLuongThayDoi: 10,
          soLuongSau: 10,
          loaiThamChieu: 'phieu_nhap',
          thamChieuId: 'p1',
          createdById: 'u1',
        }),
      ]);
    });

    it('cộng dồn vào dòng đã có', async () => {
      const { service, tx, ledger } = setup({ stock: [row('l1', 'v1', 5)] });
      const result = await service.increase(
        { soLoId: 'l1', viTriId: 'v1', soLuongCoBan: 7, loai: 'nhap_kho' },
        null,
        tx as never,
      );
      expect(result.soLuong).toBe(12);
      expect(ledger[0]).toMatchObject({
        soLuongThayDoi: 7,
        soLuongSau: 12,
        createdById: null,
      });
    });

    it.each([0, -1, 1.5, 2_147_483_648])(
      'số lượng %s không hợp lệ → VALIDATION_FAILED, không ghi gì',
      async (n) => {
        const { service, tx, ledger } = setup();
        await expect(
          service.increase(
            { soLoId: 'l1', viTriId: 'v1', soLuongCoBan: n, loai: 'nhap_kho' },
            actor,
            tx as never,
          ),
        ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
        expect(ledger).toHaveLength(0);
      },
    );

    it('lô không tồn tại → SO_LO_NOT_FOUND', async () => {
      const { service, tx } = setup();
      await expect(
        service.increase(
          {
            soLoId: 'missing',
            viTriId: 'v1',
            soLuongCoBan: 1,
            loai: 'nhap_kho',
          },
          actor,
          tx as never,
        ),
      ).rejects.toMatchObject({ code: 'SO_LO_NOT_FOUND' });
    });

    it('hàng giữ lạnh vào vị trí thường → TON_KHO_COLD_CHAIN_VIOLATION, vào vị trí cấp đông được', async () => {
      const { service, tx, ledger } = setup({
        cold: true,
        coldLocations: ['cold'],
      });
      await expect(
        service.increase(
          { soLoId: 'l1', viTriId: 'v1', soLuongCoBan: 1, loai: 'nhap_kho' },
          actor,
          tx as never,
        ),
      ).rejects.toMatchObject({ code: 'TON_KHO_COLD_CHAIN_VIOLATION' });
      expect(ledger).toHaveLength(0);
      await service.increase(
        { soLoId: 'l1', viTriId: 'cold', soLuongCoBan: 1, loai: 'nhap_kho' },
        actor,
        tx as never,
      );
      expect(ledger).toHaveLength(1);
    });

    it('hủy phiếu (boQuaKiemTraViTriHoatDong) không đòi vị trí đang hoạt động', async () => {
      const { service, tx, viTri } = setup();
      await service.increase(
        {
          soLoId: 'l1',
          viTriId: 'v1',
          soLuongCoBan: 1,
          loai: 'huy_xuat',
          boQuaKiemTraViTriHoatDong: true,
        },
        actor,
        tx as never,
      );
      expect(viTri.assertReceivable).not.toHaveBeenCalled();
      expect(viTri.findByIdOrThrow).toHaveBeenCalled();
    });
  });

  describe('decrease', () => {
    it('trừ tồn và ghi biến động âm', async () => {
      const { service, tx, ledger, quantity } = setup({
        stock: [row('l1', 'v1', 10)],
      });
      const result = await service.decrease(
        { soLoId: 'l1', viTriId: 'v1', soLuongCoBan: 4, loai: 'xuat_kho' },
        actor,
        tx as never,
      );
      expect(result.soLuong).toBe(6);
      expect(quantity('l1', 'v1')).toBe(6);
      expect(ledger[0]).toMatchObject({ soLuongThayDoi: -4, soLuongSau: 6 });
    });

    it('trừ hết về 0 được (dòng tồn vẫn giữ lại)', async () => {
      const { service, tx, quantity } = setup({ stock: [row('l1', 'v1', 3)] });
      await service.decrease(
        { soLoId: 'l1', viTriId: 'v1', soLuongCoBan: 3, loai: 'xuat_kho' },
        actor,
        tx as never,
      );
      expect(quantity('l1', 'v1')).toBe(0);
    });

    it('không đủ tồn → TON_KHO_INSUFFICIENT kèm số còn lại; không ghi biến động', async () => {
      const { service, tx, ledger, quantity } = setup({
        stock: [row('l1', 'v1', 3)],
      });
      const error = await service
        .decrease(
          { soLoId: 'l1', viTriId: 'v1', soLuongCoBan: 4, loai: 'xuat_kho' },
          actor,
          tx as never,
        )
        .catch((e: unknown) => e);
      expect(error).toMatchObject({
        code: 'TON_KHO_INSUFFICIENT',
        details: { conLai: 3, canLay: 4 },
      });
      expect(ledger).toHaveLength(0);
      expect(quantity('l1', 'v1')).toBe(3);
    });

    it('chưa có dòng tồn → còn lại 0', async () => {
      const { service, tx } = setup();
      await expect(
        service.decrease(
          { soLoId: 'l1', viTriId: 'v1', soLuongCoBan: 1, loai: 'xuat_kho' },
          actor,
          tx as never,
        ),
      ).rejects.toMatchObject({
        code: 'TON_KHO_INSUFFICIENT',
        details: { conLai: 0 },
      });
    });
  });

  describe('chuyenViTri', () => {
    const dto = { soLoId: 'l1', tuViTriId: 'a', denViTriId: 'b', soLuong: 4 };

    it('trừ nguồn, cộng đích, hai dòng biến động chung tham chiếu, ghi nhật ký', async () => {
      const { service, ledger, record, quantity } = setup({
        stock: [row('l1', 'a', 10)],
      });
      const result = await service.chuyenViTri(
        { ...dto, lyDo: 'xếp lại' },
        actor,
      );
      expect(quantity('l1', 'a')).toBe(6);
      expect(quantity('l1', 'b')).toBe(4);
      expect(result.tu).toBeDefined();
      expect(ledger.map((l) => l.loai)).toEqual(['chuyen_di', 'chuyen_den']);
      expect(ledger[0]!.thamChieuId).toBe(ledger[1]!.thamChieuId);
      expect(ledger[0]!.loaiThamChieu).toBe('chuyen_vi_tri');
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          hanhDong: 'ton_kho.transfer',
          lyDo: 'xếp lại',
        }),
        expect.anything(),
      );
    });

    it('đổi sang đơn vị cơ bản qua TyLeQuyDoiService', async () => {
      const { service, quantity, toBase } = setup({
        stock: [row('l1', 'a', 500)],
      });
      toBase.mockResolvedValueOnce(200);
      await service.chuyenViTri(
        { ...dto, soLuong: 2, donViTinh: 'hộp' },
        actor,
      );
      expect(toBase).toHaveBeenCalledWith('h1', 2, 'hộp', expect.anything());
      expect(quantity('l1', 'a')).toBe(300);
      expect(quantity('l1', 'b')).toBe(200);
    });

    it('cùng vị trí → TON_KHO_SAME_LOCATION, không mở giao dịch', async () => {
      const { service, tx } = setup();
      await expect(
        service.chuyenViTri({ ...dto, denViTriId: 'a' }, actor),
      ).rejects.toMatchObject({ code: 'TON_KHO_SAME_LOCATION' });
      expect(tx.soLo.findUnique).not.toHaveBeenCalled();
    });

    it('hàng lạnh sang vị trí thường → lỗi trước khi trừ nguồn', async () => {
      const { service, ledger, quantity } = setup({
        cold: true,
        stock: [row('l1', 'a', 10)],
        coldLocations: ['a'],
      });
      await expect(service.chuyenViTri(dto, actor)).rejects.toMatchObject({
        code: 'TON_KHO_COLD_CHAIN_VIOLATION',
      });
      expect(quantity('l1', 'a')).toBe(10);
      expect(ledger).toHaveLength(0);
    });

    it('nguồn không đủ → TON_KHO_INSUFFICIENT', async () => {
      const { service } = setup({ stock: [row('l1', 'a', 2)] });
      await expect(service.chuyenViTri(dto, actor)).rejects.toMatchObject({
        code: 'TON_KHO_INSUFFICIENT',
      });
    });
  });

  describe('dieuChinh', () => {
    const dto = { soLoId: 'l1', viTriId: 'a', soLuongMoi: 8, lyDo: 'kiểm kê' };

    it('giảm: ghi biến động âm và nhật ký trước/sau', async () => {
      const { service, ledger, record, quantity } = setup({
        stock: [row('l1', 'a', 10)],
      });
      await service.dieuChinh(dto, actor);
      expect(quantity('l1', 'a')).toBe(8);
      expect(ledger[0]).toMatchObject({
        loai: 'dieu_chinh',
        soLuongThayDoi: -2,
        soLuongSau: 8,
        lyDo: 'kiểm kê',
      });
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          hanhDong: 'ton_kho.adjust',
          truoc: { soLuong: 10 },
          sau: { soLuong: 8 },
        }),
        expect.anything(),
      );
    });

    it('tăng trên dòng chưa có → tạo dòng mới, đòi vị trí đang hoạt động', async () => {
      const { service, ledger, quantity, viTri } = setup();
      await service.dieuChinh({ ...dto, soLuongMoi: 5 }, actor);
      expect(quantity('l1', 'a')).toBe(5);
      expect(ledger[0]).toMatchObject({ soLuongThayDoi: 5 });
      expect(viTri.assertReceivable).toHaveBeenCalled();
    });

    it('giảm không đòi vị trí đang hoạt động (kiểm kê vị trí đã khóa)', async () => {
      const { service, viTri } = setup({ stock: [row('l1', 'a', 10)] });
      await service.dieuChinh(dto, actor);
      expect(viTri.assertReceivable).not.toHaveBeenCalled();
    });

    it('số đếm bằng tồn hiện tại (kể cả 0 trên dòng chưa có) → TON_KHO_ADJUST_NO_CHANGE', async () => {
      const a = setup({ stock: [row('l1', 'a', 8)] });
      await expect(a.service.dieuChinh(dto, actor)).rejects.toMatchObject({
        code: 'TON_KHO_ADJUST_NO_CHANGE',
      });
      const b = setup();
      await expect(
        b.service.dieuChinh({ ...dto, soLuongMoi: 0 }, actor),
      ).rejects.toMatchObject({
        code: 'TON_KHO_ADJUST_NO_CHANGE',
      });
      expect(a.ledger).toHaveLength(0);
    });

    it('dòng bị người khác đổi giữa lúc đọc và ghi → COMMON_CONCURRENT_UPDATE', async () => {
      const { service, tx, ledger } = setup({ stock: [row('l1', 'a', 10)] });
      tx.tonKho.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(service.dieuChinh(dto, actor)).rejects.toMatchObject({
        code: 'COMMON_CONCURRENT_UPDATE',
      });
      expect(ledger).toHaveLength(0);
    });

    it('hai người cùng tạo dòng mới (P2002) → COMMON_CONCURRENT_UPDATE', async () => {
      const { service, tx } = setup();
      tx.tonKho.create.mockRejectedValueOnce({ code: 'P2002' });
      await expect(service.dieuChinh(dto, actor)).rejects.toMatchObject({
        code: 'COMMON_CONCURRENT_UPDATE',
      });
    });

    it('lỗi tạo khác P2002 được ném lại nguyên vẹn', async () => {
      const { service, tx } = setup();
      const boom = new Error('db down');
      tx.tonKho.create.mockRejectedValueOnce(boom);
      await expect(service.dieuChinh(dto, actor)).rejects.toBe(boom);
    });
  });

  describe('getQuantity', () => {
    it('trả 0 khi chưa có dòng', async () => {
      const { service, tx } = setup({ stock: [row('l1', 'a', 3)] });
      await expect(service.getQuantity('l1', 'a', tx as never)).resolves.toBe(
        3,
      );
      await expect(service.getQuantity('l1', 'zz', tx as never)).resolves.toBe(
        0,
      );
    });
  });
});
