import { Prisma } from '@prisma/client';
import type { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import type { CodeGeneratorService } from '../common/code-generator/code-generator.service.js';
import { AppException } from '../common/errors/app.exception.js';
import type { LoaiHangService } from '../loai-hang/loai-hang.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { CreateHangHoaDto } from './dto/create-hang-hoa.dto.js';
import { HangHoaService } from './hang-hoa.service.js';

const NOW = new Date('2026-10-01T00:00:00Z');
const D = (v: string) => new Prisma.Decimal(v);

const actor = (maRole: string): AuthenticatedUser => ({
  id: 'u1',
  maNV: 'NV0001',
  username: 'u',
  hoTen: 'U',
  email: null,
  role: { maRole, tenRole: maRole },
});
const ADMIN = actor('ADMIN');

interface Stored {
  id: string;
  maSP: string;
  tenSP: string;
  quyCach: string | null;
  donViTinhGia: string;
  giaNhap: Prisma.Decimal;
  giaHienThi: Prisma.Decimal;
  giaToiThieu: Prisma.Decimal;
  isKeDon: boolean;
  isCanGiuLanh: boolean;
  loaiKiemSoat: string | null;
  soDangKy: string | null;
  ghiChu: string | null;
  trangThai: boolean;
  loaiHangId: string;
  tyLeQuyDois: {
    id: string;
    donViTinh: string;
    soLuongQuyDoi: number;
    hangHoaId: string;
  }[];
}

const product = (over: Partial<Stored> = {}): Stored => ({
  id: 'h1',
  maSP: 'SP00001',
  tenSP: 'Paracetamol',
  quyCach: null,
  donViTinhGia: 'hộp',
  giaNhap: D('90000'),
  giaHienThi: D('125000'),
  giaToiThieu: D('100000'),
  isKeDon: false,
  isCanGiuLanh: false,
  loaiKiemSoat: 'thuong',
  soDangKy: null,
  ghiChu: null,
  trangThai: true,
  loaiHangId: 'l1',
  tyLeQuyDois: [
    { id: 'u1', donViTinh: 'viên', soLuongQuyDoi: 1, hangHoaId: 'h1' },
    { id: 'u2', donViTinh: 'hộp', soLuongQuyDoi: 100, hangHoaId: 'h1' },
  ],
  ...over,
});

function setup(
  seed: Stored[] = [],
  lotsPerProduct: Record<string, number> = {},
) {
  const store = new Map(seed.map((p) => [p.id, p]));
  let seq = 0;
  const withRels = (p: Stored) => ({
    ...p,
    loaiHang: { id: p.loaiHangId, tenLoaiHang: 'Loại' },
    createdAt: NOW,
    updatedAt: NOW,
    _count: { soLos: lotsPerProduct[p.id] ?? 0 },
  });

  const hangHoa = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      const p = store.get(where.id);
      return p ? withRels(p) : null;
    }),
    findMany: vi.fn(async () => [...store.values()].map(withRels)),
    count: vi.fn(async () => store.size),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const id = `new${++seq}`;
      const units = (
        data.tyLeQuyDois as {
          create: { donViTinh: string; soLuongQuyDoi: number }[];
        }
      ).create;
      const created = {
        ...(data as object),
        giaNhap: D(String(data.giaNhap)),
        giaHienThi: D(String(data.giaHienThi)),
        giaToiThieu: D(String(data.giaToiThieu)),
        id,
        trangThai: true,
        tyLeQuyDois: units.map((u, i) => ({
          ...u,
          id: `${id}-u${i}`,
          hangHoaId: id,
        })),
      } as unknown as Stored;
      store.set(id, created);
      return withRels(created);
    }),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const next = { ...store.get(where.id)! } as Record<string, unknown>;
        for (const [k, v] of Object.entries(data)) {
          if (v === undefined) continue;
          next[k] = ['giaNhap', 'giaHienThi', 'giaToiThieu'].includes(k)
            ? D(v as string)
            : v;
        }
        store.set(where.id, next as unknown as Stored);
        return withRels(next as unknown as Stored);
      },
    ),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      store.delete(where.id);
    }),
  };
  const tyLeQuyDoi = { deleteMany: vi.fn(async () => ({ count: 0 })) };
  const soLo = {
    count: vi.fn(
      async ({ where }: { where: { hangHoaId: string } }) =>
        lotsPerProduct[where.hangHoaId] ?? 0,
    ),
  };
  const client = { hangHoa, tyLeQuyDoi, soLo };
  const prisma = {
    ...client,
    $transaction: vi.fn(async (fn: (tx: typeof client) => Promise<unknown>) =>
      fn(client),
    ),
  } as unknown as PrismaService;

  const assertUsable = vi.fn(async (id: string) => {
    if (id === 'off' || id === 'missing')
      throw new AppException('LOAI_HANG_NOT_FOUND');
    return { id };
  });
  const loaiHang = { assertUsable } as unknown as LoaiHangService;
  const next = vi.fn(async () => `SP${String(++seq).padStart(5, '0')}`);
  const codes = { next } as unknown as CodeGeneratorService;
  const record = vi.fn().mockResolvedValue({});
  const audit = { record } as unknown as AuditService;

  return {
    service: new HangHoaService(prisma, loaiHang, codes, audit),
    hangHoa,
    tyLeQuyDoi,
    record,
    store,
    assertUsable,
  };
}

