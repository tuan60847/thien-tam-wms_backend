import { Injectable } from '@nestjs/common';
import type { KhachHang, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { ClockService } from '../common/clock/clock.service.js';
import { addDays, parseDateOnly } from '../common/clock/vn-date.js';
import { CodeGeneratorService } from '../common/code-generator/code-generator.service.js';
import { CODE } from '../common/code-generator/code-specs.js';
import { AppException } from '../common/errors/app.exception.js';
import { LICENSE_WARNING_DAYS } from '../common/license-status.js';
import {
  paginate,
  parseSort,
  toOrderBy,
  type PagedResponse,
} from '../common/pagination/paginate.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateKhachHangDto,
  GiayPhep,
  KhachHangResponseDto,
  QueryKhachHangDto,
  UpdateKhachHangDto,
} from './dto/khach-hang.dto.js';
import { toKhachHangResponse } from './khach-hang.mapper.js';
import { assertCanBuy, assertLicenseDates } from './khach-hang.rules.js';

const SORT_WHITELIST = [
  'maKH',
  'tenKH',
  'createdAt',
  'ngayHetHanGPKD',
] as const;

// undefined = leave as is, null = clear, string = set.
const toDate = (value: string | null | undefined) =>
  value === undefined || value === null ? value : parseDateOnly(value);

