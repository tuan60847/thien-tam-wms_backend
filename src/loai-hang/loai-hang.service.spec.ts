import type { LoaiHang } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service.js';
import { LoaiHangService } from './loai-hang.service.js';

const NOW = new Date('2026-10-01T00:00:00Z');
const make = (
  id: string,
  tenLoaiHang: string,
  over: Partial<LoaiHang> = {},
): LoaiHang => ({
  id,
  tenLoaiHang,
  ghiChu: null,
  trangThai: true,
  createdAt: NOW,
  updatedAt: NOW,
  ...over,
});

function setup(
  seed: LoaiHang[],
  productsPerCategory: Record<string, number> = {},
) {
  const store = new Map(seed.map((c) => [c.id, { ...c }]));
  let seq = 0;
  const count = (id: string) => productsPerCategory[id] ?? 0;
  const withCount = (c: LoaiHang) => ({
    ...c,
    _count: { hangHoas: count(c.id) },
  });
  // Mimics the case-insensitive collation of the unique column.
  const byName = (name: string) =>
    [...store.values()].find(
      (c) => c.tenLoaiHang.toLowerCase() === name.toLowerCase(),
    ) ?? null;

  const loaiHang = {
    findUnique: vi.fn(
      async ({ where }: { where: { id?: string; tenLoaiHang?: string } }) => {
        const row = where.id
          ? (store.get(where.id) ?? null)
          : byName(where.tenLoaiHang!);
        return row ? withCount(row) : null;
      },
    ),
    findMany: vi.fn(async () => [...store.values()].map(withCount)),
    count: vi.fn(async () => store.size),
    create: vi.fn(async ({ data }: { data: Partial<LoaiHang> }) => {
      const row = make(`new${++seq}`, data.tenLoaiHang!, {
        ghiChu: data.ghiChu ?? null,
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
        data: Partial<LoaiHang>;
      }) => {
        const next = { ...store.get(where.id)! } as Record<string, unknown>;
        for (const [k, v] of Object.entries(data))
          if (v !== undefined) next[k] = v;
        store.set(where.id, next as unknown as LoaiHang);
        return withCount(next as unknown as LoaiHang);
      },
    ),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      store.delete(where.id);
    }),
  };
  const prisma = {
    loaiHang,
    $transaction: vi.fn(
      async (fn: (tx: { loaiHang: typeof loaiHang }) => Promise<unknown>) =>
        fn({ loaiHang }),
    ),
  } as unknown as PrismaService;
  return { service: new LoaiHangService(prisma), loaiHang, store };
}

