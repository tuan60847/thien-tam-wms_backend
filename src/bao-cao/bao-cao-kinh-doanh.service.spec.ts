import { Prisma } from '@prisma/client';
import { BaoCaoKinhDoanhService } from './bao-cao-kinh-doanh.service.js';

const TODAY = new Date('2026-10-08T00:00:00Z');
const D = (v: string) => new Prisma.Decimal(v);
const day = (s: string) => new Date(`${s}T00:00:00Z`);

function setup(
  options: {
    raw?: unknown[][]; // successive $queryRaw results
    orders?: unknown[];
    receipts?: unknown[];
  } = {},
) {
  const queryRaw = vi.fn();
  for (const result of options.raw ?? [])
    queryRaw.mockResolvedValueOnce(result);
  queryRaw.mockResolvedValue([]);
  const prisma = {
    $queryRaw: queryRaw,
    phieuXuatHang: { findMany: vi.fn(async () => options.orders ?? []) },
    phieuNhapHang: { findMany: vi.fn(async () => options.receipts ?? []) },
    tyLeQuyDoi: {
      findMany: vi.fn(async () => [{ hangHoaId: 'hA', donViTinh: 'viên' }]),
    },
  } as never;
  const service = new BaoCaoKinhDoanhService(prisma, {
    today: () => TODAY,
    now: () => new Date('2026-10-08T05:00:00Z'),
  } as never);
  return {
    service,
    prisma: prisma as { phieuXuatHang: { findMany: ReturnType<typeof vi.fn> } },
    queryRaw,
  };
}

const period = { tuNgay: '2026-10-01', denNgay: '2026-10-31' };

describe('BaoCaoKinhDoanhService.doanhThu', () => {
  it('doanh thu = tiền hàng − chiết khấu; tổng tính riêng; trừ hàng trả lại ra doanh thu thuần', async () => {
    const { service } = setup({
      raw: [
        [
          {
            khoa: '2026-10-01',
            ten: '2026-10-01',
            so_phieu: 2n,
            so_luong: 300n,
            tien_hang: D('700000'),
            chiet_khau: D('20000'),
          },
          {
            khoa: '2026-10-02',
            ten: '2026-10-02',
            so_phieu: 1n,
            so_luong: '100',
            tien_hang: 200000,
            chiet_khau: 0,
          },
        ],
        [
          {
            so_phieu: 3n,
            so_luong: 400n,
            tien_hang: D('900000'),
            chiet_khau: D('20000'),
            thue: D('70400'),
          },
        ],
        [{ value: D('125000') }],
      ],
    });
    const result = await service.doanhThu(period);
    expect(result.groupBy).toBe('ngay');
    expect(result.items[0]).toMatchObject({
      nhom: { khoa: '2026-10-01' },
      soPhieu: 2,
      soLuongCoBan: 300,
      tienHang: '700000.00',
      chietKhau: '20000.00',
      doanhThu: '680000.00',
    });
    expect(result.items[1]).toMatchObject({
      soPhieu: 1,
      soLuongCoBan: 100,
      doanhThu: '200000.00',
    });
    expect(result.tong).toEqual({
      soPhieu: 3,
      soLuongCoBan: 400,
      tienHang: '900000.00',
      chietKhau: '20000.00',
      tienThueGtgt: '70400.00',
      doanhThu: '880000.00',
      giaTriTraLai: '125000.00',
      doanhThuThuan: '755000.00',
    });
    expect(result.kyBaoCao).toEqual(period);
  });

  it('kỳ không có phiếu: danh sách rỗng, tổng bằng 0', async () => {
    const { service } = setup({
      raw: [
        [],
        [
          {
            so_phieu: 0n,
            so_luong: null,
            tien_hang: null,
            chiet_khau: null,
            thue: null,
          },
        ],
        [{ value: null }],
      ],
    });
    const result = await service.doanhThu(period);
    expect(result.items).toEqual([]);
    expect(result.tong).toMatchObject({
      soPhieu: 0,
      doanhThu: '0.00',
      giaTriTraLai: '0.00',
      doanhThuThuan: '0.00',
    });
  });

  it('kỳ sai hoặc quá dài, hoặc quá 1.000 nhóm → lỗi', async () => {
    const { service } = setup();
    await expect(
      service.doanhThu({ tuNgay: '2026-11-01', denNgay: '2026-10-01' }),
    ).rejects.toMatchObject({
      code: 'BAO_CAO_RANGE_INVALID',
    });
    await expect(
      service.doanhThu({ tuNgay: '2025-01-01', denNgay: '2026-10-01' }),
    ).rejects.toMatchObject({
      code: 'BAO_CAO_RANGE_TOO_LARGE',
    });
    const many = Array.from({ length: 1001 }, (_, i) => ({
      khoa: `k${i}`,
      ten: `k${i}`,
      so_phieu: 1n,
      so_luong: 1n,
      tien_hang: 1,
      chiet_khau: 0,
    }));
    await expect(
      setup({ raw: [many] }).service.doanhThu({
        ...period,
        groupBy: 'khach-hang',
      }),
    ).rejects.toMatchObject({
      code: 'BAO_CAO_TOO_MANY_GROUPS',
    });
  });
});

