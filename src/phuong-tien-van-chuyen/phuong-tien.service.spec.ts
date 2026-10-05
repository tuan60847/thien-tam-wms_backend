import type { PhuongTienVanChuyen } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PhuongTienService } from './phuong-tien.service.js';

const NOW = new Date('2026-10-01T00:00:00Z');
const xe = (
  id: string,
  bienSo: string,
  over: Partial<PhuongTienVanChuyen> = {},
): PhuongTienVanChuyen => ({
  id,
  bienSo,
  loaiPhuongTien: null,
  isXeLanh: false,
  trangThai: true,
  createdAt: NOW,
  updatedAt: NOW,
  ...over,
});

function setup(
  seed: PhuongTienVanChuyen[],
  receiptsByVehicle: Record<string, number> = {},
) {
  const store = new Map(seed.map((x) => [x.id, { ...x }]));
  let seq = 0;
  const phuongTienVanChuyen = {
    findUnique: vi.fn(
      async ({ where }: { where: { id?: string; bienSo?: string } }) => {
        if (where.id) return store.get(where.id) ?? null;
        return (
          [...store.values()].find((x) => x.bienSo === where.bienSo) ?? null
        );
      },
    ),
    findMany: vi.fn(async () => [...store.values()]),
    count: vi.fn(async () => store.size),
    create: vi.fn(async ({ data }: { data: Partial<PhuongTienVanChuyen> }) => {
      const row = xe(`n${++seq}`, data.bienSo!, data);
      store.set(row.id, row);
      return row;
    }),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<PhuongTienVanChuyen>;
      }) => {
        const next = { ...store.get(where.id)! } as Record<string, unknown>;
        for (const [k, v] of Object.entries(data))
          if (v !== undefined) next[k] = v;
        store.set(where.id, next as unknown as PhuongTienVanChuyen);
        return next as unknown as PhuongTienVanChuyen;
      },
    ),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      store.delete(where.id);
    }),
  };
  const phieuNhapHang = {
    count: vi.fn(
      async ({ where }: { where: { phuongTienVanChuyenId: string } }) =>
        receiptsByVehicle[where.phuongTienVanChuyenId] ?? 0,
    ),
  };
  const client = { phuongTienVanChuyen, phieuNhapHang };
  const prisma = {
    ...client,
    $transaction: vi.fn(async (fn: (tx: typeof client) => Promise<unknown>) =>
      fn(client),
    ),
  } as unknown as PrismaService;
  return { service: new PhuongTienService(prisma), store, phuongTienVanChuyen };
}

