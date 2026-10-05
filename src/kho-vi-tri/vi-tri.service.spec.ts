import type { Kho, ViTri } from '@prisma/client';
import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ViTriService } from './vi-tri.service.js';

const NOW = new Date('2026-10-01T00:00:00Z');
const KHO: Kho = {
  id: 'k1',
  tenKho: 'Kho chính',
  diaChi: null,
  trangThai: true,
  createdAt: NOW,
  updatedAt: NOW,
};
const OFF_KHO: Kho = {
  ...KHO,
  id: 'k-off',
  tenKho: 'Kho đóng',
  trangThai: false,
};
const vt = (
  id: string,
  tenViTri: string,
  over: Partial<ViTri> = {},
): ViTri => ({
  id,
  tenViTri,
  isCapDong: false,
  ghiChu: null,
  trangThai: true,
  khoId: 'k1',
  createdAt: NOW,
  updatedAt: NOW,
  ...over,
});

interface StockSetup {
  stock?: string[]; // location ids holding stock > 0
  coldStock?: string[]; // location ids holding stock of products that must stay cold
  everUsed?: string[]; // location ids that ever had a TonKho row
}

function setup(
  seed: ViTri[],
  stockSetup: StockSetup = {},
  khos: Kho[] = [KHO, OFF_KHO],
) {
  const store = new Map(seed.map((v) => [v.id, { ...v }]));
  const khoById = new Map(khos.map((k) => [k.id, k]));
  let seq = 0;
  const withKho = (v: ViTri) => {
    const k = khoById.get(v.khoId)!;
    return {
      ...v,
      kho: { id: k.id, tenKho: k.tenKho, trangThai: k.trangThai },
    };
  };

  const viTri = {
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: {
          id?: string;
          khoId_tenViTri?: { khoId: string; tenViTri: string };
        };
      }) => {
        if (where.id) {
          const row = store.get(where.id);
          return row ? withKho(row) : null;
        }
        const key = where.khoId_tenViTri!;
        const row = [...store.values()].find(
          (v) =>
            v.khoId === key.khoId &&
            v.tenViTri.toLowerCase() === key.tenViTri.toLowerCase(),
        );
        return row ? withKho(row) : null;
      },
    ),
    findMany: vi.fn(async () => [...store.values()].map(withKho)),
    count: vi.fn(async () => store.size),
    create: vi.fn(async ({ data }: { data: Partial<ViTri> }) => {
      const row = vt(`new${++seq}`, data.tenViTri!, {
        khoId: data.khoId!,
        isCapDong: data.isCapDong ?? false,
        ghiChu: data.ghiChu ?? null,
      });
      store.set(row.id, row);
      return withKho(row);
    }),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<ViTri>;
      }) => {
        const next = { ...store.get(where.id)! } as Record<string, unknown>;
        for (const [k, v] of Object.entries(data))
          if (v !== undefined) next[k] = v;
        store.set(where.id, next as unknown as ViTri);
        return withKho(next as unknown as ViTri);
      },
    ),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      store.delete(where.id);
    }),
  };
  const tonKho = {
    count: vi.fn(
      async ({
        where,
      }: {
        where: { viTriId: string; soLuong?: unknown; soLo?: unknown };
      }) => {
        if (where.soLo)
          return stockSetup.coldStock?.includes(where.viTriId) ? 1 : 0;
        if (where.soLuong)
          return stockSetup.stock?.includes(where.viTriId) ? 1 : 0;
        return stockSetup.everUsed?.includes(where.viTriId) ? 1 : 0;
      },
    ),
    findMany: vi.fn(
      async ({ where }: { where: { viTriId: { in: string[] } } }) =>
        where.viTriId.in
          .filter((id) => stockSetup.stock?.includes(id))
          .map((viTriId) => ({ viTriId })),
    ),
  };
  const kho = {
    findUnique: vi.fn(
      async ({ where }: { where: { id: string } }) =>
        khoById.get(where.id) ?? null,
    ),
  };
  const client = { viTri, tonKho, kho };
  const prisma = {
    ...client,
    $transaction: vi.fn(async (fn: (tx: typeof client) => Promise<unknown>) =>
      fn(client),
    ),
  } as unknown as PrismaService;
  const record = vi.fn().mockResolvedValue({});
  return {
    service: new ViTriService(prisma, { record } as unknown as AuditService),
    store,
    viTri,
    record,
  };
}