describe('LoaiHangService', () => {
  describe('create', () => {
    it('tạo loại hàng mới với soHangHoa = 0', async () => {
      const { service } = setup([]);
      await expect(
        service.create({ tenLoaiHang: 'Kháng sinh' }),
      ).resolves.toMatchObject({
        tenLoaiHang: 'Kháng sinh',
        ghiChu: null,
        trangThai: true,
        soHangHoa: 0,
      });
    });

    it('tên trùng khác hoa/thường → LOAI_HANG_NAME_TAKEN, không tạo', async () => {
      const { service, loaiHang } = setup([make('a', 'Kháng sinh')]);
      await expect(
        service.create({ tenLoaiHang: 'KHÁNG SINH' }),
      ).rejects.toMatchObject({
        code: 'LOAI_HANG_NAME_TAKEN',
      });
      expect(loaiHang.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll / findOne', () => {
    it('findAll trả soHangHoa từng loại và meta', async () => {
      const { service } = setup([make('a', 'A'), make('b', 'B')], { a: 3 });
      const result = await service.findAll({ page: 1, pageSize: 20 });
      expect(result.items.map((i) => [i.tenLoaiHang, i.soHangHoa])).toEqual([
        ['A', 3],
        ['B', 0],
      ]);
      expect(result.meta.total).toBe(2);
    });

    it('findAll từ chối sort ngoài whitelist', () => {
      const { service } = setup([]);
      expect(() =>
        service.findAll({ page: 1, pageSize: 20, sort: 'ghiChu:asc' }),
      ).toThrow(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
    });

    it('findOne không tồn tại → LOAI_HANG_NOT_FOUND', async () => {
      const { service } = setup([]);
      await expect(service.findOne('x')).rejects.toMatchObject({
        code: 'LOAI_HANG_NOT_FOUND',
      });
    });
  });

  describe('update', () => {
    it('đổi tên, ghi chú; ghiChu = null xóa ghi chú', async () => {
      const { service } = setup([make('a', 'A', { ghiChu: 'cũ' })]);
      await expect(
        service.update('a', { tenLoaiHang: 'A2', ghiChu: null }),
      ).resolves.toMatchObject({
        tenLoaiHang: 'A2',
        ghiChu: null,
      });
    });

    it('đổi sang tên của loại khác → LOAI_HANG_NAME_TAKEN', async () => {
      const { service } = setup([make('a', 'A'), make('b', 'B')]);
      await expect(
        service.update('a', { tenLoaiHang: 'b' }),
      ).rejects.toMatchObject({
        code: 'LOAI_HANG_NAME_TAKEN',
      });
    });

    it('giữ nguyên tên của chính mình (chỉ đổi hoa/thường) → được', async () => {
      const { service } = setup([make('a', 'kháng sinh')]);
      await expect(
        service.update('a', { tenLoaiHang: 'Kháng sinh' }),
      ).resolves.toMatchObject({
        tenLoaiHang: 'Kháng sinh',
      });
    });

    it('ngừng sử dụng → trangThai = false; bật lại được', async () => {
      const { service } = setup([make('a', 'A')]);
      await expect(
        service.update('a', { trangThai: false }),
      ).resolves.toMatchObject({ trangThai: false });
      await expect(
        service.update('a', { trangThai: true }),
      ).resolves.toMatchObject({ trangThai: true });
    });

    it('không tồn tại → LOAI_HANG_NOT_FOUND', async () => {
      const { service } = setup([]);
      await expect(
        service.update('x', { trangThai: false }),
      ).rejects.toMatchObject({
        code: 'LOAI_HANG_NOT_FOUND',
      });
    });
  });

  describe('remove', () => {
    it('chưa có hàng hóa → xóa', async () => {
      const { service, store } = setup([make('a', 'A')]);
      await service.remove('a');
      expect(store.has('a')).toBe(false);
    });

    it('còn hàng hóa → LOAI_HANG_IN_USE kèm số lượng, không xóa', async () => {
      const { service, loaiHang } = setup([make('a', 'A')], { a: 2 });
      await expect(service.remove('a')).rejects.toMatchObject({
        code: 'LOAI_HANG_IN_USE',
        details: { soHangHoa: 2 },
      });
      expect(loaiHang.delete).not.toHaveBeenCalled();
    });

    it('không tồn tại → LOAI_HANG_NOT_FOUND', async () => {
      const { service } = setup([]);
      await expect(service.remove('x')).rejects.toMatchObject({
        code: 'LOAI_HANG_NOT_FOUND',
      });
    });
  });

  describe('assertUsable', () => {
    it('loại đang hoạt động → trả bản ghi', async () => {
      const { service } = setup([make('a', 'A')]);
      await expect(service.assertUsable('a')).resolves.toMatchObject({
        id: 'a',
      });
    });

    it('loại bị tắt hoặc không tồn tại → LOAI_HANG_NOT_FOUND', async () => {
      const { service } = setup([make('a', 'A', { trangThai: false })]);
      await expect(service.assertUsable('a')).rejects.toMatchObject({
        code: 'LOAI_HANG_NOT_FOUND',
      });
      await expect(service.assertUsable('zzz')).rejects.toMatchObject({
        code: 'LOAI_HANG_NOT_FOUND',
      });
    });
  });
});