describe('BaoCaoKinhDoanhService.topBanChay', () => {
  it('đánh số hạng từ 1, kèm đơn vị cơ bản; mặc định giới hạn 10 dòng', async () => {
    const { service, queryRaw } = setup({
      raw: [
        [
          {
            id: 'hA',
            ma_sp: 'SP1',
            ten_sp: 'A',
            so_luong: 400n,
            doanh_thu: D('500000'),
            so_phieu: 3n,
          },
          {
            id: 'hB',
            ma_sp: 'SP2',
            ten_sp: 'B',
            so_luong: 100n,
            doanh_thu: D('180000.5'),
            so_phieu: 1n,
          },
        ],
      ],
    });
    const result = await service.topBanChay(period);
    expect(
      result.items.map((i) => [
        i.hang,
        i.hangHoa.tenSP,
        i.doanhThu,
        i.hangHoa.donViCoBan,
      ]),
    ).toEqual([
      [1, 'A', '500000.00', 'viên'],
      [2, 'B', '180000.50', null],
    ]);
    expect(queryRaw.mock.calls[0]!.slice(1)).toContain(10);
  });

  it('truyền limit xuống truy vấn; kỳ sai → lỗi', async () => {
    const { service, queryRaw } = setup();
    await service.topBanChay({ ...period, limit: 3, tieuChi: 'so-luong' });
    expect(queryRaw.mock.calls[0]!.slice(1)).toContain(3);
    await expect(
      service.topBanChay({ tuNgay: '2026-11-01', denNgay: '2026-10-01' }),
    ).rejects.toMatchObject({
      code: 'BAO_CAO_RANGE_INVALID',
    });
  });
});

