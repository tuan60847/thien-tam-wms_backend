import type { AuditService } from '../audit/audit.service.js';
import type { HangHoaFull } from '../hang-hoa/hang-hoa.mapper.js';
import type { HangHoaService } from '../hang-hoa/hang-hoa.service.js';
import { AppException } from '../common/errors/app.exception.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { TyLeQuyDoiService } from './ty-le-quy-doi.service.js';

interface Unit {
  id: string;
  hangHoaId: string;
  donViTinh: string;
  soLuongQuyDoi: number;
  createdAt: Date;
  updatedAt: Date;
}
const NOW = new Date('2026-10-01T00:00:00Z');
const unit = (id: string, donViTinh: string, soLuongQuyDoi: number): Unit => ({
  id,
  hangHoaId: 'h1',
  donViTinh,
  soLuongQuyDoi,
  createdAt: NOW,
  updatedAt: NOW,
});

function setup(options: { donViTinhGia?: string; hasLots?: boolean } = {}) {
  const units = new Map<string, Unit>(
    [unit('u1', 'viên', 1), unit('u2', 'vỉ', 10), unit('u3', 'hộp', 100)].map(
      (u) => [u.id, u],
    ),
  );
  const donViTinhGia = { value: options.donViTinhGia ?? 'hộp' };
  const snapshot = (): HangHoaFull =>
    ({
      id: 'h1',
      donViTinhGia: donViTinhGia.value,
      tyLeQuyDois: [...units.values()].sort(
        (a, b) => a.soLuongQuyDoi - b.soLuongQuyDoi,
      ),
    }) as unknown as HangHoaFull;

  const setPriceUnit = vi.fn(async (_id: string, name: string) => {
    donViTinhGia.value = name;
  });
  const hangHoa = {
    findByIdOrThrow: vi.fn(async (id: string) => {
      if (id !== 'h1') throw new AppException('HANG_HOA_NOT_FOUND');
      return snapshot();
    }),
    hasLots: vi.fn(async () => options.hasLots ?? false),
    setPriceUnit,
  } as unknown as HangHoaService;

  const tyLeQuyDoi = {
    findMany: vi.fn(async () => [...units.values()]),
    findFirst: vi.fn(
      async ({ where }: { where: { id: string; hangHoaId: string } }) => {
        const u = units.get(where.id);
        return u && u.hangHoaId === where.hangHoaId ? u : null;
      },
    ),
    count: vi.fn(async () => units.size),
    create: vi.fn(
      async ({
        data,
      }: {
        data: Omit<Unit, 'id' | 'createdAt' | 'updatedAt'>;
      }) => {
        const created = unit(
          `n${units.size}`,
          data.donViTinh,
          data.soLuongQuyDoi,
        );
        units.set(created.id, created);
        return created;
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<Unit>;
      }) => {
        const next = { ...units.get(where.id)! } as Record<string, unknown>;
        for (const [k, v] of Object.entries(data))
          if (v !== undefined) next[k] = v;
        units.set(where.id, next as unknown as Unit);
        return next as unknown as Unit;
      },
    ),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      units.delete(where.id);
    }),
  };
  const client = { tyLeQuyDoi };
  const prisma = {
    ...client,
    $transaction: vi.fn(async (fn: (tx: typeof client) => Promise<unknown>) =>
      fn(client),
    ),
  } as unknown as PrismaService;
  const record = vi.fn().mockResolvedValue({});
  const audit = { record } as unknown as AuditService;

  return {
    service: new TyLeQuyDoiService(prisma, hangHoa, audit),
    units,
    tyLeQuyDoi,
    setPriceUnit,
    record,
    donViTinhGia,
  };
}

