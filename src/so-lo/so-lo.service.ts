import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Prisma, SoLo } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { ClockService } from '../common/clock/clock.service.js';
import { addDays, parseDateOnly } from '../common/clock/vn-date.js';
import { AppException } from '../common/errors/app.exception.js';
import {
  paginate,
  parseSort,
  toOrderBy,
  type PagedResponse,
} from '../common/pagination/paginate.js';
import { appConfig } from '../config/app.config.js';
import { HangHoaService } from '../hang-hoa/hang-hoa.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateSoLoDto,
  QuerySoLoDto,
  SoLoDetailDto,
  SoLoResponseDto,
  UpdateSoLoDto,
} from './dto/so-lo.dto.js';
import {
  soLoInclude,
  toSoLoResponse,
  type SoLoWithHang,
} from './so-lo.mapper.js';
import {
  assertLotDates,
  assertShelfLife,
  intersectBounds,
  statusBounds,
  type DateBounds,
} from './so-lo.rules.js';

const SORT_WHITELIST = ['hanSuDung', 'tenLo', 'createdAt'] as const;

const sameDate = (a: Date | null, b: Date | null) =>
  (a?.getTime() ?? null) === (b?.getTime() ?? null);

@Injectable()
export class SoLoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hangHoa: HangHoaService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {}

  findAll(query: QuerySoLoDto): Promise<PagedResponse<SoLoResponseDto>> {
    const today = this.clock.today();
    const warningDays = this.config.expiryWarningDays;
    const range = this.hanSuDungRange(query, today);
    const where: Prisma.SoLoWhereInput = {
      hangHoaId: query.hangHoaId,
      hanSuDung:
        range.lower || range.upper
          ? { gte: range.lower, lte: range.upper }
          : undefined,
      tonKhos: query.conTon ? { some: { soLuong: { gt: 0 } } } : undefined,
      OR: query.q
        ? [
            { tenLo: { contains: query.q } },
            { hangHoa: { tenSP: { contains: query.q } } },
            { hangHoa: { maSP: { contains: query.q } } },
          ]
        : undefined,
    };
    const orderBy = toOrderBy(
      parseSort(query.sort, SORT_WHITELIST, [
        { field: 'hanSuDung', direction: 'asc' },
      ]),
    ) as Prisma.SoLoOrderByWithRelationInput[];

    return paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.soLo.findMany({
          where,
          orderBy,
          skip,
          take,
          include: soLoInclude,
        }),
      count: () => this.prisma.soLo.count({ where }),
      map: (row) => toSoLoResponse(row, today, warningDays),
    });
  }

  async findOne(id: string): Promise<SoLoDetailDto> {
    const row = await this.findByIdOrThrow(id);
    const [sum, viTri, chungTu] = await Promise.all([
      this.prisma.tonKho.aggregate({
        where: { soLoId: id },
        _sum: { soLuong: true },
      }),
      this.prisma.tonKho.count({ where: { soLoId: id, soLuong: { gt: 0 } } }),
      this.documentLineCount(id, this.prisma),
    ]);
    return Object.assign(
      toSoLoResponse(row, this.clock.today(), this.config.expiryWarningDays),
      {
        tongTon: sum._sum.soLuong ?? 0,
        soViTri: viTri,
        daPhatSinhChungTu: chungTu > 0,
      },
    );
  }

  async create(
    dto: CreateSoLoDto,
    actor: AuthenticatedUser,
  ): Promise<SoLoResponseDto> {
    const today = this.clock.today();
    const ngaySX = dto.ngaySX ? parseDateOnly(dto.ngaySX) : null;
    const hanSuDung = parseDateOnly(dto.hanSuDung);
    assertLotDates(ngaySX, hanSuDung, today);
    assertShelfLife(hanSuDung, today, 0);

    const created = await this.prisma.$transaction(async (tx) => {
      const product = await this.hangHoa.findByIdOrThrow(dto.hangHoaId, tx);
      this.hangHoa.assertReceivable(product);
      await this.assertNameFree(dto.hangHoaId, dto.tenLo, tx);
      return tx.soLo.create({
        data: {
          hangHoaId: dto.hangHoaId,
          tenLo: dto.tenLo,
          ngaySX,
          hanSuDung,
          createdById: actor.id,
          updatedById: actor.id,
        },
        include: soLoInclude,
      });
    });
    return toSoLoResponse(created, today, this.config.expiryWarningDays);
  }

  async update(
    id: string,
    dto: UpdateSoLoDto,
    actor: AuthenticatedUser,
  ): Promise<SoLoResponseDto> {
    const today = this.clock.today();
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.soLo.findUnique({ where: { id } });
      if (!current) {
        throw new AppException('SO_LO_NOT_FOUND');
      }

      const hanSuDung = dto.hanSuDung
        ? parseDateOnly(dto.hanSuDung)
        : current.hanSuDung;
      const ngaySX =
        dto.ngaySX === undefined
          ? current.ngaySX
          : dto.ngaySX === null
            ? null
            : parseDateOnly(dto.ngaySX);
      const datesChanged =
        !sameDate(hanSuDung, current.hanSuDung) ||
        !sameDate(ngaySX, current.ngaySX);
      const nameChanged =
        dto.tenLo !== undefined && dto.tenLo !== current.tenLo;

      if (datesChanged) {
        // Only the supplied manufacturing date is checked against today; an unchanged
        // historical value must not make an unrelated edit fail.
        assertLotDates(
          dto.ngaySX === undefined ? null : ngaySX,
          hanSuDung,
          today,
        );
        if (ngaySX && hanSuDung.getTime() <= ngaySX.getTime()) {
          throw new AppException('SO_LO_DATE_INVALID');
        }
        if ((await this.issuedLineCount(id, tx)) > 0) {
          throw new AppException('SO_LO_EXPIRY_LOCKED');
        }
        const movements = await tx.bienDongTonKho.count({
          where: { soLoId: id },
        });
        if (movements > 0 && !dto.lyDo) {
          throw new AppException('VALIDATION_FAILED', {
            details: [
              {
                field: 'lyDo',
                messages: [
                  'Cần nhập lý do khi đổi hạn sử dụng của lô đã có biến động tồn',
                ],
              },
            ],
          });
        }
      }
      if (nameChanged) {
        if (await this.hasHistory(id, tx)) {
          throw new AppException('SO_LO_IN_USE');
        }
        await this.assertNameFree(current.hangHoaId, dto.tenLo!, tx, id);
      }

      const row = await tx.soLo.update({
        where: { id },
        data: {
          tenLo: nameChanged ? dto.tenLo : undefined,
          ngaySX: datesChanged ? ngaySX : undefined,
          hanSuDung: datesChanged ? hanSuDung : undefined,
          updatedById: actor.id,
        },
        include: soLoInclude,
      });
      if (datesChanged) {
        await this.audit.record(
          {
            hanhDong: 'so_lo.expiry_change',
            doiTuong: 'so_lo',
            doiTuongId: id,
            truoc: {
              ngaySX: current.ngaySX?.toISOString().slice(0, 10) ?? null,
              hanSuDung: current.hanSuDung.toISOString().slice(0, 10),
            },
            sau: {
              ngaySX: ngaySX?.toISOString().slice(0, 10) ?? null,
              hanSuDung: hanSuDung.toISOString().slice(0, 10),
            },
            lyDo: dto.lyDo ?? null,
          },
          tx,
        );
      }
      return row;
    });
    return toSoLoResponse(updated, today, this.config.expiryWarningDays);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.soLo.findUnique({ where: { id } });
      if (!current) {
        throw new AppException('SO_LO_NOT_FOUND');
      }
      if (await this.hasHistory(id, tx)) {
        throw new AppException('SO_LO_IN_USE');
      }
      await tx.soLo.delete({ where: { id } });
    });
  }

  // ---- used by ton-kho and the document modules ---------------------------

  async findByIdOrThrow(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SoLoWithHang> {
    const client = tx ?? this.prisma;
    const row = await client.soLo.findUnique({
      where: { id },
      include: soLoInclude,
    });
    if (!row) {
      throw new AppException('SO_LO_NOT_FOUND');
    }
    return row;
  }

  findManyByIds(
    ids: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<SoLoWithHang[]> {
    return (tx ?? this.prisma).soLo.findMany({
      where: { id: { in: ids } },
      include: soLoInclude,
    });
  }

  // Receiving: expired lots are refused; optionally a minimum remaining shelf life too.
  assertReceivable(soLo: Pick<SoLo, 'hanSuDung'>): void {
    assertShelfLife(
      soLo.hanSuDung,
      this.clock.today(),
      this.config.minShelfLifeDaysReceive,
    );
  }

  // Issuing is judged on hanSuDung, never on the cached SoLo.trangThai column.
  assertIssuable(soLo: Pick<SoLo, 'hanSuDung'>): void {
    assertShelfLife(
      soLo.hanSuDung,
      this.clock.today(),
      this.config.minShelfLifeDaysIssue,
    );
  }

  // Gets the lot (hangHoaId, tenLo) or creates it. An existing lot must agree on the dates:
  // silently changing an expiry date through a receipt would be dangerous.
  async resolveOrCreate(
    input: {
      hangHoaId: string;
      tenLo: string;
      ngaySX?: Date | null;
      hanSuDung: Date;
    },
    actor: AuthenticatedUser,
    tx: Prisma.TransactionClient,
  ): Promise<SoLoWithHang> {
    const existing = await tx.soLo.findUnique({
      where: {
        hangHoaId_tenLo: { hangHoaId: input.hangHoaId, tenLo: input.tenLo },
      },
      include: soLoInclude,
    });
    if (existing) {
      const sameExpiry = sameDate(existing.hanSuDung, input.hanSuDung);
      const sameMfg =
        input.ngaySX === undefined || sameDate(existing.ngaySX, input.ngaySX);
      if (!sameExpiry || !sameMfg) {
        throw new AppException('SO_LO_DATE_INVALID');
      }
      return existing;
    }
    assertLotDates(input.ngaySX, input.hanSuDung, this.clock.today());
    return tx.soLo.create({
      data: {
        hangHoaId: input.hangHoaId,
        tenLo: input.tenLo,
        ngaySX: input.ngaySX ?? null,
        hanSuDung: input.hanSuDung,
        createdById: actor.id,
        updatedById: actor.id,
      },
      include: soLoInclude,
    });
  }

  // Refreshes the cached SoLo.trangThai column (used for fast filtering/reports).
  // Only rows that actually change are touched, so running it twice changes 0 rows.
  async refreshExpiryStatuses(): Promise<{
    conHan: number;
    canDate: number;
    hetHan: number;
  }> {
    const today = this.clock.today();
    const warnUntil = addDays(today, this.config.expiryWarningDays);
    const [hetHan, canDate, conHan] = await Promise.all([
      this.prisma.soLo.updateMany({
        where: { hanSuDung: { lt: today }, trangThai: { not: 'het_han' } },
        data: { trangThai: 'het_han' },
      }),
      this.prisma.soLo.updateMany({
        where: {
          hanSuDung: { gte: today, lte: warnUntil },
          trangThai: { not: 'can_date' },
        },
        data: { trangThai: 'can_date' },
      }),
      this.prisma.soLo.updateMany({
        where: { hanSuDung: { gt: warnUntil }, trangThai: { not: 'con_han' } },
        data: { trangThai: 'con_han' },
      }),
    ]);
    return {
      hetHan: hetHan.count,
      canDate: canDate.count,
      conHan: conHan.count,
    };
  }

  // ---- helpers --------------------------------------------------------------

  private hanSuDungRange(query: QuerySoLoDto, today: Date): DateBounds {
    const status = query.trangThai
      ? statusBounds(query.trangThai, today, this.config.expiryWarningDays)
      : {};
    return intersectBounds(status, {
      lower: query.hanSuDungFrom
        ? parseDateOnly(query.hanSuDungFrom)
        : undefined,
      upper: query.hanSuDungTo ? parseDateOnly(query.hanSuDungTo) : undefined,
    });
  }

  private async assertNameFree(
    hangHoaId: string,
    tenLo: string,
    tx: Prisma.TransactionClient,
    exceptId?: string,
  ): Promise<void> {
    const other = await tx.soLo.findUnique({
      where: { hangHoaId_tenLo: { hangHoaId, tenLo } },
    });
    if (other && other.id !== exceptId) {
      throw new AppException('SO_LO_NAME_TAKEN');
    }
  }

  // Lines of issues that already left the warehouse (their expiry check was relied on).
  private issuedLineCount(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    return tx.chiTietPhieuXuatHang.count({
      where: {
        soLoId: id,
        phieuXuatHang: { trangThai: { in: ['da_xuat_kho', 'da_giao'] } },
      },
    });
  }

  private async documentLineCount(
    id: string,
    client: Prisma.TransactionClient | PrismaService,
  ): Promise<number> {
    const [nhap, xuat] = await Promise.all([
      client.chiTietPhieuNhapHang.count({ where: { soLoId: id } }),
      client.chiTietPhieuXuatHang.count({ where: { soLoId: id } }),
    ]);
    return nhap + xuat;
  }

  // A lot with any stock row, movement or document line cannot be renamed or deleted.
  private async hasHistory(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    const [stock, movements, lines] = await Promise.all([
      tx.tonKho.count({ where: { soLoId: id } }),
      tx.bienDongTonKho.count({ where: { soLoId: id } }),
      this.documentLineCount(id, tx),
    ]);
    return stock + movements + lines > 0;
  }
}