describe('BaoCaoKinhDoanhService.congNoPhaiThu', () => {
  const khach = (id: string, ten: string) => ({
    id,
    maKH: id.toUpperCase(),
    tenKH: ten,
  });
  const order = (
    kh: ReturnType<typeof khach>,
    ngay: string,
    total: string,
    paid: string[] = [],
    returned: string[] = [],
  ) => ({
    ngayXuatKho: day(ngay),
    khachHang: kh,
    chiTietPhieuXuatHangs: [
      {
        soLuong: 1,
        donGia: D(total),
        tienChietKhau: D('0'),
        tienThueGtgt: D('0'),
      },
    ],
    doiTrus: paid.map((p) => ({ soTienDoiTru: D(p) })),
    traLaiHangBans: returned.length
      ? [
          {
            chiTiets: returned.map((r) => ({
              soLuong: 1,
              donGia: D(r),
              tienChietKhau: D('0'),
            })),
          },
        ]
      : [],
  });
  const X = khach('kx', 'Nhà thuốc X');
  const Y = khach('ky', 'Nhà thuốc Y');

  it('xếp nợ theo tuổi, trừ khoản đã thu và hàng trả lại, gộp theo khách và sắp theo tên', async () => {
    const { service } = setup({
      orders: [
        order(Y, '2026-10-05', '100000'), // 3 days → 0-30
        order(X, '2026-09-07', '200000', ['50000']), // 31 days → 31-60, owes 150000
        order(X, '2026-06-01', '300000', [], ['100000']), // 129 days → >90, owes 200000
        order(X, '2026-10-01', '80000', ['80000']), // fully paid → ignored
      ],
    });
    const result = await service.congNoPhaiThu({});
    expect(result.denNgay).toBe('2026-10-08');
    expect(
      result.items.map((i) => [i.khachHang.tenKH, i.tongConNo, i.soPhieuConNo]),
    ).toEqual([
      ['Nhà thuốc X', '350000.00', 2],
      ['Nhà thuốc Y', '100000.00', 1],
    ]);
    expect(result.items[0]).toMatchObject({
      nhom0_30: '0.00',
      nhom31_60: '150000.00',
      nhom61_90: '0.00',
      nhomTren90: '200000.00',
    });
    expect(result.tong).toMatchObject({
      tongConNo: '450000.00',
      soPhieuConNo: 3,
      nhom0_30: '100000.00',
    });
  });

  it('biên tuổi nợ: 30 ngày còn ở nhóm 0-30, 31 ngày sang 31-60', async () => {
    const { service } = setup({
      orders: [order(X, '2026-09-08', '10'), order(X, '2026-09-07', '20')],
    });
    const item = (await service.congNoPhaiThu({})).items[0]!;
    expect([item.nhom0_30, item.nhom31_60]).toEqual(['10.00', '20.00']);
  });

  it('chiConNo=false giữ khách đã trả hết; mặc định ẩn', async () => {
    const orders = [order(X, '2026-10-01', '1000', ['1000'])];
    expect((await setup({ orders }).service.congNoPhaiThu({})).items).toEqual(
      [],
    );
    const all = await setup({ orders }).service.congNoPhaiThu({
      chiConNo: false,
    });
    expect(all.items.map((i) => [i.khachHang.tenKH, i.tongConNo])).toEqual([
      ['Nhà thuốc X', '0.00'],
    ]);
  });

  it('truyền denNgay và khách vào truy vấn; ngày tương lai bị từ chối; phiếu quá khứ lọc theo ngày', async () => {
    const { service, prisma } = setup();
    await service.congNoPhaiThu({ denNgay: '2026-09-01', khachHangId: 'kx' });
    const args = prisma.phieuXuatHang.findMany.mock.calls[0]![0] as {
      where: { khachHangId: string; ngayXuatKho: { lte: Date } };
      select: { doiTrus: { where: { ngayDoiTru: { lte: Date } } } };
    };
    expect(args.where.khachHangId).toBe('kx');
    expect(args.where.ngayXuatKho.lte).toEqual(day('2026-09-01'));
    expect(args.select.doiTrus.where.ngayDoiTru.lte).toEqual(day('2026-09-01'));
    await expect(
      service.congNoPhaiThu({ denNgay: '2026-10-09' }),
    ).rejects.toMatchObject({
      code: 'BAO_CAO_RANGE_INVALID',
    });
  });

  it('phiếu ngày tương lai so với mốc không làm tuổi nợ âm', async () => {
    const { service } = setup({ orders: [order(X, '2026-10-08', '500')] });
    expect((await service.congNoPhaiThu({})).items[0]).toMatchObject({
      nhom0_30: '500.00',
    });
  });
});

describe('BaoCaoKinhDoanhService.congNoPhaiTra', () => {
  const ncc = { id: 'n1', maNCC: 'NCC1', tenNCC: 'Dược Hậu Giang' };
  const receipt = (
    ngay: string,
    lines: [number, string][],
    paid: string[] = [],
  ) => ({
    ngayNhanHang: day(ngay),
    nhaCungCap: ncc,
    chiTietPhieuNhapHangs: lines.map(([soLuong, donGia]) => ({
      soLuong,
      donGia: D(donGia),
    })),
    phieuThanhToans: paid.map((p) => ({ soTien: D(p) })),
  });

  it('công nợ = Σ số lượng × đơn giá − thanh toán, xếp nhóm theo ngày nhận hàng', async () => {
    const { service } = setup({
      receipts: [
        receipt('2026-10-01', [[10, '90000']], ['300000']), // 600000, 7 days
        receipt('2026-06-01', [
          [2, '50000'],
          [1, '10000'],
        ]), // 110000, 129 days
        receipt('2026-09-01', [[1, '1000']], ['1000']), // settled
      ],
    });
    const result = await service.congNoPhaiTra({});
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      nhaCungCap: { tenNCC: 'Dược Hậu Giang' },
      nhom0_30: '600000.00',
      nhomTren90: '110000.00',
      tongConNo: '710000.00',
      soPhieuConNo: 2,
    });
    expect(result.tong.tongConNo).toBe('710000.00');
  });

  it('chỉ phiếu nhập đã nhập kho, thanh toán chưa hủy; ngày tương lai bị từ chối', async () => {
    const { service } = setup();
    await service.congNoPhaiTra({ nhaCungCapId: 'n1' });
    await expect(
      service.congNoPhaiTra({ denNgay: '2027-01-01' }),
    ).rejects.toMatchObject({
      code: 'BAO_CAO_RANGE_INVALID',
    });
  });
});
