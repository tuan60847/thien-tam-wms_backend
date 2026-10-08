import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { ClockService } from '../common/clock/clock.service.js';
import { addDays, formatDateOnly } from '../common/clock/vn-date.js';
import { moneyString, ZERO } from '../common/money.js';
import {
  parseSort,
  toOrderBy,
  type PagedResponse,
} from '../common/pagination/paginate.js';
import { appConfig } from '../config/app.config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  boundsToFilter,
  computeStatus,
  daysLeft,
  statusBounds,
} from '../so-lo/so-lo.rules.js';
import type {
  BaoCaoCanDateQueryDto,
  BaoCaoHetHanQueryDto,
  BaoCaoNhapXuatTonQueryDto,
  BaoCaoNhapXuatTonResponseDto,
  BaoCaoHanDungTongDto,
  BaoCaoTheoLoItemDto,
  BaoCaoTheoLoQueryDto,
  BaoCaoTonKhoItemDto,
  BaoCaoTonKhoQueryDto,
  BaoCaoTonKhoResponseDto,
  NhapXuatTonItemDto,
} from './dto/bao-cao.dto.js';
import {
  assertGroupCount,
  type RawNumber,
  canSeeValues,
  classifyLot,
  closingStock,
  MAX_ROWS,
  toDecimal,
  toInt,
  toUtcRange,
  type NxtRow,
} from './bao-cao.rules.js';

const stockInclude = {
  soLo: { include: { hangHoa: { include: { loaiHang: true } } } },
  viTri: { include: { kho: { select: { id: true, tenKho: true } } } },
} as const satisfies Prisma.TonKhoInclude;

type StockRow = Prisma.TonKhoGetPayload<{ include: typeof stockInclude }>;

export type HanDungResponse = PagedResponse<BaoCaoTheoLoItemDto> & {
  tong: BaoCaoHanDungTongDto;
};

