import { Prisma } from '@prisma/client';
import { BaoCaoKhoService } from './bao-cao-kho.service.js';

const TODAY = new Date('2026-10-08T00:00:00Z');
const day = (s: string) => new Date(`${s}T00:00:00Z`);

interface Row {
  soLoId: string;
  soLuong: number;
  hanSuDung: string;
  hang: { id: string; maSP: string; tenSP: string };
  kho?: { id: string; tenKho: string };
  loai?: { id: string; tenLoaiHang: string };
}
const A = { id: 'hA', maSP: 'SP1', tenSP: 'A Paracetamol' };
const B = { id: 'hB', maSP: 'SP2', tenSP: 'B Vitamin' };
const KHO1 = { id: 'k1', tenKho: 'Kho 1' };
const KHO2 = { id: 'k2', tenKho: 'Kho 2' };
const LOAI = { id: 'l1', tenLoaiHang: 'Thuốc' };

const stockRow = (r: Row) => ({
  soLoId: r.soLoId,
  soLuong: r.soLuong,
  viTriId: 'v',
  soLo: {
    id: r.soLoId,
    tenLo: r.soLoId,
    hangHoaId: r.hang.id,
    hanSuDung: day(r.hanSuDung),
    hangHoa: { ...r.hang, loaiHang: r.loai ?? LOAI },
  },
  viTri: { id: 'v', tenViTri: 'V', kho: r.kho ?? KHO1 },
});

function setup(
  options: {
    rows?: Row[];
    costs?: Record<string, [string, number]>; // lotId -> [amount, base units]
    queryRaw?: unknown[];
    total?: number;
  } = {},
) {
  const rows = (options.rows ?? []).map(stockRow);
  const queryRaw = vi.fn(async (strings: TemplateStringsArray) => {
    const sql = strings.join('?');
    if (sql.includes('chi_tiet_phieu_nhap_hang')) {
      return Object.entries(options.costs ?? {}).map(
        ([so_lo_id, [amount, units]]) => ({
          so_lo_id,
          amount,
          units,
        }),
      );
    }
    return options.queryRaw ?? [];
  });
  const prisma = {
    tonKho: {
      findMany: vi.fn(async () => rows),
      count: vi.fn(async () => options.total ?? rows.length),
    },
    tyLeQuyDoi: {
      findMany: vi.fn(async () => [
        { hangHoaId: 'hA', donViTinh: 'viên' },
        { hangHoaId: 'hB', donViTinh: 'chai' },
      ]),
    },
    $queryRaw: queryRaw,
  } as never;
  const service = new BaoCaoKhoService(
    prisma,
    {
      today: () => TODAY,
      now: () => new Date('2026-10-08T05:00:00Z'),
    } as never,
    { expiryWarningDays: 90 } as never,
  );
  return {
    service,
    prisma: prisma as { tonKho: { findMany: ReturnType<typeof vi.fn> } },
  };
}

