import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { ClockService } from '../common/clock/clock.service.js';
import { addDays, formatDateOnly } from '../common/clock/vn-date.js';
import { AppException } from '../common/errors/app.exception.js';
import {
  buildMeta,
  dateRangeFilter,
  paginate,
  parseSort,
  toOrderBy,
  toSkipTake,
  type PagedResponse,
} from '../common/pagination/paginate.js';
import { appConfig } from '../config/app.config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { boundsToFilter, statusBounds } from '../so-lo/so-lo.rules.js';
import { TyLeQuyDoiService } from '../ty-le-quy-doi/ty-le-quy-doi.service.js';
import type {
  BienDongTonKhoResponseDto,
  DoiSoatResponseDto,
  GoiYXuatQueryDto,
  GoiYXuatResponseDto,
  QueryBienDongDto,
  QueryTonKhoDto,
  QueryTonKhoTongHopDto,
  TonKhoResponseDto,
  TonKhoTongHopDto,
} from './dto/ton-kho.dto.js';
import {
  bienDongInclude,
  tonKhoInclude,
  toBienDongResponse,
  toTonKhoResponse,
} from './ton-kho.mapper.js';
import {
  allocateFefo,
  summarizeByProduct,
  type LotStockRow,
} from './ton-kho.rules.js';

const SORT_WHITELIST = ['hanSuDung', 'soLuong', 'tenSP', 'updatedAt'] as const;
const TONG_HOP_SORT = ['tenSP', 'tongTon'] as const;
const MAX_SUMMARY_ROWS = 50_000;