// Stock-side reports (read only): current stock, lots, expiry and the movement ledger.
@Injectable()
export class BaoCaoKhoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {}

  // ---------------------------------------------------------------------------
  // Tồn kho (grouped)
  // ---------------------------------------------------------------------------

  async tonKho(
    query: BaoCaoTonKhoQueryDto,
    role: string | undefined,
  ): Promise<BaoCaoTonKhoResponseDto> {
    const today = this.clock.today();
    const warnUntil = addDays(today, this.config.expiryWarningDays);
    const groupBy = query.groupBy ?? 'hang-hoa';
    const rows = await this.prisma.tonKho.findMany({
      where: {
        soLuong: query.chiConTon === false ? undefined : { gt: 0 },
        viTri: query.khoId ? { khoId: query.khoId } : undefined,
        soLo: {
          hangHoaId: query.hangHoaId,
          hangHoa: {
            loaiHangId: query.loaiHangId,
            isCanGiuLanh: query.isCanGiuLanh,
          },
        },
      },
      include: stockInclude,
      take: MAX_ROWS,
    });
    const costs = await this.lotCosts(rows.map((r) => r.soLoId));
    const showValues = canSeeValues(role);

    const groups = new Map<
      string,
      BaoCaoTonKhoItemDto & { lots: Set<string>; value: Prisma.Decimal }
    >();
    for (const row of rows) {
      const nhom = this.groupOf(row, groupBy);
      const entry = groups.get(nhom.id) ?? {
        nhom,
        donViCoBan: null,
        tongTon: 0,
        tonKhaDung: 0,
        tonCanDate: 0,
        tonHetHan: 0,
        soLo: 0,
        thieuGiaVon: false,
        lots: new Set<string>(),
        value: ZERO,
      };
      entry.tongTon += row.soLuong;
      const kind = classifyLot(row.soLo.hanSuDung, today, warnUntil);
      if (kind === 'het_han') {
        entry.tonHetHan += row.soLuong;
      } else {
        entry.tonKhaDung += row.soLuong;
        if (kind === 'can_date') entry.tonCanDate += row.soLuong;
      }
      entry.lots.add(row.soLoId);
      const cost = costs.get(row.soLoId);
      if (cost) {
        entry.value = entry.value.plus(cost.mul(row.soLuong));
      } else if (row.soLuong > 0) {
        entry.thieuGiaVon = true;
      }
      groups.set(nhom.id, entry);
    }
    assertGroupCount(groups.size);

    const units =
      groupBy === 'hang-hoa' ? await this.baseUnits([...groups.keys()]) : null;
    const items = [...groups.values()]
      .map(({ lots, value, ...item }) => ({
        ...item,
        donViCoBan: units?.get(item.nhom.id) ?? null,
        soLo: lots.size,
        ...(showValues ? { giaTriTon: moneyString(value) } : {}),
        thieuGiaVon: showValues ? item.thieuGiaVon : undefined,
      }))
      .sort((a, b) => a.nhom.ten.localeCompare(b.nhom.ten, 'vi'));
    const totalValue = [...groups.values()].reduce(
      (s, g) => s.plus(g.value),
      ZERO,
    );
    return {
      items,
      tong: {
        tongTon: items.reduce((s, i) => s + i.tongTon, 0),
        ...(showValues ? { giaTriTon: moneyString(totalValue) } : {}),
      },
      generatedAt: this.clock.now(),
    };
  }

  // ---------------------------------------------------------------------------
  // Tồn theo lô / cận date / hết hạn
  // ---------------------------------------------------------------------------

  tonKhoTheoLo(
    query: BaoCaoTheoLoQueryDto,
    role: string | undefined,
  ): Promise<PagedResponse<BaoCaoTheoLoItemDto>> {
    const today = this.clock.today();
    const warningDays = this.config.expiryWarningDays;
    const where: Prisma.TonKhoWhereInput = {
      soLuong: query.conTon === false ? undefined : { gt: 0 },
      viTri: query.khoId ? { khoId: query.khoId } : undefined,
      soLo: {
        hangHoaId: query.hangHoaId,
        hanSuDung: query.trangThaiLo
          ? boundsToFilter(statusBounds(query.trangThaiLo, today, warningDays))
          : undefined,
      },
    };
    const orderBy = toOrderBy(
      parseSort(query.sort, ['hanSuDung', 'tenSP', 'soLuong'] as const, [
        { field: 'hanSuDung', direction: 'asc' },
      ]),
      {
        hanSuDung: (d) => ({ soLo: { hanSuDung: d } }),
        tenSP: (d) => ({ soLo: { hangHoa: { tenSP: d } } }),
      },
    ) as Prisma.TonKhoOrderByWithRelationInput[];
    return this.pagedLots(where, orderBy, query, role);
  }

  async canDate(
    query: BaoCaoCanDateQueryDto,
    role: string | undefined,
  ): Promise<HanDungResponse> {
    const today = this.clock.today();
    const until = addDays(today, query.soNgay ?? this.config.expiryWarningDays);
    return this.expiryReport({ gte: today, lte: until }, query, 'asc', role);
  }

  async hetHan(
    query: BaoCaoHetHanQueryDto,
    role: string | undefined,
  ): Promise<HanDungResponse> {
    return this.expiryReport({ lt: this.clock.today() }, query, 'desc', role);
  }

  private async expiryReport(
    hanSuDung: Prisma.DateTimeFilter,
    query: BaoCaoCanDateQueryDto | BaoCaoHetHanQueryDto,
    defaultDirection: 'asc' | 'desc',
    role: string | undefined,
  ): Promise<HanDungResponse> {
    const where: Prisma.TonKhoWhereInput = {
      soLuong: { gt: 0 },
      viTri: query.khoId ? { khoId: query.khoId } : undefined,
      soLo: {
        hanSuDung,
        hangHoaId: query.hangHoaId,
        hangHoa: { loaiHangId: query.loaiHangId },
      },
    };
    const orderBy = toOrderBy(
      parseSort(query.sort, ['hanSuDung'] as const, [
        { field: 'hanSuDung', direction: defaultDirection },
      ]),
      { hanSuDung: (d) => ({ soLo: { hanSuDung: d } }) },
    ) as Prisma.TonKhoOrderByWithRelationInput[];

    const [page, all] = await Promise.all([
      this.pagedLots(where, orderBy, query, role),
      this.prisma.tonKho.findMany({
        where,
        select: { soLoId: true, soLuong: true },
        take: MAX_ROWS,
      }),
    ]);
    const showValues = canSeeValues(role);
    const costs = showValues
      ? await this.lotCosts(all.map((r) => r.soLoId))
      : null;
    const tong: BaoCaoHanDungTongDto = {
      soLo: new Set(all.map((r) => r.soLoId)).size,
      tongSoLuong: all.reduce((s, r) => s + r.soLuong, 0),
    };
    if (costs) {
      tong.tongGiaTri = moneyString(
        all.reduce(
          (s, r) => s.plus((costs.get(r.soLoId) ?? ZERO).mul(r.soLuong)),
          ZERO,
        ),
      );
    }
    return { ...page, tong };
  }

  private async pagedLots(
    where: Prisma.TonKhoWhereInput,
    orderBy: Prisma.TonKhoOrderByWithRelationInput[],
    query: { page: number; pageSize: number },
    role: string | undefined,
  ): Promise<PagedResponse<BaoCaoTheoLoItemDto>> {
    const today = this.clock.today();
    const warningDays = this.config.expiryWarningDays;
    const showValues = canSeeValues(role);
    const rows = await this.prisma.tonKho.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * Math.min(query.pageSize, 100),
      take: Math.min(query.pageSize, 100),
      include: stockInclude,
    });
    const total = await this.prisma.tonKho.count({ where });
    const [costs, units] = await Promise.all([
      showValues ? this.lotCosts(rows.map((r) => r.soLoId)) : null,
      this.baseUnits(rows.map((r) => r.soLo.hangHoaId)),
    ]);
    const size = Math.min(query.pageSize, 100);
    const items = rows.map((row): BaoCaoTheoLoItemDto => {
      const cost = costs?.get(row.soLoId) ?? null;
      return {
        soLo: {
          id: row.soLo.id,
          tenLo: row.soLo.tenLo,
          hanSuDung: formatDateOnly(row.soLo.hanSuDung),
          trangThai: computeStatus(row.soLo.hanSuDung, today, warningDays),
          soNgayConLai: daysLeft(row.soLo.hanSuDung, today),
        },
        hangHoa: {
          id: row.soLo.hangHoa.id,
          maSP: row.soLo.hangHoa.maSP,
          tenSP: row.soLo.hangHoa.tenSP,
          donViCoBan: units.get(row.soLo.hangHoaId) ?? null,
        },
        viTri: {
          id: row.viTri.id,
          tenViTri: row.viTri.tenViTri,
          kho: row.viTri.kho,
        },
        soLuong: row.soLuong,
        ...(showValues
          ? {
              giaVonCoBan: cost ? moneyString(cost) : null,
              giaTri: cost ? moneyString(cost.mul(row.soLuong)) : null,
            }
          : {}),
      };
    });
    return {
      items,
      meta: {
        page: query.page,
        pageSize: size,
        total,
        totalPages: Math.ceil(total / size),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Nhập - xuất - tồn (from the movement ledger)
  // ---------------------------------------------------------------------------

  async nhapXuatTon(
    query: BaoCaoNhapXuatTonQueryDto,
  ): Promise<BaoCaoNhapXuatTonResponseDto> {
    const { start, endExclusive } = toUtcRange(query.tuNgay, query.denNgay);
    const sum = (condition: Prisma.Sql) =>
      Prisma.sql`COALESCE(SUM(CASE WHEN ${condition} THEN b.so_luong_thay_doi ELSE 0 END), 0)`;
    const inPeriod = Prisma.sql`b.created_at >= ${start} AND b.created_at < ${endExclusive}`;
    const of = (...kinds: string[]) =>
      sum(Prisma.sql`${inPeriod} AND b.loai IN (${Prisma.join(kinds)})`);

    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        ma_sp: string;
        ten_sp: string;
        ton_dau: RawNumber;
        nhap: RawNumber;
        xuat: RawNumber;
        huy_nhap: RawNumber;
        huy_xuat: RawNumber;
        tra_hang: RawNumber;
        dieu_chinh: RawNumber;
        chuyen: RawNumber;
      }[]
    >`
      SELECT h.id, h.ma_sp, h.ten_sp,
        ${sum(Prisma.sql`b.created_at < ${start}`)} AS ton_dau,
        ${of('nhap_kho')} AS nhap,
        ${of('xuat_kho')} AS xuat,
        ${of('huy_nhap')} AS huy_nhap,
        ${of('huy_xuat')} AS huy_xuat,
        ${of('tra_hang')} AS tra_hang,
        ${of('dieu_chinh')} AS dieu_chinh,
        ${of('chuyen_di', 'chuyen_den')} AS chuyen
      FROM bien_dong_ton_kho b
      JOIN so_lo s ON s.id = b.so_lo_id
      JOIN hang_hoa h ON h.id = s.hang_hoa_id
      JOIN vi_tri v ON v.id = b.vi_tri_id
      WHERE b.created_at < ${endExclusive}
        ${query.khoId ? Prisma.sql`AND v.kho_id = ${query.khoId}` : Prisma.empty}
        ${query.loaiHangId ? Prisma.sql`AND h.loai_hang_id = ${query.loaiHangId}` : Prisma.empty}
        ${query.hangHoaId ? Prisma.sql`AND h.id = ${query.hangHoaId}` : Prisma.empty}
      GROUP BY h.id, h.ma_sp, h.ten_sp
      ORDER BY h.ten_sp ASC`;

    const units = await this.baseUnits(rows.map((r) => r.id));
    const items: NhapXuatTonItemDto[] = [];
    for (const r of rows) {
      const line: NxtRow = {
        tonDau: toInt(r.ton_dau),
        nhap: toInt(r.nhap),
        xuat: toInt(r.xuat),
        huyNhap: toInt(r.huy_nhap),
        huyXuat: toInt(r.huy_xuat),
        traHang: toInt(r.tra_hang),
        dieuChinh: toInt(r.dieu_chinh),
        chuyenRong: toInt(r.chuyen),
      };
      const moved = Object.values(line).some((v) => v !== 0);
      if (!moved) {
        continue;
      }
      items.push({
        hangHoa: {
          id: r.id,
          maSP: r.ma_sp,
          tenSP: r.ten_sp,
          donViCoBan: units.get(r.id) ?? null,
        },
        ...line,
        tonCuoi: closingStock(line),
      });
    }
    assertGroupCount(items.length);

    const tong = items.reduce(
      (t, i) => ({
        tonDau: t.tonDau + i.tonDau,
        nhap: t.nhap + i.nhap,
        xuat: t.xuat + i.xuat,
        huyNhap: t.huyNhap + i.huyNhap,
        huyXuat: t.huyXuat + i.huyXuat,
        traHang: t.traHang + i.traHang,
        dieuChinh: t.dieuChinh + i.dieuChinh,
        chuyenRong: t.chuyenRong + i.chuyenRong,
        tonCuoi: t.tonCuoi + i.tonCuoi,
      }),
      {
        tonDau: 0,
        nhap: 0,
        xuat: 0,
        huyNhap: 0,
        huyXuat: 0,
        traHang: 0,
        dieuChinh: 0,
        chuyenRong: 0,
        tonCuoi: 0,
      },
    );
    return {
      items,
      tong,
      kyBaoCao: { tuNgay: query.tuNgay, denNgay: query.denNgay },
      generatedAt: this.clock.now(),
    };
  }

  // ---------------------------------------------------------------------------
  // helpers
  // ---------------------------------------------------------------------------

  private groupOf(row: StockRow, groupBy: 'hang-hoa' | 'kho' | 'loai-hang') {
    switch (groupBy) {
      case 'kho':
        return { id: row.viTri.kho.id, ten: row.viTri.kho.tenKho, ma: null };
      case 'loai-hang':
        return {
          id: row.soLo.hangHoa.loaiHang.id,
          ten: row.soLo.hangHoa.loaiHang.tenLoaiHang,
          ma: null,
        };
      default:
        return {
          id: row.soLo.hangHoa.id,
          ten: row.soLo.hangHoa.tenSP,
          ma: row.soLo.hangHoa.maSP,
        };
    }
  }

  // Weighted-average purchase cost per base unit of each lot, from confirmed receipts.
  // Lots with no confirmed receipt (e.g. stock created by an adjustment) have no entry.
  private async lotCosts(
    soLoIds: string[],
  ): Promise<Map<string, Prisma.Decimal>> {
    const ids = [...new Set(soLoIds)];
    const costs = new Map<string, Prisma.Decimal>();
    if (ids.length === 0) {
      return costs;
    }
    const rows = await this.prisma.$queryRaw<
      { so_lo_id: string; amount: RawNumber; units: RawNumber }[]
    >`
      SELECT c.so_lo_id,
             SUM(c.so_luong * c.don_gia) AS amount,
             SUM(c.so_luong_co_ban) AS units
      FROM chi_tiet_phieu_nhap_hang c
      JOIN phieu_nhap_hang p ON p.id = c.phieu_nhap_hang_id AND p.trang_thai = 'da_nhap_kho'
      WHERE c.so_lo_id IN (${Prisma.join(ids)})
      GROUP BY c.so_lo_id`;
    for (const row of rows) {
      const units = toDecimal(row.units);
      if (units.gt(0)) {
        costs.set(row.so_lo_id, toDecimal(row.amount).div(units));
      }
    }
    return costs;
  }

  private async baseUnits(hangHoaIds: string[]): Promise<Map<string, string>> {
    const units = await this.prisma.tyLeQuyDoi.findMany({
      where: { hangHoaId: { in: [...new Set(hangHoaIds)] }, soLuongQuyDoi: 1 },
      select: { hangHoaId: true, donViTinh: true },
    });
    return new Map(units.map((u) => [u.hangHoaId, u.donViTinh]));
  }
}
