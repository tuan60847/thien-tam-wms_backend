import type { Kho } from '@prisma/client';
import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { KhoService } from './kho.service.js';

const NOW = new Date('2026-10-01T00:00:00Z');
const kho = (id: string, tenKho: string, over: Partial<Kho> = {}): Kho => ({
  id,
  tenKho,
  diaChi: null,
  trangThai: true,
  createdAt: NOW,
  updatedAt: NOW,
  ...over,
});

function setup(
  seed: Kho[],
  options: { locations?: Record<string, number>; stocked?: string[] } = {},
) {
  const store = new Map(seed.map((k) => [k.id, { ...k }]));
  let seq = 0;
  const stocked = new Set(options.stocked ?? []);
  const withCount = (k: Kho) => ({
    ...k,
    _count: { viTris: options.locations?.[k.id] ?? 0 },
  });
  const byName = (name: string) =>
    [...store.values()].find(
      (k) => k.tenKho.toLowerCase() === name.toLowerCase(),
    ) ?? null;

  const khoClient = {
    findUnique: vi.fn(
      async ({ where }: { where: { id?: string; tenKho?: string } }) => {
        const row = where.id
          ? (store.get(where.id) ?? null)
          : byName(where.tenKho!);
        return row ? withCount(row) : null;
      },
    ),
    findMany: vi.fn(async () => [...store.values()].map(withCount)),
    count: vi.fn(async () => store.size),
    create: vi.fn(async ({ data }: { data: Partial<Kho> }) => {
      const row = kho(`new${++seq}`, data.tenKho!, {
        diaChi: data.diaChi ?? null,
      });
      store.set(row.id, row);
      return withCount(row);
    }),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<Kho>;
      }) => {
        const next = { ...store.get(where.id)! } as Record<string, unknown>;
        for (const [k, v] of Object.entries(data))
          if (v !== undefined) next[k] = v;
        store.set(where.id, next as unknown as Kho);
        return withCount(next as unknown as Kho);
      },
    ),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      store.delete(where.id);
    }),
  };
  const tonKho = {
    count: vi.fn(async ({ where }: { where: { viTri: { khoId: string } } }) =>
      stocked.has(where.viTri.khoId) ? 1 : 0,
    ),
  };
  const viTri = {
    findMany: vi.fn(async ({ where }: { where: { khoId: { in: string[] } } }) =>
      where.khoId.in
        .filter((id) => stocked.has(id))
        .map((khoId) => ({ khoId })),
    ),
  };
  const client = { kho: khoClient, tonKho, viTri };
  const prisma = {
    ...client,
    $transaction: vi.fn(async (fn: (tx: typeof client) => Promise<unknown>) =>
      fn(client),
    ),
  } as unknown as PrismaService;
  const record = vi.fn().mockResolvedValue({});
  const audit = { record } as unknown as AuditService;
  return { service: new KhoService(prisma, audit), store, khoClient, record };
}

