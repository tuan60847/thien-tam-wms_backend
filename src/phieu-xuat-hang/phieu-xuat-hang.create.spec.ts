import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { AppException } from '../common/errors/app.exception.js';
import type { CreatePhieuXuatDto } from './dto/phieu-xuat.dto.js';
import { PhieuXuatHangService } from './phieu-xuat-hang.service.js';

const TODAY = new Date('2026-10-08T00:00:00Z');
const D = (v: string) => new Prisma.Decimal(v);
const actorOf = (maRole: string) =>
  ({ id: 'u-' + maRole, role: { maRole } }) as AuthenticatedUser;
const NVK = actorOf('NHAN_VIEN_KHO');
const QL = actorOf('QUAN_LY_KHO');

interface Options {
  customer?: Record<string, unknown>;
  stock?: { soLuong: number } | null;
  issued?: { conNo?: string }[]; // already issued orders of the customer
  term?: { id: string; soNgayDuocNo: number } | null;
  quoteExists?: boolean;
  priceUnit?: { donViTinh: string; soLuongQuyDoi: number }[];
  unitFactor?: number | null; // null = unknown unit
  product?: Record<string, unknown>;
}

function setup(options: Options = {}) {
  const customer = {
    id: 'kh',
    tenKH: 'Nhà thuốc A',
    maSoThue: '0312345678',
    diaChi: '12 Lê Lợi',
    lienHeHoTen: 'Chị Hương',
    nhanVienBanHangId: 'nv-kh',
    dieuKhoanThanhToanId: null,
    soNgayDuocNo: null,
    soNoToiDa: D('0'),
    ...options.customer,
  };
  const product = {
    id: 'h1',
    isCanGiuLanh: false,
    giaNhap: D('90000'),
    giaToiThieu: D('100000'),
    thueSuatGtgt: D('8'),
    donViTinhGia: 'hộp',
    tyLeQuyDois: options.priceUnit ?? [
      { donViTinh: 'viên', soLuongQuyDoi: 1 },
      { donViTinh: 'hộp', soLuongQuyDoi: 100 },
    ],
    ...options.product,
  };
  const issued = (options.issued ?? []).map((o) => ({
    chiTietPhieuXuatHangs: [
      {
        soLuong: 1,
        donGia: D(o.conNo ?? '0'),
        tienChietKhau: D('0'),
        tienThueGtgt: D('0'),
      },
    ],
    doiTrus: [],
    traLaiHangBans: [],
  }));
  const created: { data: Record<string, unknown> }[] = [];
  const tx = {
    tonKho: {
      findUnique: vi.fn(async () =>
        options.stock === null ? null : (options.stock ?? { soLuong: 1000 }),
      ),
    },
    phieuXuatHang: {
      findMany: vi.fn(async () => issued),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        created.push(args);
        return { id: 'new1' };
      }),
    },
    baoGia: {
      count: vi.fn(async () => (options.quoteExists === false ? 0 : 1)),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  } as never;
  const record = vi.fn().mockResolvedValue({});
  const nhanVienAssert = vi.fn(async () => ({}));
  const dieuKhoanFind = vi.fn(async (id: string) => {
    if (!options.term || options.term.id !== id) {
      throw new AppException('DIEU_KHOAN_NOT_FOUND');
    }
    return options.term;
  });
  const assertCanBuy = vi.fn();
  const service = new PhieuXuatHangService(
    prisma,
    { next: vi.fn(async () => 'PX2610080001') } as never,
    { record } as never,
    {
      today: () => TODAY,
      now: () => new Date('2026-10-08T08:00:00Z'),
    } as never,
    { findByIdOrThrow: vi.fn(async () => customer), assertCanBuy } as never,
    { assertUsable: vi.fn() } as never,
    {
      findByIdOrThrow: vi.fn(async () => ({ id: 'lot1', hangHoaId: 'h1' })),
      assertIssuable: vi.fn(),
    } as never,
    { findByIdOrThrow: vi.fn(async () => product) } as never,
    { findByIdOrThrow: vi.fn(async () => ({ id: 'v1' })) } as never,
    {
      resolveUnit: vi.fn(async (_id: string, name: string) =>
        options.unitFactor === null
          ? null
          : {
              donViTinh: name,
              heSoQuyDoi: options.unitFactor ?? (name === 'hộp' ? 100 : 1),
            },
      ),
    } as never,
    { increase: vi.fn(), decrease: vi.fn() } as never,
    { assertUsable: nhanVienAssert } as never,
    { findByIdOrThrow: dieuKhoanFind } as never,
    { setContext: vi.fn(), info: vi.fn() } as never,
    { expiryWarningDays: 90 } as never,
  );
  vi.spyOn(service, 'findOne').mockResolvedValue({ id: 'new1' } as never);
  return { service, tx, created, record, nhanVienAssert, dieuKhoanFind };
}