@Injectable()
export class KhachHangService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: CodeGeneratorService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  findAll(
    query: QueryKhachHangDto,
  ): Promise<PagedResponse<KhachHangResponseDto>> {
    const today = this.clock.today();
    const where: Prisma.KhachHangWhereInput = {
      trangThai: query.trangThai,
      ngayHetHanGPKD: this.licenseFilter(query.giayPhep, today),
      OR: query.q
        ? [
            { maKH: { contains: query.q } },
            { tenKH: { contains: query.q } },
            { maSoThue: { contains: query.q } },
            { SDT: { contains: query.q } },
            { nguoiDaiDien: { contains: query.q } },
          ]
        : undefined,
    };
    const orderBy = toOrderBy(
      parseSort(query.sort, SORT_WHITELIST, [
        { field: 'tenKH', direction: 'asc' },
      ]),
    ) as Prisma.KhachHangOrderByWithRelationInput[];

    return paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.khachHang.findMany({ where, orderBy, skip, take }),
      count: () => this.prisma.khachHang.count({ where }),
      map: (row) => toKhachHangResponse(row, today),
    });
  }

  async findOne(id: string): Promise<KhachHangResponseDto> {
    return toKhachHangResponse(
      await this.findByIdOrThrow(id),
      this.clock.today(),
    );
  }

  async create(
    dto: CreateKhachHangDto,
    actor: AuthenticatedUser,
  ): Promise<KhachHangResponseDto> {
    const ngayCap = toDate(dto.ngayCapGPKD);
    const ngayHetHan = toDate(dto.ngayHetHanGPKD);
    assertLicenseDates(ngayCap, ngayHetHan);

    const created = await this.prisma.$transaction(async (tx) => {
      if (dto.maSoThue) {
        await this.assertTaxCodeFree(dto.maSoThue, tx);
      }
      const maKH = await this.codes.next(CODE.KHACH_HANG, tx);
      return tx.khachHang.create({
        data: {
          maKH,
          tenKH: dto.tenKH,
          diaChi: dto.diaChi ?? null,
          maSoThue: dto.maSoThue ?? null,
          email: dto.email ?? null,
          SDT: dto.SDT ?? null,
          nguoiDaiDien: dto.nguoiDaiDien ?? null,
          SDTNDD: dto.SDTNDD ?? null,
          soGiayPhepKinhDoanh: dto.soGiayPhepKinhDoanh ?? null,
          ngayCapGPKD: ngayCap ?? null,
          ngayHetHanGPKD: ngayHetHan ?? null,
          createdById: actor.id,
          updatedById: actor.id,
        },
      });
    });
    return toKhachHangResponse(created, this.clock.today());
  }

  async update(
    id: string,
    dto: UpdateKhachHangDto,
    actor: AuthenticatedUser,
  ): Promise<KhachHangResponseDto> {
    const ngayCap = toDate(dto.ngayCapGPKD);
    const ngayHetHan = toDate(dto.ngayHetHanGPKD);

    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.khachHang.findUnique({ where: { id } });
      if (!current) {
        throw new AppException('KHACH_HANG_NOT_FOUND');
      }
      assertLicenseDates(
        ngayCap === undefined ? current.ngayCapGPKD : ngayCap,
        ngayHetHan === undefined ? current.ngayHetHanGPKD : ngayHetHan,
      );
      if (dto.maSoThue && dto.maSoThue !== current.maSoThue) {
        await this.assertTaxCodeFree(dto.maSoThue, tx, id);
      }

      const row = await tx.khachHang.update({
        where: { id },
        data: {
          tenKH: dto.tenKH,
          diaChi: dto.diaChi,
          maSoThue: dto.maSoThue,
          email: dto.email,
          SDT: dto.SDT,
          nguoiDaiDien: dto.nguoiDaiDien,
          SDTNDD: dto.SDTNDD,
          soGiayPhepKinhDoanh: dto.soGiayPhepKinhDoanh,
          ngayCapGPKD: ngayCap,
          ngayHetHanGPKD: ngayHetHan,
          trangThai: dto.trangThai,
          updatedById: actor.id,
        },
      });
      if (dto.trangThai !== undefined && dto.trangThai !== current.trangThai) {
        await this.audit.record(
          {
            hanhDong: 'khach_hang.status_change',
            doiTuong: 'khach_hang',
            doiTuongId: id,
            truoc: { trangThai: current.trangThai },
            sau: { trangThai: row.trangThai },
          },
          tx,
        );
      }
      return row;
    });
    return toKhachHangResponse(updated, this.clock.today());
  }

  async remove(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.khachHang.findUnique({ where: { id } });
      if (!current) {
        throw new AppException('KHACH_HANG_NOT_FOUND');
      }
      const orders = await tx.phieuXuatHang.count({
        where: { khachHangId: id },
      });
      if (orders > 0) {
        throw new AppException('KHACH_HANG_IN_USE', {
          details: { soPhieuXuat: orders },
        });
      }
      await tx.khachHang.delete({ where: { id } });
    });
  }

  // ---- used by the outbound document module -------------------------------

  async findByIdOrThrow(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<KhachHang> {
    const client = tx ?? this.prisma;
    const row = await client.khachHang.findUnique({ where: { id } });
    if (!row) {
      throw new AppException('KHACH_HANG_NOT_FOUND');
    }
    return row;
  }

  assertCanBuy(khachHang: KhachHang): void {
    assertCanBuy(khachHang, this.clock.today());
  }

  // Filter on the expiry date instead of a stored status, so it is always current.
  private licenseFilter(
    status: GiayPhep | undefined,
    today: Date,
  ): Prisma.DateTimeNullableFilter | null | undefined {
    const warnUntil = addDays(today, LICENSE_WARNING_DAYS);
    switch (status) {
      case 'het_han':
        return { lt: today };
      case 'sap_het_han':
        return { gte: today, lte: warnUntil };
      case 'con_han':
        return { gt: warnUntil };
      case 'chua_khai_bao':
        return null;
      default:
        return undefined;
    }
  }

  private async assertTaxCodeFree(
    maSoThue: string,
    tx: Prisma.TransactionClient,
    exceptId?: string,
  ): Promise<void> {
    const other = await tx.khachHang.findUnique({ where: { maSoThue } });
    if (other && other.id !== exceptId) {
      throw new AppException('KHACH_HANG_TAX_CODE_TAKEN');
    }
  }
}
