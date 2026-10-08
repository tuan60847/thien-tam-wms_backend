import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { TepDinhKemService } from './tep-dinh-kem.service.js';

const user = (maRole: string) =>
  ({ id: 'u1', role: { maRole } }) as AuthenticatedUser;
const PDF = Buffer.from('%PDF-1.4 test');
const dto = {
  loaiDoiTuong: 'khach_hang' as const,
  doiTuongId: '00000000-0000-4000-8000-000000000001',
};

function setup(
  options: {
    targetExists?: boolean;
    existingFiles?: number;
    createError?: Error;
  } = {},
) {
  const tx = {
    tepDinhKem: { delete: vi.fn(async () => ({})) },
  };
  const row = {
    id: 'f1',
    loaiDoiTuong: 'khach_hang',
    doiTuongId: dto.doiTuongId,
    tenFile: 'a.pdf',
    mime: 'application/pdf',
    kichThuoc: PDF.length,
    duongDan: 'khach_hang/2026/x.pdf',
    createdAt: new Date(),
    createdBy: null,
  };
  const count = vi.fn(async () => options.existingFiles ?? 0);
  const create = vi.fn(async () => {
    if (options.createError) throw options.createError;
    return row;
  });
  const prisma = {
    khachHang: {
      count: vi.fn(async () => (options.targetExists === false ? 0 : 1)),
    },
    nhaCungCap: {
      count: vi.fn(async () => (options.targetExists === false ? 0 : 1)),
    },
    hangHoa: {
      count: vi.fn(async () => (options.targetExists === false ? 0 : 1)),
    },
    phieuNhapHang: {
      count: vi.fn(async () => (options.targetExists === false ? 0 : 1)),
    },
    soLo: {
      count: vi.fn(async () => (options.targetExists === false ? 0 : 1)),
    },
    tepDinhKem: {
      count,
      create,
      findUnique: vi.fn(async () => row),
    },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  } as never;
  const save = vi.fn(async () => 'khach_hang/2026/x.pdf');
  const remove = vi.fn(async () => undefined);
  const open = vi.fn(async () => ({}) as never);
  const record = vi.fn().mockResolvedValue({});
  const service = new TepDinhKemService(
    prisma,
    { save, remove, open } as never,
    { record } as never,
  );
  return { service, save, remove, open, create, record, tx };
}

const file = (buffer = PDF, originalname = 'a.pdf') => ({
  originalname,
  size: buffer.length,
  buffer,
});