const line = (over: Record<string, unknown> = {}) => ({
  soLoId: 'lot1',
  viTriId: 'v1',
  donViTinh: 'hộp',
  soLuong: 2,
  donGia: '125000',
  ...over,
});
const dto = (over: Partial<CreatePhieuXuatDto> = {}): CreatePhieuXuatDto => ({
  khachHangId: 'kh',
  chiTiet: [line()],
  ...over,
});
const lineData = (created: { data: Record<string, unknown> }[]) =>
  (
    created[0]!.data.chiTietPhieuXuatHangs as {
      create: Record<string, unknown>[];
    }
  ).create;

describe('PhieuXuatHangService.create', () => {
  describe('mặc định từ khách hàng và ảnh chụp thông tin', () => {
    it('lấy nhân viên, điều khoản, số ngày nợ, người liên hệ và chụp lại tên, MST, địa chỉ khách', async () => {
      const { service, created } = setup({
        customer: { dieuKhoanThanhToanId: 'dk1', soNgayDuocNo: 10 },
        term: { id: 'dk1', soNgayDuocNo: 30 },
      });
      await service.create(dto(), QL);
      expect(created[0]!.data).toMatchObject({
        nhanVienBanHangId: 'nv-kh',
        dieuKhoanThanhToanId: 'dk1',
        soNgayDuocNo: 30, // the term wins over the customer's own number
        hanThanhToan: null,
        nguoiLienHe: 'Chị Hương',
        khachTenSnapshot: 'Nhà thuốc A',
        khachMaSoThueSnapshot: '0312345678',
        khachDiaChiSnapshot: '12 Lê Lợi',
        diaChiGiaoHang: '12 Lê Lợi',
        lapKemHoaDon: false,
      });
    });

    it('khách không có điều khoản thì dùng số ngày nợ của khách; phiếu gửi giá trị riêng thì thắng', async () => {
      const own = setup({ customer: { soNgayDuocNo: 15 } });
      await own.service.create(dto(), QL);
      expect(own.created[0]!.data).toMatchObject({
        soNgayDuocNo: 15,
        dieuKhoanThanhToanId: null,
      });

      const over = setup({ customer: { soNgayDuocNo: 15 } });
      await over.service.create(
        dto({
          soNgayDuocNo: 7,
          nhanVienBanHangId: 'nv-khac',
          hanThanhToan: '2026-12-01',
          thamChieu: 'HĐ 1',
          lapKemHoaDon: true,
        }),
        QL,
      );
      expect(over.created[0]!.data).toMatchObject({
        soNgayDuocNo: 7,
        nhanVienBanHangId: 'nv-khac',
        hanThanhToan: new Date('2026-12-01T00:00:00Z'),
        thamChieu: 'HĐ 1',
        lapKemHoaDon: true,
      });
      expect(over.nhanVienAssert).toHaveBeenCalledWith(
        'nv-khac',
        expect.anything(),
      );
    });

    it('chỉ kiểm tra nhân viên còn hoạt động khi phiếu chỉ định nhân viên (không kiểm của khách)', async () => {
      const { service, nhanVienAssert } = setup();
      await service.create(dto(), QL);
      expect(nhanVienAssert).not.toHaveBeenCalled();
    });

    it('điều khoản hoặc báo giá không tồn tại → lỗi tương ứng, không tạo phiếu', async () => {
      const missingTerm = setup();
      await expect(
        missingTerm.service.create(dto({ dieuKhoanThanhToanId: 'nope' }), QL),
      ).rejects.toMatchObject({ code: 'DIEU_KHOAN_NOT_FOUND' });
      expect(missingTerm.created).toHaveLength(0);

      const missingQuote = setup({ quoteExists: false });
      await expect(
        missingQuote.service.create(dto({ baoGiaId: 'q1' }), QL),
      ).rejects.toMatchObject({ code: 'BAO_GIA_NOT_FOUND' });
    });
  });

  describe('chiết khấu, thuế và giá vốn của dòng', () => {
    it('chiết khấu theo %, thuế mặc định theo hàng hóa tính trên số tiền sau chiết khấu', async () => {
      const { service, created } = setup();
      await service.create(
        dto({ chiTiet: [line({ tyLeChietKhau: '10' })] }),
        QL,
      );
      // 2 × 125000 = 250000; ck 10% = 25000; VAT 8% × 225000 = 18000
      expect(lineData(created)[0]).toMatchObject({
        tyLeChietKhau: D('10'),
        tienChietKhau: D('25000'),
        thueSuatGtgt: D('8'),
        tienThueGtgt: D('18000'),
        laHangKhuyenMai: false,
      });
    });

    it('thuế ghi đè trên dòng; làm tròn HALF_UP 2 chữ số', async () => {
      const { service, created } = setup();
      await service.create(
        dto({
          chiTiet: [
            line({
              soLuong: 1,
              donGia: '100000.05',
              thueSuatGtgt: '5',
              tyLeChietKhau: '3.33',
            }),
          ],
        }),
        QL,
      );
      const data = lineData(created)[0]!;
      // ck = 100000.05 × 3.33% = 3330.0017 → 3330.00 ; VAT = (100000.05 − 3330.00) × 5% = 4833.5025 → 4833.50
      expect((data.tienChietKhau as Prisma.Decimal).toFixed(2)).toBe('3330.00');
      expect((data.tienThueGtgt as Prisma.Decimal).toFixed(2)).toBe('4833.50');
    });

    it('giá vốn ước tính theo giá nhập quy về đơn vị của dòng (hộp 100 viên)', async () => {
      const { service, created } = setup();
      await service.create(dto({ chiTiet: [line({ soLuong: 3 })] }), QL);
      expect(lineData(created)[0]).toMatchObject({
        donGiaVon: D('90000'),
        tienGiaVon: D('270000'),
      });
      const perPill = setup();
      await perPill.service.create(
        dto({
          chiTiet: [line({ donViTinh: 'viên', soLuong: 10, donGia: '1000' })],
        }),
        QL,
      );
      expect(lineData(perPill.created)[0]).toMatchObject({
        donGiaVon: D('900'),
        tienGiaVon: D('9000'),
      });
    });
  });

  describe('giá tối thiểu', () => {
    it('NVK bán dưới mức tối thiểu bị chặn; đúng bằng mức tối thiểu thì được', async () => {
      const low = setup();
      await expect(
        low.service.create(
          dto({ chiTiet: [line({ donGia: '99999.99' })] }),
          NVK,
        ),
      ).rejects.toMatchObject({ code: 'PHIEU_XUAT_PRICE_BELOW_MIN' });
      expect(low.created).toHaveLength(0);
      const exact = setup();
      await expect(
        exact.service.create(
          dto({ chiTiet: [line({ donGia: '100000' })] }),
          NVK,
        ),
      ).resolves.toBeDefined();
    });

    it('mức tối thiểu đổi theo đơn vị: 1000 / viên được, 999.99 / viên bị chặn', async () => {
      const ok = setup();
      await expect(
        ok.service.create(
          dto({
            chiTiet: [line({ donViTinh: 'viên', soLuong: 5, donGia: '1000' })],
          }),
          NVK,
        ),
      ).resolves.toBeDefined();
      const bad = setup();
      await expect(
        bad.service.create(
          dto({
            chiTiet: [
              line({ donViTinh: 'viên', soLuong: 5, donGia: '999.99' }),
            ],
          }),
          NVK,
        ),
      ).rejects.toMatchObject({ code: 'PHIEU_XUAT_PRICE_BELOW_MIN' });
    });

    it('quản lý bán dưới mức tối thiểu được và ghi nhật ký; hàng khuyến mại không bị kiểm', async () => {
      const manager = setup();
      await manager.service.create(
        dto({ chiTiet: [line({ donGia: '80000' })] }),
        QL,
      );
      expect(manager.record).toHaveBeenCalledWith(
        expect.objectContaining({
          hanhDong: 'phieu_xuat.below_min_price',
          sau: {
            dong: [{ dong: 1, donGia: '80000.00', toiThieu: '100000.00' }],
          },
        }),
        manager.tx,
      );
      const promo = setup();
      await promo.service.create(
        dto({ chiTiet: [line({ donGia: '0', laHangKhuyenMai: true })] }),
        NVK,
      );
      expect(promo.record).not.toHaveBeenCalled();
      expect(lineData(promo.created)[0]).toMatchObject({
        laHangKhuyenMai: true,
      });
    });
  });

  describe('kiểm tra tồn và dòng', () => {
    it('lô không có tại vị trí → PHIEU_XUAT_LOT_NOT_AT_LOCATION; tồn 0 cũng vậy', async () => {
      await expect(
        setup({ stock: null }).service.create(dto(), QL),
      ).rejects.toMatchObject({
        code: 'PHIEU_XUAT_LOT_NOT_AT_LOCATION',
      });
      await expect(
        setup({ stock: { soLuong: 0 } }).service.create(dto(), QL),
      ).rejects.toMatchObject({
        code: 'PHIEU_XUAT_LOT_NOT_AT_LOCATION',
      });
    });

    it('vượt tồn hiện tại → TON_KHO_INSUFFICIENT kèm số còn lại; đúng bằng tồn thì được', async () => {
      const over = setup({ stock: { soLuong: 199 } }); // 2 hộp = 200 viên
      await expect(over.service.create(dto(), QL)).rejects.toMatchObject({
        code: 'TON_KHO_INSUFFICIENT',
        details: { conLai: 199, canLay: 200 },
      });
      await expect(
        setup({ stock: { soLuong: 200 } }).service.create(dto(), QL),
      ).resolves.toBeDefined();
    });

    it('đơn vị lạ → PHIEU_XUAT_UNIT_INVALID; hai dòng trùng lô và vị trí → PHIEU_XUAT_DUPLICATE_LINE', async () => {
      await expect(
        setup({ unitFactor: null }).service.create(dto(), QL),
      ).rejects.toMatchObject({
        code: 'PHIEU_XUAT_UNIT_INVALID',
      });
      await expect(
        setup().service.create(dto({ chiTiet: [line(), line()] }), QL),
      ).rejects.toMatchObject({ code: 'PHIEU_XUAT_DUPLICATE_LINE' });
    });

    it('số lượng quy đổi tràn Int → VALIDATION_FAILED', async () => {
      await expect(
        setup().service.create(
          dto({ chiTiet: [line({ soLuong: 2_000_000_000 })] }),
          QL,
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    });

    it('phiếu không có dòng vẫn tạo được (nháp rỗng)', async () => {
      const { service, created } = setup();
      await service.create(dto({ chiTiet: [] }), QL);
      expect(lineData(created)).toEqual([]);
    });
  });

  describe('hạn mức nợ (câu #44)', () => {
    // each test order: 2 hộp × 125000 + 8% VAT = 270000
    const limit = (value: string, issued: string[] = []) =>
      setup({
        customer: { soNoToiDa: D(value) },
        issued: issued.map((conNo) => ({ conNo })),
      });

    it('hạn mức 0 = không giới hạn: không đọc công nợ', async () => {
      const { service, tx } = setup();
      await service.create(dto(), QL);
      expect(tx.phieuXuatHang.findMany).not.toHaveBeenCalled();
    });

    it('công nợ đã xuất + phiếu mới ≤ hạn mức → tạo được (kể cả bằng đúng hạn mức)', async () => {
      await expect(
        limit('300000', ['30000']).service.create(dto(), QL),
      ).resolves.toBeDefined();
      await expect(
        limit('270000').service.create(dto(), QL),
      ).resolves.toBeDefined();
    });

    it('vượt hạn mức → KHACH_HANG_CREDIT_EXCEEDED kèm hạn mức và công nợ sau phiếu; không tạo phiếu', async () => {
      const { service, created } = limit('300000', ['30000.01']);
      await expect(service.create(dto(), QL)).rejects.toMatchObject({
        code: 'KHACH_HANG_CREDIT_EXCEEDED',
        details: { hanMuc: '300000.00', congNoSauPhieu: '300000.01' },
      });
      expect(created).toHaveLength(0);
    });

    it('chiết khấu làm phiếu nhỏ lại nên lọt hạn mức', async () => {
      const { service } = limit('250000', []);
      await expect(service.create(dto(), QL)).rejects.toMatchObject({
        code: 'KHACH_HANG_CREDIT_EXCEEDED',
      });
      // 20% discount: 250000 − 50000 = 200000, VAT 8% = 16000 → 216000 ≤ 250000
      await expect(
        limit('250000').service.create(
          dto({ chiTiet: [line({ tyLeChietKhau: '20' })] }),
          QL,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('getOutstandingByCustomer', () => {
    it('cộng công nợ còn lại của các phiếu đã xuất; không có phiếu → 0', async () => {
      const two = setup({
        issued: [{ conNo: '100000' }, { conNo: '50000.5' }],
      });
      expect(
        (
          await two.service.getOutstandingByCustomer('kh', two.tx as never)
        ).toFixed(2),
      ).toBe('150000.50');
      const none = setup();
      expect(
        (
          await none.service.getOutstandingByCustomer('kh', none.tx as never)
        ).toFixed(2),
      ).toBe('0.00');
    });
  });
});