describe('PhuongTienService', () => {
  describe('create', () => {
    it('lưu biển số đã chuẩn hóa (DTO), isXeLanh mặc định false', async () => {
      const { service } = setup([]);
      await expect(
        service.create({ bienSo: '51C12345' }),
      ).resolves.toMatchObject({
        bienSo: '51C12345',
        isXeLanh: false,
        trangThai: true,
        loaiPhuongTien: null,
      });
    });

    it('xe lạnh kèm loại xe', async () => {
      const { service } = setup([]);
      await expect(
        service.create({
          bienSo: '51D99999',
          loaiPhuongTien: 'Xe tải lạnh',
          isXeLanh: true,
        }),
      ).resolves.toMatchObject({
        isXeLanh: true,
        loaiPhuongTien: 'Xe tải lạnh',
      });
    });

    it('biển số trùng → PHUONG_TIEN_PLATE_TAKEN, không tạo', async () => {
      const { service, phuongTienVanChuyen } = setup([xe('a', '51C12345')]);
      await expect(
        service.create({ bienSo: '51C12345' }),
      ).rejects.toMatchObject({
        code: 'PHUONG_TIEN_PLATE_TAKEN',
      });
      expect(phuongTienVanChuyen.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll / findOne', () => {
    it('findOne không có → PHUONG_TIEN_NOT_FOUND', async () => {
      const { service } = setup([]);
      await expect(service.findOne('x')).rejects.toMatchObject({
        code: 'PHUONG_TIEN_NOT_FOUND',
      });
    });

    it('findAll trả danh sách có meta', async () => {
      const { service } = setup([xe('a', '51C12345'), xe('b', '29A11111')]);
      const result = await service.findAll({ page: 1, pageSize: 20 });
      expect(result.items).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('sort ngoài whitelist → VALIDATION_FAILED', () => {
      const { service } = setup([]);
      expect(() =>
        service.findAll({ page: 1, pageSize: 20, sort: 'loaiPhuongTien:asc' }),
      ).toThrow(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
    });
  });

  describe('update', () => {
    it('bật cờ xe lạnh, tắt trạng thái', async () => {
      const { service } = setup([xe('a', '51C12345')]);
      await expect(
        service.update('a', { isXeLanh: true, trangThai: false }),
      ).resolves.toMatchObject({
        isXeLanh: true,
        trangThai: false,
      });
    });

    it('đổi biển số sang biển của xe khác → PHUONG_TIEN_PLATE_TAKEN; giữ biển của mình → được', async () => {
      const { service } = setup([xe('a', '51C12345'), xe('b', '29A11111')]);
      await expect(
        service.update('a', { bienSo: '29A11111' }),
      ).rejects.toMatchObject({
        code: 'PHUONG_TIEN_PLATE_TAKEN',
      });
      await expect(
        service.update('a', { bienSo: '51C12345' }),
      ).resolves.toBeDefined();
    });

    it('không tồn tại → PHUONG_TIEN_NOT_FOUND', async () => {
      const { service } = setup([]);
      await expect(
        service.update('x', { isXeLanh: true }),
      ).rejects.toMatchObject({
        code: 'PHUONG_TIEN_NOT_FOUND',
      });
    });
  });

  describe('remove', () => {
    it('chưa gắn phiếu → xóa', async () => {
      const { service, store } = setup([xe('a', '51C12345')]);
      await service.remove('a');
      expect(store.has('a')).toBe(false);
    });

    it('đã gắn phiếu nhập → PHUONG_TIEN_IN_USE', async () => {
      const { service, phuongTienVanChuyen } = setup([xe('a', '51C12345')], {
        a: 2,
      });
      await expect(service.remove('a')).rejects.toMatchObject({
        code: 'PHUONG_TIEN_IN_USE',
      });
      expect(phuongTienVanChuyen.delete).not.toHaveBeenCalled();
    });

    it('không tồn tại → PHUONG_TIEN_NOT_FOUND', async () => {
      const { service } = setup([]);
      await expect(service.remove('x')).rejects.toMatchObject({
        code: 'PHUONG_TIEN_NOT_FOUND',
      });
    });
  });

  describe('assertUsable', () => {
    it('xe thường chở hàng thường → được', async () => {
      const { service } = setup([xe('a', '51C12345')]);
      await expect(
        service.assertUsable('a', { requireCold: false }),
      ).resolves.toMatchObject({ id: 'a' });
    });

    it('xe thường chở hàng lạnh → PHUONG_TIEN_NOT_COLD; xe lạnh → được', async () => {
      const { service } = setup([
        xe('a', '51C12345'),
        xe('b', '51D99999', { isXeLanh: true }),
      ]);
      await expect(
        service.assertUsable('a', { requireCold: true }),
      ).rejects.toMatchObject({
        code: 'PHUONG_TIEN_NOT_COLD',
      });
      await expect(
        service.assertUsable('b', { requireCold: true }),
      ).resolves.toBeDefined();
    });

    it('xe ngừng sử dụng → PHUONG_TIEN_INACTIVE (kiểm trước cờ xe lạnh)', async () => {
      const { service } = setup([xe('a', '51C12345', { trangThai: false })]);
      await expect(
        service.assertUsable('a', { requireCold: true }),
      ).rejects.toMatchObject({
        code: 'PHUONG_TIEN_INACTIVE',
      });
    });

    it('không tồn tại → PHUONG_TIEN_NOT_FOUND', async () => {
      const { service } = setup([]);
      await expect(
        service.assertUsable('x', { requireCold: false }),
      ).rejects.toMatchObject({
        code: 'PHUONG_TIEN_NOT_FOUND',
      });
    });
  });
});