describe('BaoCaoKhoService.tonKho', () => {
  const rows: Row[] = [
    { soLoId: 'l1', soLuong: 100, hanSuDung: '2027-06-01', hang: A },
    { soLoId: 'l2', soLuong: 50, hanSuDung: '2026-11-01', hang: A }, // near expiry
    { soLoId: 'l3', soLuong: 30, hanSuDung: '2026-10-07', hang: A }, // expired
    { soLoId: 'l4', soLuong: 20, hanSuDung: '2027-06-01', hang: B, kho: KHO2 },
  ];
  const costs = {
    l1: ['9000000', 10000],
    l2: ['4500000', 5000],
    l3: ['2700000', 3000],
  } as Record<string, [string, number]>;

  it('nhóm theo hàng hóa: tổng, khả dụng, cận date, hết hạn, số lô, đơn vị cơ bản', async () => {
    const { service } = setup({ rows, costs });
    const result = await service.tonKho({}, 'KE_TOAN');
    expect(result.items.map((i) => i.nhom.ten)).toEqual([
      'A Paracetamol',
      'B Vitamin',
    ]);
    expect(result.items[0]).toMatchObject({
      donViCoBan: 'viên',
      tongTon: 180,
      tonKhaDung: 150,
      tonCanDate: 50,
      tonHetHan: 30,
      soLo: 3,
    });
    expect(result.tong.tongTon).toBe(200);
  });

  it('giá trị tồn = Σ tồn × giá vốn bình quân của lô; lô chưa có giá vốn → thieuGiaVon', async () => {
    const { service } = setup({ rows, costs });
    const result = await service.tonKho({}, 'KE_TOAN');
    // 900/viên × 100 + 900 × 50 + 900 × 30 = 162000 ; B has no cost
    expect(result.items[0]).toMatchObject({
      giaTriTon: '162000.00',
      thieuGiaVon: false,
    });
    expect(result.items[1]).toMatchObject({
      giaTriTon: '0.00',
      thieuGiaVon: true,
    });
    expect(result.tong.giaTriTon).toBe('162000.00');
  });

  it('nhân viên kho không thấy giá trị, giá vốn hay cờ thiếu giá vốn', async () => {
    const { service } = setup({ rows, costs });
    const result = await service.tonKho({}, 'NHAN_VIEN_KHO');
    expect(result.items[0]).not.toHaveProperty('giaTriTon');
    expect(result.items[0]!.thieuGiaVon).toBeUndefined();
    expect(result.tong).not.toHaveProperty('giaTriTon');
  });

  it('nhóm theo kho và theo loại hàng; hạn đúng hôm nay là cận date chứ không hết hạn', async () => {
    const { service } = setup({
      rows: [
        ...rows,
        {
          soLoId: 'l5',
          soLuong: 7,
          hanSuDung: '2026-10-08',
          hang: B,
          kho: KHO2,
        },
      ],
      costs,
    });
    const byKho = await service.tonKho({ groupBy: 'kho' }, 'ADMIN');
    expect(
      byKho.items.map((i) => [i.nhom.ten, i.tongTon, i.donViCoBan]),
    ).toEqual([
      ['Kho 1', 180, null],
      ['Kho 2', 27, null],
    ]);
    expect(byKho.items[1]).toMatchObject({ tonHetHan: 0, tonCanDate: 7 });
    const byLoai = await service.tonKho({ groupBy: 'loai-hang' }, 'ADMIN');
    expect(byLoai.items).toHaveLength(1);
  });

  it('truyền bộ lọc xuống truy vấn; mặc định chỉ lấy dòng còn tồn', async () => {
    const { service, prisma } = setup({ rows });
    await service.tonKho(
      { khoId: 'k1', hangHoaId: 'hA', isCanGiuLanh: true },
      'ADMIN',
    );
    const args = prisma.tonKho.findMany.mock.calls[0]![0] as {
      where: Record<string, unknown>;
    };
    expect(args.where).toMatchObject({
      soLuong: { gt: 0 },
      viTri: { khoId: 'k1' },
      soLo: { hangHoaId: 'hA', hangHoa: { isCanGiuLanh: true } },
    });
    await service.tonKho({ chiConTon: false }, 'ADMIN');
    expect(
      (
        prisma.tonKho.findMany.mock.calls[1]![0] as {
          where: { soLuong: unknown };
        }
      ).where.soLuong,
    ).toBeUndefined();
  });

  it('quá 1.000 nhóm → BAO_CAO_TOO_MANY_GROUPS', async () => {
    const many: Row[] = Array.from({ length: 1001 }, (_, i) => ({
      soLoId: `l${i}`,
      soLuong: 1,
      hanSuDung: '2027-01-01',
      hang: { id: `h${i}`, maSP: `S${i}`, tenSP: `Hàng ${i}` },
    }));
    const { service } = setup({ rows: many });
    await expect(service.tonKho({}, 'ADMIN')).rejects.toMatchObject({
      code: 'BAO_CAO_TOO_MANY_GROUPS',
    });
  });
});

describe('BaoCaoKhoService hạn dùng', () => {
  const rows: Row[] = [
    { soLoId: 'l1', soLuong: 100, hanSuDung: '2026-11-01', hang: A },
    { soLoId: 'l2', soLuong: 40, hanSuDung: '2026-11-20', hang: A },
  ];

  it('cận date: lọc [hôm nay, hôm nay + soNgay]; tổng số lô, số lượng, giá trị', async () => {
    const { service, prisma } = setup({
      rows,
      costs: { l1: ['90000', 100], l2: ['40000', 40] },
    });
    const result = await service.canDate(
      { page: 1, pageSize: 20, soNgay: 45 },
      'KE_TOAN',
    );
    const where = (
      prisma.tonKho.findMany.mock.calls[0]![0] as {
        where: { soLo: { hanSuDung: unknown } };
      }
    ).where;
    expect(where.soLo.hanSuDung).toEqual({
      gte: TODAY,
      lte: day('2026-11-22'),
    });
    expect(result.tong).toEqual({
      soLo: 2,
      tongSoLuong: 140,
      tongGiaTri: '130000.00',
    });
    expect(result.items[0]).toMatchObject({
      soLo: { trangThai: 'can_date', soNgayConLai: 24 },
      giaVonCoBan: '900.00',
      giaTri: '90000.00',
    });
    expect(result.meta).toMatchObject({ page: 1, pageSize: 20, total: 2 });
  });

  it('không truyền soNgay thì dùng EXPIRY_WARNING_DAYS (90 ngày)', async () => {
    const { service, prisma } = setup({ rows });
    await service.canDate({ page: 1, pageSize: 20 }, 'ADMIN');
    const where = (
      prisma.tonKho.findMany.mock.calls[0]![0] as {
        where: { soLo: { hanSuDung: { lte: Date } } };
      }
    ).where;
    expect(where.soLo.hanSuDung.lte).toEqual(day('2027-01-06'));
  });

  it('hết hạn: chỉ lô hạn trước hôm nay; nhân viên kho không thấy giá trị', async () => {
    const { service, prisma } = setup({
      rows: [{ soLoId: 'l9', soLuong: 5, hanSuDung: '2026-10-01', hang: A }],
    });
    const result = await service.hetHan(
      { page: 1, pageSize: 20 },
      'NHAN_VIEN_KHO',
    );
    const where = (
      prisma.tonKho.findMany.mock.calls[0]![0] as {
        where: { soLo: { hanSuDung: unknown } };
      }
    ).where;
    expect(where.soLo.hanSuDung).toEqual({ lt: TODAY });
    expect(result.items[0]!.soLo).toMatchObject({
      trangThai: 'het_han',
      soNgayConLai: -7,
    });
    expect(result.items[0]).not.toHaveProperty('giaTri');
    expect(result.tong).toEqual({ soLo: 1, tongSoLuong: 5 });
  });

  it('phân trang chuẩn: pageSize bị chặn ở 100; lô theo trạng thái', async () => {
    const { service, prisma } = setup({ rows, total: 250 });
    const result = await service.tonKhoTheoLo(
      { page: 3, pageSize: 500, trangThaiLo: 'can_date' },
      'ADMIN',
    );
    const args = prisma.tonKho.findMany.mock.calls[0]![0] as {
      skip: number;
      take: number;
    };
    expect([args.skip, args.take]).toEqual([200, 100]);
    expect(result.meta).toEqual({
      page: 3,
      pageSize: 100,
      total: 250,
      totalPages: 3,
    });
  });
});