describe('ViTriService', () => {
  describe('create', () => {
    it('tạo vị trí trong kho đang hoạt động', async () => {
      const { service } = setup([]);
      await expect(
        service.create({
          khoId: 'k1',
          tenViTri: 'A-01',
          isCapDong: true,
          ghiChu: 'Phòng lạnh',
        }),
      ).resolves.toMatchObject({
        tenViTri: 'A-01',
        isCapDong: true,
        ghiChu: 'Phòng lạnh',
        kho: { id: 'k1', tenKho: 'Kho chính' },
        coTon: false,
      });
    });

    it('isCapDong mặc định false', async () => {
      const { service } = setup([]);
      await expect(
        service.create({ khoId: 'k1', tenViTri: 'A-02' }),
      ).resolves.toMatchObject({ isCapDong: false });
    });

    it('kho không tồn tại → KHO_NOT_FOUND; kho bị vô hiệu hóa → VI_TRI_INACTIVE', async () => {
      const { service } = setup([]);
      await expect(
        service.create({ khoId: 'khong-co', tenViTri: 'A' }),
      ).rejects.toMatchObject({ code: 'KHO_NOT_FOUND' });
      await expect(
        service.create({ khoId: 'k-off', tenViTri: 'A' }),
      ).rejects.toMatchObject({ code: 'VI_TRI_INACTIVE' });
    });

    it('trùng tên trong cùng kho (khác hoa/thường) → VI_TRI_NAME_TAKEN; cùng tên ở kho khác → được', async () => {
      const other: Kho = { ...KHO, id: 'k2', tenKho: 'Kho phụ' };
      const { service } = setup([vt('v1', 'A-01')], {}, [KHO, OFF_KHO, other]);
      await expect(
        service.create({ khoId: 'k1', tenViTri: 'a-01' }),
      ).rejects.toMatchObject({ code: 'VI_TRI_NAME_TAKEN' });
      await expect(
        service.create({ khoId: 'k2', tenViTri: 'A-01' }),
      ).resolves.toBeDefined();
    });
  });

  describe('findAll / findOne', () => {
    it('coTon chỉ đúng với vị trí có tồn > 0', async () => {
      const { service } = setup([vt('v1', 'A'), vt('v2', 'B')], {
        stock: ['v1'],
      });
      const result = await service.findAll({ page: 1, pageSize: 20 });
      expect(result.items.map((v) => [v.tenViTri, v.coTon])).toEqual([
        ['A', true],
        ['B', false],
      ]);
    });

    it('findOne không tồn tại → VI_TRI_NOT_FOUND', async () => {
      const { service } = setup([]);
      await expect(service.findOne('x')).rejects.toMatchObject({
        code: 'VI_TRI_NOT_FOUND',
      });
    });
  });

  describe('update', () => {
    it('đổi tên, ghi chú → được; không ghi nhật ký', async () => {
      const { service, record } = setup([vt('v1', 'A')]);
      await expect(
        service.update('v1', { tenViTri: 'A2', ghiChu: 'x' }),
      ).resolves.toMatchObject({
        tenViTri: 'A2',
        ghiChu: 'x',
      });
      expect(record).not.toHaveBeenCalled();
    });

    it('đổi tên trùng vị trí khác trong cùng kho → VI_TRI_NAME_TAKEN', async () => {
      const { service } = setup([vt('v1', 'A'), vt('v2', 'B')]);
      await expect(
        service.update('v1', { tenViTri: 'b' }),
      ).rejects.toMatchObject({ code: 'VI_TRI_NAME_TAKEN' });
    });

    it('bật cờ cấp đông (false → true) luôn được và ghi nhật ký', async () => {
      const { service, record } = setup([vt('v1', 'A')], { coldStock: [] });
      await expect(
        service.update('v1', { isCapDong: true }),
      ).resolves.toMatchObject({ isCapDong: true });
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          hanhDong: 'vi_tri.update',
          truoc: { isCapDong: false, trangThai: true },
          sau: { isCapDong: true, trangThai: true },
        }),
        expect.anything(),
      );
    });

    it('bỏ cờ cấp đông khi đang chứa hàng cần giữ lạnh → VI_TRI_COLD_CONFLICT', async () => {
      const { service, viTri } = setup([vt('v1', 'A', { isCapDong: true })], {
        coldStock: ['v1'],
      });
      await expect(
        service.update('v1', { isCapDong: false }),
      ).rejects.toMatchObject({ code: 'VI_TRI_COLD_CONFLICT' });
      expect(viTri.update).not.toHaveBeenCalled();
    });

    it('bỏ cờ cấp đông khi chỉ có hàng thường → được', async () => {
      const { service } = setup([vt('v1', 'A', { isCapDong: true })], {
        stock: ['v1'],
        coldStock: [],
      });
      await expect(
        service.update('v1', { isCapDong: false }),
      ).resolves.toMatchObject({ isCapDong: false });
    });

    it('vô hiệu hóa khi còn tồn → VI_TRI_HAS_STOCK; hết tồn → được và ghi nhật ký', async () => {
      const blocked = setup([vt('v1', 'A')], { stock: ['v1'] });
      await expect(
        blocked.service.update('v1', { trangThai: false }),
      ).rejects.toMatchObject({ code: 'VI_TRI_HAS_STOCK' });

      const free = setup([vt('v1', 'A')]);
      await expect(
        free.service.update('v1', { trangThai: false }),
      ).resolves.toMatchObject({ trangThai: false });
      expect(free.record).toHaveBeenCalledOnce();
    });

    it('bật lại vị trí đã ngừng → được', async () => {
      const { service } = setup([vt('v1', 'A', { trangThai: false })]);
      await expect(
        service.update('v1', { trangThai: true }),
      ).resolves.toMatchObject({ trangThai: true });
    });

    it('không tồn tại → VI_TRI_NOT_FOUND', async () => {
      const { service } = setup([]);
      await expect(
        service.update('x', { tenViTri: 'A' }),
      ).rejects.toMatchObject({ code: 'VI_TRI_NOT_FOUND' });
    });
  });

  describe('remove', () => {
    it('chưa từng có dòng tồn → xóa', async () => {
      const { service, store } = setup([vt('v1', 'A')]);
      await service.remove('v1');
      expect(store.has('v1')).toBe(false);
    });

    it('đã từng có dòng tồn (kể cả tồn 0) → VI_TRI_IN_USE', async () => {
      const { service, viTri } = setup([vt('v1', 'A')], { everUsed: ['v1'] });
      await expect(service.remove('v1')).rejects.toMatchObject({
        code: 'VI_TRI_IN_USE',
      });
      expect(viTri.delete).not.toHaveBeenCalled();
    });

    it('không tồn tại → VI_TRI_NOT_FOUND', async () => {
      const { service } = setup([]);
      await expect(service.remove('x')).rejects.toMatchObject({
        code: 'VI_TRI_NOT_FOUND',
      });
    });
  });

  describe('assertReceivable', () => {
    it('vị trí và kho đều hoạt động → trả vị trí kèm kho', async () => {
      const { service } = setup([vt('v1', 'A')]);
      await expect(service.assertReceivable('v1')).resolves.toMatchObject({
        id: 'v1',
        kho: { id: 'k1' },
      });
    });

    it('vị trí ngừng, hoặc kho ngừng → VI_TRI_INACTIVE; không có → VI_TRI_NOT_FOUND', async () => {
      const { service } = setup([
        vt('off', 'A', { trangThai: false }),
        vt('in-off-kho', 'B', { khoId: 'k-off' }),
      ]);
      await expect(service.assertReceivable('off')).rejects.toMatchObject({
        code: 'VI_TRI_INACTIVE',
      });
      await expect(
        service.assertReceivable('in-off-kho'),
      ).rejects.toMatchObject({ code: 'VI_TRI_INACTIVE' });
      await expect(service.assertReceivable('khong-co')).rejects.toMatchObject({
        code: 'VI_TRI_NOT_FOUND',
      });
    });
  });
});