describe('KhoService', () => {
  describe('create', () => {
    it('tạo kho mới: không có vị trí, không có tồn', async () => {
      const { service } = setup([]);
      await expect(
        service.create({ tenKho: 'Kho chính', diaChi: '12 Lê Lợi' }),
      ).resolves.toMatchObject({
        tenKho: 'Kho chính',
        diaChi: '12 Lê Lợi',
        trangThai: true,
        soViTri: 0,
        coTon: false,
      });
    });

    it('tên trùng khác hoa/thường → KHO_NAME_TAKEN, không tạo', async () => {
      const { service, khoClient } = setup([kho('a', 'Kho chính')]);
      await expect(
        service.create({ tenKho: 'KHO CHÍNH' }),
      ).rejects.toMatchObject({ code: 'KHO_NAME_TAKEN' });
      expect(khoClient.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll / findOne', () => {
    it('trả soViTri và coTon theo từng kho', async () => {
      const { service } = setup([kho('a', 'A'), kho('b', 'B')], {
        locations: { a: 3 },
        stocked: ['a'],
      });
      const result = await service.findAll({ page: 1, pageSize: 20 });
      expect(result.items.map((k) => [k.tenKho, k.soViTri, k.coTon])).toEqual([
        ['A', 3, true],
        ['B', 0, false],
      ]);
    });

    it('danh sách rỗng không gọi truy vấn tồn', async () => {
      const { service } = setup([]);
      await expect(
        service.findAll({ page: 1, pageSize: 20 }),
      ).resolves.toMatchObject({
        items: [],
        meta: { total: 0, totalPages: 0 },
      });
    });

    it('sort ngoài whitelist → VALIDATION_FAILED; findOne không có → KHO_NOT_FOUND', async () => {
      const { service } = setup([]);
      await expect(
        service.findAll({ page: 1, pageSize: 20, sort: 'diaChi:asc' }),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
      await expect(service.findOne('x')).rejects.toMatchObject({
        code: 'KHO_NOT_FOUND',
      });
    });
  });

  describe('update', () => {
    it('đổi tên/địa chỉ; giữ nguyên tên của chính mình (đổi hoa/thường) được', async () => {
      const { service } = setup([kho('a', 'kho chính')]);
      await expect(
        service.update('a', { tenKho: 'Kho Chính', diaChi: 'Mới' }),
      ).resolves.toMatchObject({
        tenKho: 'Kho Chính',
        diaChi: 'Mới',
      });
    });

    it('đổi sang tên của kho khác → KHO_NAME_TAKEN', async () => {
      const { service } = setup([kho('a', 'A'), kho('b', 'B')]);
      await expect(service.update('a', { tenKho: 'b' })).rejects.toMatchObject({
        code: 'KHO_NAME_TAKEN',
      });
    });

    it('vô hiệu hóa kho không có tồn → thành công và ghi nhật ký trạng thái', async () => {
      const { service, record } = setup([kho('a', 'A')]);
      await expect(
        service.update('a', { trangThai: false }),
      ).resolves.toMatchObject({ trangThai: false });
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          hanhDong: 'kho.status_change',
          truoc: { trangThai: true },
          sau: { trangThai: false },
        }),
        expect.anything(),
      );
    });

    it('vô hiệu hóa kho còn tồn → KHO_IN_USE, không ghi gì', async () => {
      const { service, khoClient, record } = setup([kho('a', 'A')], {
        stocked: ['a'],
      });
      await expect(
        service.update('a', { trangThai: false }),
      ).rejects.toMatchObject({ code: 'KHO_IN_USE' });
      expect(khoClient.update).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
    });

    it('bật lại kho đã tắt; đổi tên không ghi nhật ký', async () => {
      const { service, record } = setup([kho('a', 'A', { trangThai: false })]);
      await service.update('a', { trangThai: true });
      expect(record).toHaveBeenCalledOnce();
      record.mockClear();
      await service.update('a', { tenKho: 'A2' });
      expect(record).not.toHaveBeenCalled();
    });

    it('kho không tồn tại → KHO_NOT_FOUND', async () => {
      const { service } = setup([]);
      await expect(service.update('x', { tenKho: 'A' })).rejects.toMatchObject({
        code: 'KHO_NOT_FOUND',
      });
    });
  });

  describe('remove', () => {
    it('kho rỗng → xóa', async () => {
      const { service, store } = setup([kho('a', 'A')]);
      await service.remove('a');
      expect(store.has('a')).toBe(false);
    });

    it('kho còn vị trí → KHO_HAS_VI_TRI kèm số vị trí, không xóa', async () => {
      const { service, khoClient } = setup([kho('a', 'A')], {
        locations: { a: 2 },
      });
      await expect(service.remove('a')).rejects.toMatchObject({
        code: 'KHO_HAS_VI_TRI',
        details: { soViTri: 2 },
      });
      expect(khoClient.delete).not.toHaveBeenCalled();
    });

    it('kho không tồn tại → KHO_NOT_FOUND', async () => {
      const { service } = setup([]);
      await expect(service.remove('x')).rejects.toMatchObject({
        code: 'KHO_NOT_FOUND',
      });
    });
  });
});