const createDto = (over: Partial<CreateHangHoaDto> = {}): CreateHangHoaDto => ({
  tenSP: 'Paracetamol 500mg',
  loaiHangId: 'l1',
  donViCoBan: 'viên',
  cacDonViKhac: [
    { donViTinh: 'vỉ', soLuongQuyDoi: 10 },
    { donViTinh: 'hộp', soLuongQuyDoi: 100 },
  ],
  giaNhap: '90000',
  giaHienThi: '125000',
  giaToiThieu: '100000',
  ...over,
});

describe('HangHoaService', () => {
  describe('create', () => {
    it('sinh maSP, tạo đơn vị cơ bản (hệ số 1) cùng các đơn vị khác trong một lần ghi', async () => {
      const { service, hangHoa } = setup();
      const result = await service.create(
        createDto({ donViTinhGia: 'hộp' }),
        ADMIN,
      );

      expect(result.maSP).toMatch(/^SP\d{5}$/);
      expect(result.donViCoBan).toBe('viên');
      expect(result.donViTinhGia).toBe('hộp');
      expect(
        result.tyLeQuyDoi.map((u) => [u.donViTinh, u.soLuongQuyDoi]),
      ).toEqual([
        ['viên', 1],
        ['vỉ', 10],
        ['hộp', 100],
      ]);
      expect(hangHoa.create).toHaveBeenCalledOnce();
      const data = hangHoa.create.mock.calls[0]![0].data as {
        createdById: string;
        updatedById: string;
      };
      expect(data.createdById).toBe('u1');
      expect(data.updatedById).toBe('u1');
    });

    it('donViTinhGia mặc định là đơn vị cơ bản; giá mặc định 0.00; loại kiểm soát mặc định "thường"', async () => {
      const { service, hangHoa } = setup();
      const result = await service.create(
        { tenSP: 'X', loaiHangId: 'l1', donViCoBan: 'chai' },
        ADMIN,
      );
      expect(result.donViTinhGia).toBe('chai');
      expect(result.giaHienThi).toBe('0.00');
      expect(result.loaiKiemSoat).toBe('thuong');
      expect(
        (hangHoa.create.mock.calls[0]![0].data as { isKeDon: boolean }).isKeDon,
      ).toBe(false);
    });

    it('hai lần tạo liên tiếp → maSP khác nhau', async () => {
      const { service } = setup();
      const a = await service.create(createDto(), ADMIN);
      const b = await service.create(createDto({ tenSP: 'Khác' }), ADMIN);
      expect(a.maSP).not.toBe(b.maSP);
    });

    it('donViTinhGia ngoài các đơn vị → HANG_HOA_PRICE_UNIT_INVALID, chưa chạm DB', async () => {
      const { service, hangHoa } = setup();
      await expect(
        service.create(createDto({ donViTinhGia: 'thùng' }), ADMIN),
      ).rejects.toMatchObject({
        code: 'HANG_HOA_PRICE_UNIT_INVALID',
      });
      expect(hangHoa.create).not.toHaveBeenCalled();
    });

    it('tên đơn vị trùng nhau → TY_LE_QUY_DOI_UNIT_TAKEN', async () => {
      const { service } = setup();
      await expect(
        service.create(
          createDto({
            cacDonViKhac: [{ donViTinh: 'VIÊN', soLuongQuyDoi: 10 }],
          }),
          ADMIN,
        ),
      ).rejects.toMatchObject({ code: 'TY_LE_QUY_DOI_UNIT_TAKEN' });
    });

    it('đơn vị khác có hệ số 1 → TY_LE_QUY_DOI_BASE_REQUIRED', async () => {
      const { service } = setup();
      await expect(
        service.create(
          createDto({ cacDonViKhac: [{ donViTinh: 'vỉ', soLuongQuyDoi: 1 }] }),
          ADMIN,
        ),
      ).rejects.toMatchObject({ code: 'TY_LE_QUY_DOI_BASE_REQUIRED' });
    });

    it('giá tối thiểu > giá hiển thị → HANG_HOA_PRICE_INVALID', async () => {
      const { service } = setup();
      await expect(
        service.create(
          createDto({ giaToiThieu: '130000', giaHienThi: '125000' }),
          ADMIN,
        ),
      ).rejects.toMatchObject({ code: 'HANG_HOA_PRICE_INVALID' });
    });

    it('kê đơn mà loại kiểm soát "thường" hoặc thiếu số đăng ký → HANG_HOA_CONTROL_TYPE_INVALID', async () => {
      const { service } = setup();
      await expect(
        service.create(
          createDto({
            isKeDon: true,
            loaiKiemSoat: 'thuong',
            soDangKy: 'VD-1',
          }),
          ADMIN,
        ),
      ).rejects.toMatchObject({ code: 'HANG_HOA_CONTROL_TYPE_INVALID' });
      await expect(
        service.create(
          createDto({ isKeDon: true, loaiKiemSoat: 'ke_don' }),
          ADMIN,
        ),
      ).rejects.toMatchObject({ code: 'HANG_HOA_CONTROL_TYPE_INVALID' });
      await expect(
        service.create(createDto({ isKeDon: true }), ADMIN),
      ).rejects.toMatchObject({
        code: 'HANG_HOA_CONTROL_TYPE_INVALID',
      });
    });

    it('kê đơn đủ loại kiểm soát và số đăng ký → tạo được', async () => {
      const { service } = setup();
      await expect(
        service.create(
          createDto({
            isKeDon: true,
            loaiKiemSoat: 'ke_don',
            soDangKy: 'VD-1',
          }),
          ADMIN,
        ),
      ).resolves.toMatchObject({
        isKeDon: true,
        loaiKiemSoat: 'ke_don',
        soDangKy: 'VD-1',
      });
    });

    it('loại hàng bị tắt hoặc không có → LOAI_HANG_NOT_FOUND, không tạo gì', async () => {
      const { service, hangHoa } = setup();
      await expect(
        service.create(createDto({ loaiHangId: 'off' }), ADMIN),
      ).rejects.toMatchObject({
        code: 'LOAI_HANG_NOT_FOUND',
      });
      expect(hangHoa.create).not.toHaveBeenCalled();
    });

    it('người tạo là NHAN_VIEN_KHO (nếu có quyền gọi) → response vẫn che giá nhập / tối thiểu', async () => {
      const { service } = setup();
      const result = await service.create(createDto(), actor('NHAN_VIEN_KHO'));
      expect(result).not.toHaveProperty('giaNhap');
    });
  });

  describe('findAll / findOne', () => {
    it('findAll: viewer NHAN_VIEN_KHO không thấy giaNhap/giaToiThieu; KE_TOAN thấy đủ', async () => {
      const { service } = setup([product()]);
      const asKho = await service.findAll(
        { page: 1, pageSize: 20 },
        actor('NHAN_VIEN_KHO'),
      );
      expect(asKho.items[0]).not.toHaveProperty('giaNhap');
      const asKt = await service.findAll(
        { page: 1, pageSize: 20 },
        actor('KE_TOAN'),
      );
      expect(asKt.items[0]).toMatchObject({
        giaNhap: '90000.00',
        giaToiThieu: '100000.00',
      });
    });

    it('findAll từ chối sort theo giaNhap (không cho suy ra giá vốn)', () => {
      const { service } = setup([]);
      expect(() =>
        service.findAll({ page: 1, pageSize: 20, sort: 'giaNhap:asc' }, ADMIN),
      ).toThrow(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
    });

    it('findOne kèm đơn vị sắp theo hệ số tăng; không tồn tại → HANG_HOA_NOT_FOUND', async () => {
      const { service } = setup([product()]);
      const dto = await service.findOne('h1', ADMIN);
      expect(dto.tyLeQuyDoi.map((u) => u.soLuongQuyDoi)).toEqual([1, 100]);
      await expect(service.findOne('x', ADMIN)).rejects.toMatchObject({
        code: 'HANG_HOA_NOT_FOUND',
      });
    });
  });

  describe('update', () => {
    it('đổi giá → ghi nhật ký hang_hoa.price_change với giá trước/sau', async () => {
      const { service, record } = setup([product()]);
      await service.update('h1', { giaHienThi: '130000' }, ADMIN);
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          hanhDong: 'hang_hoa.price_change',
          doiTuongId: 'h1',
          truoc: expect.objectContaining({ giaHienThi: '125000.00' }),
          sau: expect.objectContaining({ giaHienThi: '130000.00' }),
        }),
        expect.anything(),
      );
    });

    it('không đổi giá (chỉ đổi tên) → không ghi nhật ký', async () => {
      const { service, record } = setup([product()]);
      await service.update('h1', { tenSP: 'Tên mới' }, ADMIN);
      expect(record).not.toHaveBeenCalled();
    });

    it('gửi lại đúng các giá hiện tại → không coi là đổi giá', async () => {
      const { service, record } = setup([product()]);
      await service.update(
        'h1',
        { giaNhap: '90000.00', giaHienThi: '125000', giaToiThieu: '100000' },
        ADMIN,
      );
      expect(record).not.toHaveBeenCalled();
    });

    it('đổi riêng giaToiThieu vượt giaHienThi hiện tại → HANG_HOA_PRICE_INVALID', async () => {
      const { service } = setup([product()]);
      await expect(
        service.update('h1', { giaToiThieu: '200000' }, ADMIN),
      ).rejects.toMatchObject({
        code: 'HANG_HOA_PRICE_INVALID',
      });
    });

    it('đổi donViTinhGia sang đơn vị hợp lệ (ghi nhật ký) và đơn vị lạ (lỗi)', async () => {
      const { service, record } = setup([product()]);
      const ok = await service.update('h1', { donViTinhGia: 'VIÊN' }, ADMIN);
      expect(ok.donViTinhGia).toBe('viên');
      expect(record).toHaveBeenCalledOnce();
      await expect(
        service.update('h1', { donViTinhGia: 'thùng' }, ADMIN),
      ).rejects.toMatchObject({
        code: 'HANG_HOA_PRICE_UNIT_INVALID',
      });
    });

    it('bật isKeDon khi loại kiểm soát đang "thường" → HANG_HOA_CONTROL_TYPE_INVALID', async () => {
      const { service } = setup([product({ soDangKy: 'VD-1' })]);
      await expect(
        service.update('h1', { isKeDon: true }, ADMIN),
      ).rejects.toMatchObject({
        code: 'HANG_HOA_CONTROL_TYPE_INVALID',
      });
      await expect(
        service.update('h1', { isKeDon: true, loaiKiemSoat: 'ke_don' }, ADMIN),
      ).resolves.toBeDefined();
    });

    it('xóa soDangKy của thuốc kê đơn (null) → HANG_HOA_CONTROL_TYPE_INVALID', async () => {
      const { service } = setup([
        product({ isKeDon: true, loaiKiemSoat: 'ke_don', soDangKy: 'VD-1' }),
      ]);
      await expect(
        service.update('h1', { soDangKy: null }, ADMIN),
      ).rejects.toMatchObject({
        code: 'HANG_HOA_CONTROL_TYPE_INVALID',
      });
    });

    it('đổi sang loại hàng bị tắt → LOAI_HANG_NOT_FOUND; giữ nguyên loại thì không kiểm lại', async () => {
      const { service, assertUsable } = setup([product()]);
      await expect(
        service.update('h1', { loaiHangId: 'off' }, ADMIN),
      ).rejects.toMatchObject({
        code: 'LOAI_HANG_NOT_FOUND',
      });
      assertUsable.mockClear();
      await service.update('h1', { loaiHangId: 'l1', tenSP: 'X' }, ADMIN);
      expect(assertUsable).not.toHaveBeenCalled();
    });

    it('ngừng kinh doanh; ghi updatedById', async () => {
      const { service, hangHoa } = setup([product()]);
      const result = await service.update('h1', { trangThai: false }, ADMIN);
      expect(result.trangThai).toBe(false);
      expect(
        (hangHoa.update.mock.calls[0]![0].data as { updatedById: string })
          .updatedById,
      ).toBe('u1');
    });

    it('không tồn tại → HANG_HOA_NOT_FOUND', async () => {
      const { service } = setup();
      await expect(
        service.update('x', { tenSP: 'A' }, ADMIN),
      ).rejects.toMatchObject({
        code: 'HANG_HOA_NOT_FOUND',
      });
    });
  });

  describe('remove', () => {
    it('chưa có lô → xóa các đơn vị rồi xóa hàng', async () => {
      const { service, store, tyLeQuyDoi } = setup([product()]);
      await service.remove('h1');
      expect(tyLeQuyDoi.deleteMany).toHaveBeenCalledWith({
        where: { hangHoaId: 'h1' },
      });
      expect(store.has('h1')).toBe(false);
    });

    it('đã có lô → HANG_HOA_IN_USE, không xóa gì', async () => {
      const { service, hangHoa, tyLeQuyDoi } = setup([product()], { h1: 2 });
      await expect(service.remove('h1')).rejects.toMatchObject({
        code: 'HANG_HOA_IN_USE',
      });
      expect(hangHoa.delete).not.toHaveBeenCalled();
      expect(tyLeQuyDoi.deleteMany).not.toHaveBeenCalled();
    });

    it('không tồn tại → HANG_HOA_NOT_FOUND', async () => {
      const { service } = setup();
      await expect(service.remove('x')).rejects.toMatchObject({
        code: 'HANG_HOA_NOT_FOUND',
      });
    });
  });

  describe('dùng cho module khác', () => {
    it('assertReceivable chặn hàng ngừng kinh doanh', () => {
      const { service } = setup();
      expect(() => service.assertReceivable({ trangThai: false })).toThrow(
        expect.objectContaining({ code: 'HANG_HOA_INACTIVE' }),
      );
      expect(() => service.assertReceivable({ trangThai: true })).not.toThrow();
    });

    it('hasLots phản ánh việc hàng đã có số lô', async () => {
      const { service } = setup([product()], { h1: 1 });
      await expect(service.hasLots('h1')).resolves.toBe(true);
      await expect(service.hasLots('h2')).resolves.toBe(false);
    });
  });
});