// Read side of stock: lists, summaries, FEFO suggestion, ledger and reconciliation.
// Writes live in TonKhoService.
@Injectable()
export class TonKhoQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly units: TyLeQuyDoiService,
    private readonly clock: ClockService,
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {}

  findAll(query: QueryTonKhoDto): Promise<PagedResponse<TonKhoResponseDto>> {
    const today = this.clock.today();
    const warningDays = this.config.expiryWarningDays;
    const hanSuDung = query.trangThaiLo
      ? boundsToFilter(statusBounds(query.trangThaiLo, today, warningDays))
      : undefined;
    const where: Prisma.TonKhoWhereInput = {
      viTriId: query.viTriId,
      soLoId: query.soLoId,
      soLuong: query.conTon === false ? undefined : { gt: 0 },
      viTri: query.khoId ? { khoId: query.khoId } : undefined,
      soLo: {
        hangHoaId: query.hangHoaId,
        hanSuDung,
        hangHoa: {
          loaiHangId: query.loaiHangId,
          isCanGiuLanh: query.isCanGiuLanh,
        },
      },
      OR: query.q
        ? [
            { soLo: { tenLo: { contains: query.q } } },
            { soLo: { hangHoa: { tenSP: { contains: query.q } } } },
            { soLo: { hangHoa: { maSP: { contains: query.q } } } },
          ]
        : undefined,
    };
    const orderBy = toOrderBy(
      parseSort(query.sort, SORT_WHITELIST, [
        { field: 'hanSuDung', direction: 'asc' },
      ]),
      {
        hanSuDung: (d) => ({ soLo: { hanSuDung: d } }),
        tenSP: (d) => ({ soLo: { hangHoa: { tenSP: d } } }),
      },
    ) as Prisma.TonKhoOrderByWithRelationInput[];

    return paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.tonKho.findMany({
          where,
          orderBy,
          skip,
          take,
          include: tonKhoInclude,
        }),
      count: () => this.prisma.tonKho.count({ where }),
      map: (row) => toTonKhoResponse(row, today, warningDays),
    });
  }

  async findOne(id: string): Promise<TonKhoResponseDto> {
    const row = await this.prisma.tonKho.findUnique({
      where: { id },
      include: tonKhoInclude,
    });
    if (!row) {
      throw new AppException('TON_KHO_NOT_FOUND');
    }
    return toTonKhoResponse(
      row,
      this.clock.today(),
      this.config.expiryWarningDays,
    );
  }

  // Aggregated per product. Phase 1 aggregates in memory over the matching stock rows
  // (capped); revisit with a SQL GROUP BY if the number of stock rows grows large.
  async tongHop(
    query: QueryTonKhoTongHopDto,
  ): Promise<PagedResponse<TonKhoTongHopDto>> {
    const today = this.clock.today();
    const warnUntil = addDays(today, this.config.expiryWarningDays);
    const rows = await this.prisma.tonKho.findMany({
      where: {
        soLuong: { gt: 0 },
        viTri: query.khoId ? { khoId: query.khoId } : undefined,
        soLo: {
          hangHoa: {
            loaiHangId: query.loaiHangId,
            isCanGiuLanh: query.isCanGiuLanh,
            OR: query.q
              ? [
                  { tenSP: { contains: query.q } },
                  { maSP: { contains: query.q } },
                ]
              : undefined,
          },
        },
      },
      select: {
        soLuong: true,
        soLoId: true,
        soLo: { select: { hangHoaId: true, hanSuDung: true } },
      },
      take: MAX_SUMMARY_ROWS,
    });
    const lotRows: LotStockRow[] = rows.map((r) => ({
      hangHoaId: r.soLo.hangHoaId,
      soLoId: r.soLoId,
      soLuong: r.soLuong,
      hanSuDung: r.soLo.hanSuDung,
    }));
    const summaries = summarizeByProduct(lotRows, today, warnUntil);

    const products = await this.prisma.hangHoa.findMany({
      where: { id: { in: summaries.map((s) => s.hangHoaId) } },
      select: {
        id: true,
        maSP: true,
        tenSP: true,
        tyLeQuyDois: {
          where: { soLuongQuyDoi: 1 },
          select: { donViTinh: true },
        },
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const items: TonKhoTongHopDto[] = summaries.map((s) => {
      const p = byId.get(s.hangHoaId)!;
      return {
        hangHoa: {
          id: p.id,
          maSP: p.maSP,
          tenSP: p.tenSP,
          donViCoBan: p.tyLeQuyDois[0]?.donViTinh ?? '',
        },
        tongTon: s.tongTon,
        tonKhaDung: s.tonKhaDung,
        tonCanDate: s.tonCanDate,
        tonHetHan: s.tonHetHan,
        soLo: s.soLo,
      };
    });

    const [{ field, direction }] = parseSort(query.sort, TONG_HOP_SORT, [
      { field: 'tenSP', direction: 'asc' },
    ]);
    const dir = direction === 'desc' ? -1 : 1;
    items.sort((a, b) =>
      field === 'tongTon'
        ? (a.tongTon - b.tongTon) * dir
        : a.hangHoa.tenSP.localeCompare(b.hangHoa.tenSP, 'vi') * dir,
    );
    const { skip, take } = toSkipTake(query.page, query.pageSize);
    return {
      items: items.slice(skip, skip + take),
      meta: buildMeta(query.page, take, items.length),
    };
  }

  // FEFO suggestion. Read-only: it does not reserve anything (Q-TK-1).
  async goiYXuat(query: GoiYXuatQueryDto): Promise<GoiYXuatResponseDto> {
    const today = this.clock.today();
    const product = await this.prisma.hangHoa.findUnique({
      where: { id: query.hangHoaId },
      select: {
        id: true,
        tyLeQuyDois: {
          where: { soLuongQuyDoi: 1 },
          select: { donViTinh: true },
        },
      },
    });
    if (!product) {
      throw new AppException('HANG_HOA_NOT_FOUND');
    }
    const yeuCau = await this.units.toBase(
      query.hangHoaId,
      query.soLuong,
      query.donViTinh,
    );

    const earliest = addDays(today, this.config.minShelfLifeDaysIssue);
    const rows = await this.prisma.tonKho.findMany({
      where: {
        soLuong: { gt: 0 },
        viTri: query.khoId ? { khoId: query.khoId } : undefined,
        soLo: { hangHoaId: query.hangHoaId, hanSuDung: { gte: earliest } },
      },
      include: { soLo: true, viTri: true },
    });
    const { phanBo, thieu } = allocateFefo(
      rows.map((r) => ({
        soLoId: r.soLoId,
        viTriId: r.viTriId,
        hanSuDung: r.soLo.hanSuDung,
        soLuong: r.soLuong,
      })),
      yeuCau,
    );
    const byKey = new Map(rows.map((r) => [`${r.soLoId}|${r.viTriId}`, r]));
    return {
      hangHoaId: query.hangHoaId,
      donViCoBan: product.tyLeQuyDois[0]?.donViTinh ?? '',
      yeuCau,
      daPhanBo: yeuCau - thieu,
      thieu,
      phanBo: phanBo.map((p) => {
        const row = byKey.get(`${p.soLoId}|${p.viTriId}`)!;
        return {
          soLoId: p.soLoId,
          tenLo: row.soLo.tenLo,
          hanSuDung: formatDateOnly(p.hanSuDung),
          viTriId: p.viTriId,
          tenViTri: row.viTri.tenViTri,
          soLuong: p.phanBo,
        };
      }),
    };
  }

  bienDong(
    query: QueryBienDongDto,
  ): Promise<PagedResponse<BienDongTonKhoResponseDto>> {
    const where: Prisma.BienDongTonKhoWhereInput = {
      soLoId: query.soLoId,
      viTriId: query.viTriId,
      loai: query.loai,
      thamChieuId: query.thamChieuId,
      soLo: query.hangHoaId ? { hangHoaId: query.hangHoaId } : undefined,
      createdAt: dateRangeFilter(query.createdAtFrom, query.createdAtTo),
    };
    const orderBy = toOrderBy(
      parseSort(query.sort, ['createdAt'] as const, [
        { field: 'createdAt', direction: 'desc' },
      ]),
    ) as Prisma.BienDongTonKhoOrderByWithRelationInput[];
    return paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.bienDongTonKho.findMany({
          where,
          orderBy,
          skip,
          take,
          include: bienDongInclude,
        }),
      count: () => this.prisma.bienDongTonKho.count({ where }),
      map: toBienDongResponse,
    });
  }

  // Invariant check: for every (lot, location), stock must equal the sum of its movements.
  // Reports differences; never fixes them.
  async doiSoat(): Promise<DoiSoatResponseDto> {
    const [mismatched, orphaned, checked] = await Promise.all([
      this.prisma.$queryRaw<
        {
          soLoId: string;
          viTriId: string;
          tonKho: number;
          tongBienDong: number;
        }[]
      >`
        SELECT t.so_lo_id AS soLoId, t.vi_tri_id AS viTriId, t.so_luong AS tonKho,
               COALESCE(SUM(b.so_luong_thay_doi), 0) AS tongBienDong
        FROM ton_kho t
        LEFT JOIN bien_dong_ton_kho b ON b.so_lo_id = t.so_lo_id AND b.vi_tri_id = t.vi_tri_id
        GROUP BY t.so_lo_id, t.vi_tri_id, t.so_luong
        HAVING t.so_luong <> COALESCE(SUM(b.so_luong_thay_doi), 0)`,
      // Movements for a (lot, location) that has no stock row at all.
      this.prisma.$queryRaw<
        {
          soLoId: string;
          viTriId: string;
          tonKho: number;
          tongBienDong: number;
        }[]
      >`
        SELECT b.so_lo_id AS soLoId, b.vi_tri_id AS viTriId, 0 AS tonKho,
               SUM(b.so_luong_thay_doi) AS tongBienDong
        FROM bien_dong_ton_kho b
        LEFT JOIN ton_kho t ON t.so_lo_id = b.so_lo_id AND t.vi_tri_id = b.vi_tri_id
        WHERE t.id IS NULL
        GROUP BY b.so_lo_id, b.vi_tri_id
        HAVING SUM(b.so_luong_thay_doi) <> 0`,
      this.prisma.tonKho.count(),
    ]);
    const chiTietLech = [...mismatched, ...orphaned].map((r) => ({
      soLoId: r.soLoId,
      viTriId: r.viTriId,
      tonKho: Number(r.tonKho),
      tongBienDong: Number(r.tongBienDong),
    }));
    return {
      kiemTraLuc: this.clock.now(),
      soDongKiemTra: checked,
      soDongLech: chiTietLech.length,
      chiTietLech,
    };
  }
}