describe('BaoCaoKhoService.nhapXuatTon', () => {
  const raw = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    ma_sp: id.toUpperCase(),
    ten_sp: `Hàng ${id}`,
    ton_dau: 0n,
    nhap: 0n,
    xuat: 0n,
    huy_nhap: 0n,
    huy_xuat: 0n,
    tra_hang: 0n,
    dieu_chinh: 0n,
    chuyen: 0n,
    ...over,
  });
  const period = { tuNgay: '2026-10-01', denNgay: '2026-10-31' };

  it('dựng tồn cuối = đầu + mọi biến động theo dấu; cộng tổng; ghi kỳ báo cáo', async () => {
    const { service } = setup({
      queryRaw: [
        raw('hA', {
          ton_dau: 100n,
          nhap: 500n,
          xuat: -200n,
          huy_nhap: -50n,
          huy_xuat: 20n,
          tra_hang: 10n,
          dieu_chinh: -5n,
        }),
        raw('hB', { nhap: 30n, chuyen: -10n }),
      ],
    });
    const result = await service.nhapXuatTon(period);
    expect(result.items.map((i) => [i.hangHoa.id, i.tonCuoi])).toEqual([
      ['hA', 375],
      ['hB', 20],
    ]);
    expect(result.items[0]!.hangHoa.donViCoBan).toBe('viên');
    expect(result.tong).toMatchObject({
      tonDau: 100,
      nhap: 530,
      xuat: -200,
      chuyenRong: -10,
      tonCuoi: 395,
    });
    expect(result.kyBaoCao).toEqual(period);
  });

  it('bỏ hàng không phát sinh và không có tồn đầu; giữ hàng chỉ có tồn đầu', async () => {
    const { service } = setup({
      queryRaw: [raw('hA'), raw('hB', { ton_dau: 40n })],
    });
    const result = await service.nhapXuatTon(period);
    expect(result.items.map((i) => i.hangHoa.id)).toEqual(['hB']);
    expect(result.items[0]).toMatchObject({ tonDau: 40, tonCuoi: 40 });
  });

  it('chấp nhận cả number, chuỗi và Decimal từ MySQL', async () => {
    const { service } = setup({
      queryRaw: [
        raw('hA', { ton_dau: 5, nhap: '7', xuat: new Prisma.Decimal('-2') }),
      ],
    });
    expect((await service.nhapXuatTon(period)).items[0]).toMatchObject({
      tonDau: 5,
      nhap: 7,
      xuat: -2,
      tonCuoi: 10,
    });
  });

  it('kỳ sai hoặc quá 366 ngày → lỗi trước khi truy vấn', async () => {
    const { service, prisma } = setup();
    await expect(
      service.nhapXuatTon({ tuNgay: '2026-10-02', denNgay: '2026-10-01' }),
    ).rejects.toMatchObject({
      code: 'BAO_CAO_RANGE_INVALID',
    });
    await expect(
      service.nhapXuatTon({ tuNgay: '2025-01-01', denNgay: '2026-10-01' }),
    ).rejects.toMatchObject({
      code: 'BAO_CAO_RANGE_TOO_LARGE',
    });
    expect(
      (prisma as unknown as { $queryRaw: ReturnType<typeof vi.fn> }).$queryRaw,
    ).not.toHaveBeenCalled();
  });
});