describe('TyLeQuyDoiService', () => {
  describe('findAll / findOne', () => {
    it('sắp theo hệ số tăng và đánh dấu đơn vị cơ bản / đơn vị tính giá', async () => {
      const { service } = setup();
      const result = await service.findAll('h1', { page: 1, pageSize: 50 });
      expect(
        result.items.map((i) => [
          i.donViTinh,
          i.laDonViCoBan,
          i.laDonViTinhGia,
        ]),
      ).toEqual([
        ['viên', true, false],
        ['vỉ', false, false],
        ['hộp', false, true],
      ]);
    });

    it('hàng không tồn tại → HANG_HOA_NOT_FOUND', async () => {
      const { service } = setup();
      await expect(
        service.findAll('x', { page: 1, pageSize: 50 }),
      ).rejects.toMatchObject({
        code: 'HANG_HOA_NOT_FOUND',
      });
    });

    it('đơn vị không thuộc hàng → TY_LE_QUY_DOI_NOT_FOUND', async () => {
      const { service } = setup();
      await expect(service.findOne('h1', 'khong-co')).rejects.toMatchObject({
        code: 'TY_LE_QUY_DOI_NOT_FOUND',
      });
      await expect(service.findOne('h1', 'u2')).resolves.toMatchObject({
        donViTinh: 'vỉ',
      });
    });
  });

  describe('create', () => {
    it('thêm đơn vị mới hệ số ≥ 2 (kể cả khi hàng đã có lô)', async () => {
      const { service } = setup({ hasLots: true });
      await expect(
        service.create('h1', { donViTinh: 'thùng', soLuongQuyDoi: 1000 }),
      ).resolves.toMatchObject({
        donViTinh: 'thùng',
        soLuongQuyDoi: 1000,
        laDonViCoBan: false,
      });
    });

    it('trùng tên (khác hoa/thường) → TY_LE_QUY_DOI_UNIT_TAKEN', async () => {
      const { service, tyLeQuyDoi } = setup();
      await expect(
        service.create('h1', { donViTinh: 'HỘP', soLuongQuyDoi: 50 }),
      ).rejects.toMatchObject({
        code: 'TY_LE_QUY_DOI_UNIT_TAKEN',
      });
      expect(tyLeQuyDoi.create).not.toHaveBeenCalled();
    });

    it('hệ số 1 (đã có đơn vị cơ bản) → TY_LE_QUY_DOI_BASE_REQUIRED', async () => {
      const { service } = setup();
      await expect(
        service.create('h1', { donViTinh: 'chai', soLuongQuyDoi: 1 }),
      ).rejects.toMatchObject({
        code: 'TY_LE_QUY_DOI_BASE_REQUIRED',
      });
    });

    it('hàng không tồn tại → HANG_HOA_NOT_FOUND', async () => {
      const { service } = setup();
      await expect(
        service.create('x', { donViTinh: 'a', soLuongQuyDoi: 5 }),
      ).rejects.toMatchObject({
        code: 'HANG_HOA_NOT_FOUND',
      });
    });
  });

  describe('update', () => {
    it('hàng chưa có lô: đổi hệ số, ghi nhật ký ty_le_quy_doi.update trước/sau', async () => {
      const { service, record } = setup();
      await expect(
        service.update('h1', 'u2', { soLuongQuyDoi: 12 }),
      ).resolves.toMatchObject({
        soLuongQuyDoi: 12,
      });
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          hanhDong: 'ty_le_quy_doi.update',
          truoc: { donViTinh: 'vỉ', soLuongQuyDoi: 10 },
          sau: { donViTinh: 'vỉ', soLuongQuyDoi: 12 },
        }),
        expect.anything(),
      );
    });

    it('hàng đã có lô: đổi hệ số hoặc đổi tên → TY_LE_QUY_DOI_LOCKED', async () => {
      const { service } = setup({ hasLots: true });
      await expect(
        service.update('h1', 'u2', { soLuongQuyDoi: 12 }),
      ).rejects.toMatchObject({
        code: 'TY_LE_QUY_DOI_LOCKED',
      });
      await expect(
        service.update('h1', 'u2', { donViTinh: 'vi' }),
      ).rejects.toMatchObject({
        code: 'TY_LE_QUY_DOI_LOCKED',
      });
    });

    it('gửi lại đúng giá trị hiện tại → không đổi gì, không bị khóa, không ghi nhật ký', async () => {
      const { service, tyLeQuyDoi, record } = setup({ hasLots: true });
      await expect(
        service.update('h1', 'u2', { donViTinh: 'vỉ', soLuongQuyDoi: 10 }),
      ).resolves.toMatchObject({ donViTinh: 'vỉ' });
      expect(tyLeQuyDoi.update).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
    });

    it('đổi hệ số đơn vị cơ bản → TY_LE_QUY_DOI_BASE_IMMUTABLE', async () => {
      const { service } = setup();
      await expect(
        service.update('h1', 'u1', { soLuongQuyDoi: 2 }),
      ).rejects.toMatchObject({
        code: 'TY_LE_QUY_DOI_BASE_IMMUTABLE',
      });
    });

    it('đổi hệ số của đơn vị thường về 1 → TY_LE_QUY_DOI_BASE_REQUIRED', async () => {
      const { service } = setup();
      await expect(
        service.update('h1', 'u2', { soLuongQuyDoi: 1 }),
      ).rejects.toMatchObject({
        code: 'TY_LE_QUY_DOI_BASE_REQUIRED',
      });
    });

    it('đổi tên đơn vị cơ bản khi chưa có lô → được', async () => {
      const { service } = setup();
      await expect(
        service.update('h1', 'u1', { donViTinh: 'viên nén' }),
      ).resolves.toMatchObject({
        donViTinh: 'viên nén',
        laDonViCoBan: true,
      });
    });

    it('đổi tên sang tên đơn vị khác của cùng hàng → TY_LE_QUY_DOI_UNIT_TAKEN', async () => {
      const { service } = setup();
      await expect(
        service.update('h1', 'u2', { donViTinh: 'Hộp' }),
      ).rejects.toMatchObject({
        code: 'TY_LE_QUY_DOI_UNIT_TAKEN',
      });
    });

    it('đổi tên đúng đơn vị tính giá → donViTinhGia của hàng được cập nhật theo', async () => {
      const { service, setPriceUnit, donViTinhGia } = setup({
        donViTinhGia: 'hộp',
      });
      const result = await service.update('h1', 'u3', {
        donViTinh: 'thùng nhỏ',
      });
      expect(setPriceUnit).toHaveBeenCalledWith(
        'h1',
        'thùng nhỏ',
        expect.anything(),
      );
      expect(donViTinhGia.value).toBe('thùng nhỏ');
      expect(result.laDonViTinhGia).toBe(true);
    });

    it('đổi tên đơn vị không phải đơn vị tính giá → không đụng tới hàng', async () => {
      const { service, setPriceUnit } = setup({ donViTinhGia: 'hộp' });
      await service.update('h1', 'u2', { donViTinh: 'vi nhỏ' });
      expect(setPriceUnit).not.toHaveBeenCalled();
    });

    it('đơn vị không thuộc hàng → TY_LE_QUY_DOI_NOT_FOUND', async () => {
      const { service } = setup();
      await expect(
        service.update('h1', 'khong-co', { soLuongQuyDoi: 5 }),
      ).rejects.toMatchObject({
        code: 'TY_LE_QUY_DOI_NOT_FOUND',
      });
    });
  });

  describe('remove', () => {
    it('xóa đơn vị thường (kể cả khi hàng đã có lô) và ghi nhật ký', async () => {
      const { service, units, record } = setup({ hasLots: true });
      await service.remove('h1', 'u2');
      expect(units.has('u2')).toBe(false);
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          hanhDong: 'ty_le_quy_doi.delete',
          doiTuongId: 'u2',
        }),
        expect.anything(),
      );
    });

    it('đơn vị cơ bản → TY_LE_QUY_DOI_BASE_IMMUTABLE', async () => {
      const { service } = setup();
      await expect(service.remove('h1', 'u1')).rejects.toMatchObject({
        code: 'TY_LE_QUY_DOI_BASE_IMMUTABLE',
      });
    });

    it('đơn vị đang là đơn vị tính giá → TY_LE_QUY_DOI_IN_USE', async () => {
      const { service, tyLeQuyDoi } = setup({ donViTinhGia: 'hộp' });
      await expect(service.remove('h1', 'u3')).rejects.toMatchObject({
        code: 'TY_LE_QUY_DOI_IN_USE',
      });
      expect(tyLeQuyDoi.delete).not.toHaveBeenCalled();
    });

    it('đơn vị không tồn tại → TY_LE_QUY_DOI_NOT_FOUND', async () => {
      const { service } = setup();
      await expect(service.remove('h1', 'khong-co')).rejects.toMatchObject({
        code: 'TY_LE_QUY_DOI_NOT_FOUND',
      });
    });
  });

  describe('resolveUnit', () => {
    it('tra theo tên không phân biệt hoa/thường, trả hệ số; tên lạ → null', async () => {
      const { service } = setup();
      await expect(service.resolveUnit('h1', ' HỘP ')).resolves.toEqual({
        donViTinh: 'hộp',
        heSoQuyDoi: 100,
      });
      await expect(service.resolveUnit('h1', 'thùng')).resolves.toBeNull();
    });
  });
});