describe('TepDinhKemService', () => {
  describe('upload', () => {
    it('lưu file rồi ghi DB với kiểu thật theo magic bytes, tên đã làm sạch, người tải lên', async () => {
      const { service, save, create } = setup();
      const result = await service.upload(
        file(PDF, '../scan.pdf'),
        dto,
        user('KE_TOAN'),
      );
      expect(save).toHaveBeenCalledWith('khach_hang', '.pdf', PDF);
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mime: 'application/pdf',
            tenFile: 'scan.pdf',
            duongDan: 'khach_hang/2026/x.pdf',
            createdById: 'u1',
          }),
        }),
      );
      expect(result).not.toHaveProperty('duongDan');
    });

    it('không có file → TEP_NO_FILE; file rỗng → TEP_NO_FILE', async () => {
      const { service } = setup();
      await expect(
        service.upload(undefined, dto, user('ADMIN')),
      ).rejects.toMatchObject({ code: 'TEP_NO_FILE' });
      await expect(
        service.upload(
          { originalname: 'a.pdf', size: 0, buffer: Buffer.alloc(0) },
          dto,
          user('ADMIN'),
        ),
      ).rejects.toMatchObject({ code: 'TEP_NO_FILE' });
    });

    it('nội dung không phải PDF/ảnh dù tên .pdf → TEP_TYPE_NOT_ALLOWED, không lưu', async () => {
      const { service, save } = setup();
      await expect(
        service.upload(
          file(Buffer.from('MZ binary'), 'virus.pdf'),
          dto,
          user('ADMIN'),
        ),
      ).rejects.toMatchObject({ code: 'TEP_TYPE_NOT_ALLOWED' });
      expect(save).not.toHaveBeenCalled();
    });

    it('quá 10 MB → COMMON_PAYLOAD_TOO_LARGE', async () => {
      const { service } = setup();
      const big = {
        originalname: 'a.pdf',
        size: 10 * 1024 * 1024 + 1,
        buffer: PDF,
      };
      await expect(
        service.upload(big, dto, user('ADMIN')),
      ).rejects.toMatchObject({
        code: 'COMMON_PAYLOAD_TOO_LARGE',
      });
    });

    it('đối tượng không tồn tại hoặc đã đủ 20 tệp → TEP_TARGET_INVALID', async () => {
      await expect(
        setup({ targetExists: false }).service.upload(
          file(),
          dto,
          user('ADMIN'),
        ),
      ).rejects.toMatchObject({ code: 'TEP_TARGET_INVALID' });
      await expect(
        setup({ existingFiles: 20 }).service.upload(file(), dto, user('ADMIN')),
      ).rejects.toMatchObject({ code: 'TEP_TARGET_INVALID' });
      await expect(
        setup({ existingFiles: 19 }).service.upload(file(), dto, user('ADMIN')),
      ).resolves.toBeDefined();
    });

    it.each([
      ['khach_hang', 'NHAN_VIEN_KHO', false],
      ['khach_hang', 'KE_TOAN', true],
      ['hang_hoa', 'KE_TOAN', false],
      ['hang_hoa', 'QUAN_LY_KHO', true],
      ['phieu_nhap_hang', 'NHAN_VIEN_KHO', true],
      ['phieu_nhap_hang', 'KE_TOAN', false],
      ['so_lo', 'NHAN_VIEN_KHO', false],
    ] as const)(
      'quyền theo đối tượng: %s × %s → %s',
      async (loaiDoiTuong, role, allowed) => {
        const { service } = setup();
        const run = service.upload(
          file(),
          { ...dto, loaiDoiTuong },
          user(role),
        );
        if (allowed) await expect(run).resolves.toBeDefined();
        else
          await expect(run).rejects.toMatchObject({ code: 'AUTH_FORBIDDEN' });
      },
    );

    it('lưu đĩa lỗi → TEP_STORAGE_FAILED; ghi DB lỗi → xóa file vừa lưu (bù trừ) rồi ném lại lỗi gốc', async () => {
      const failing = setup();
      failing.save.mockRejectedValueOnce(new Error('disk full'));
      await expect(
        failing.service.upload(file(), dto, user('ADMIN')),
      ).rejects.toMatchObject({
        code: 'TEP_STORAGE_FAILED',
      });

      const boom = new Error('db down');
      const { service, remove } = setup({ createError: boom });
      await expect(service.upload(file(), dto, user('ADMIN'))).rejects.toBe(
        boom,
      );
      expect(remove).toHaveBeenCalledWith('khach_hang/2026/x.pdf');
    });
  });

  describe('remove', () => {
    it('xóa DB + nhật ký trong một giao dịch, rồi xóa file', async () => {
      const { service, remove, record, tx } = setup();
      await service.remove('f1', user('KE_TOAN'));
      expect(tx.tepDinhKem.delete).toHaveBeenCalledWith({
        where: { id: 'f1' },
      });
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({ hanhDong: 'tep_dinh_kem.delete' }),
        tx,
      );
      expect(remove).toHaveBeenCalledWith('khach_hang/2026/x.pdf');
    });

    it('không đủ quyền theo đối tượng gắn → AUTH_FORBIDDEN, không xóa gì', async () => {
      const { service, remove, tx } = setup();
      await expect(
        service.remove('f1', user('NHAN_VIEN_KHO')),
      ).rejects.toMatchObject({
        code: 'AUTH_FORBIDDEN',
      });
      expect(tx.tepDinhKem.delete).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
    });

    it('xóa file lỗi sau khi commit DB → không ném lỗi (chỉ để lại file mồ côi)', async () => {
      const { service, remove } = setup();
      remove.mockRejectedValueOnce(new Error('EACCES'));
      await expect(
        service.remove('f1', user('ADMIN')),
      ).resolves.toBeUndefined();
    });
  });

  describe('download', () => {
    it('trả luồng và metadata; file mất trên đĩa → TEP_NOT_FOUND', async () => {
      const ok = setup();
      await expect(ok.service.download('f1')).resolves.toMatchObject({
        tenFile: 'a.pdf',
        mime: 'application/pdf',
      });
      const missing = setup();
      missing.open.mockResolvedValueOnce(null as never);
      await expect(missing.service.download('f1')).rejects.toMatchObject({
        code: 'TEP_NOT_FOUND',
      });
    });
  });
});
