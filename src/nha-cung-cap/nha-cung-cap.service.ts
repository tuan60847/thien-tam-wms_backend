import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { ClockService } from '../common/clock/clock.service.js';
import { parseDateOnly } from '../common/clock/vn-date.js';
import { CodeGeneratorService } from '../common/code-generator/code-generator.service.js';
import { CODE } from '../common/code-generator/code-specs.js';
import { AppException } from '../common/errors/app.exception.js';
import {
  paginate,
  parseSort,
  toOrderBy,
  type PagedResponse,
} from '../common/pagination/paginate.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateNhaCungCapDto,
  NhaCungCapResponseDto,
  QueryNhaCungCapDto,
  UpdateNhaCungCapDto,
  XacMinhNhaCungCapDto,
} from './dto/nha-cung-cap.dto.js';
import {
  nhaCungCapInclude,
  toNhaCungCapResponse,
  type NhaCungCapFull,
} from './nha-cung-cap.mapper.js';
import {
  assertCanSupply,
  assertDateOrder,
  assertVerifiable,
  licenseChanged,
} from './nha-cung-cap.rules.js';

const SORT_WHITELIST = ['maNCC', 'tenNCC', 'createdAt'] as const;

// undefined = leave as is, null = clear, string = set.
const toDate = (value: string | null | undefined) =>
  value === undefined || value === null ? value : parseDateOnly(value);

@Injectable()
export class NhaCungCapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: CodeGeneratorService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  findAll(
    query: QueryNhaCungCapDto,
  ): Promise<PagedResponse<NhaCungCapResponseDto>> {
    const today = this.clock.today();
    const where: Prisma.NhaCungCapWhereInput = {
      trangThai: query.trangThai,
      trangThaiXacMinh: query.trangThaiXacMinh,
      OR: query.q
        ? [
            { maNCC: { contains: query.q } },
            { tenNCC: { contains: query.q } },
            { SDT: { contains: query.q } },
            { tenNguoiPhuTrach: { contains: query.q } },
          ]
        : undefined,
    };
    const orderBy = toOrderBy(
      parseSort(query.sort, SORT_WHITELIST, [
        { field: 'tenNCC', direction: 'asc' },
      ]),
    ) as Prisma.NhaCungCapOrderByWithRelationInput[];

    return paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.nhaCungCap.findMany({
          where,
          orderBy,
          skip,
          take,
          include: nhaCungCapInclude,
        }),
      count: () => this.prisma.nhaCungCap.count({ where }),
      map: (row) => toNhaCungCapResponse(row, today),
    });
  }

  async findOne(id: string): Promise<NhaCungCapResponseDto> {
    return toNhaCungCapResponse(
      await this.findByIdOrThrow(id),
      this.clock.today(),
    );
  }

  async create(
    dto: CreateNhaCungCapDto,
    actor: AuthenticatedUser,
  ): Promise<NhaCungCapResponseDto> {
    const dates = this.parseDates(dto);
    assertDateOrder(dates.ngayCapGPKD, dates.ngayHetHanGPKD, 'ngayHetHanGPKD');
    assertDateOrder(
      dates.ngayCapGCNDuoc,
      dates.ngayHetHanGCNDuoc,
      'ngayHetHanGCNDuoc',
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const maNCC = await this.codes.next(CODE.NHA_CUNG_CAP, tx);
      return tx.nhaCungCap.create({
        data: {
          maNCC,
          tenNCC: dto.tenNCC,
          SDT: dto.SDT ?? null,
          diaChi: dto.diaChi ?? null,
          tenNguoiPhuTrach: dto.tenNguoiPhuTrach ?? null,
          sdtNguoiPT: dto.sdtNguoiPT ?? null,
          ghiChu: dto.ghiChu ?? null,
          soGiayPhepKinhDoanh: dto.soGiayPhepKinhDoanh ?? null,
          noiCapGPKD: dto.noiCapGPKD ?? null,
          soGCNDuDieuKienKinhDoanhDuoc:
            dto.soGCNDuDieuKienKinhDoanhDuoc ?? null,
          noiCapGCNDuoc: dto.noiCapGCNDuoc ?? null,
          ngayCapGPKD: dates.ngayCapGPKD ?? null,
          ngayHetHanGPKD: dates.ngayHetHanGPKD ?? null,
          ngayCapGCNDuoc: dates.ngayCapGCNDuoc ?? null,
          ngayHetHanGCNDuoc: dates.ngayHetHanGCNDuoc ?? null,
          createdById: actor.id,
          updatedById: actor.id,
        },
        include: nhaCungCapInclude,
      });
    });
    return toNhaCungCapResponse(created, this.clock.today());
  }

  async update(
    id: string,
    dto: UpdateNhaCungCapDto,
    actor: AuthenticatedUser,
  ): Promise<NhaCungCapResponseDto> {
    const dates = this.parseDates(dto);

    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.nhaCungCap.findUnique({ where: { id } });
      if (!current) {
        throw new AppException('NHA_CUNG_CAP_NOT_FOUND');
      }
      const pick = <K extends keyof typeof dates>(key: K) =>
        dates[key] === undefined ? current[key] : dates[key];
      assertDateOrder(
        pick('ngayCapGPKD'),
        pick('ngayHetHanGPKD'),
        'ngayHetHanGPKD',
      );
      assertDateOrder(
        pick('ngayCapGCNDuoc'),
        pick('ngayHetHanGCNDuoc'),
        'ngayHetHanGCNDuoc',
      );

      // Any real change to the licence file invalidates a previous verification or rejection.
      const resetVerification =
        current.trangThaiXacMinh !== 'chua_xac_minh' &&
        licenseChanged(current, {
          soGiayPhepKinhDoanh: dto.soGiayPhepKinhDoanh,
          noiCapGPKD: dto.noiCapGPKD,
          soGCNDuDieuKienKinhDoanhDuoc: dto.soGCNDuDieuKienKinhDoanhDuoc,
          noiCapGCNDuoc: dto.noiCapGCNDuoc,
          ...dates,
        });

      const row = await tx.nhaCungCap.update({
        where: { id },
        data: {
          tenNCC: dto.tenNCC,
          SDT: dto.SDT,
          diaChi: dto.diaChi,
          tenNguoiPhuTrach: dto.tenNguoiPhuTrach,
          sdtNguoiPT: dto.sdtNguoiPT,
          ghiChu: dto.ghiChu,
          soGiayPhepKinhDoanh: dto.soGiayPhepKinhDoanh,
          noiCapGPKD: dto.noiCapGPKD,
          soGCNDuDieuKienKinhDoanhDuoc: dto.soGCNDuDieuKienKinhDoanhDuoc,
          noiCapGCNDuoc: dto.noiCapGCNDuoc,
          ...dates,
          trangThai: dto.trangThai,
          ...(resetVerification
            ? {
                trangThaiXacMinh: 'chua_xac_minh' as const,
                xacMinhAt: null,
                xacMinhById: null,
              }
            : {}),
          updatedById: actor.id,
        },
        include: nhaCungCapInclude,
      });
      if (resetVerification) {
        await this.audit.record(
          {
            hanhDong: 'nha_cung_cap.unverify',
            doiTuong: 'nha_cung_cap',
            doiTuongId: id,
            truoc: { trangThaiXacMinh: current.trangThaiXacMinh },
            sau: { trangThaiXacMinh: 'chua_xac_minh' },
            lyDo: 'Hồ sơ giấy phép được thay đổi',
          },
          tx,
        );
      }
      return row;
    });
    return toNhaCungCapResponse(updated, this.clock.today());
  }

  async verify(
    id: string,
    dto: XacMinhNhaCungCapDto,
    actor: AuthenticatedUser,
  ): Promise<NhaCungCapResponseDto> {
    const today = this.clock.today();
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.nhaCungCap.findUnique({ where: { id } });
      if (!current) {
        throw new AppException('NHA_CUNG_CAP_NOT_FOUND');
      }
      if (dto.ketQua === 'da_xac_minh') {
        assertVerifiable(current, today);
      }
      const row = await tx.nhaCungCap.update({
        where: { id },
        data: {
          trangThaiXacMinh: dto.ketQua,
          xacMinhAt: this.clock.now(),
          xacMinhById: actor.id,
          updatedById: actor.id,
        },
        include: nhaCungCapInclude,
      });
      await this.audit.record(
        {
          hanhDong:
            dto.ketQua === 'da_xac_minh'
              ? 'nha_cung_cap.verify'
              : 'nha_cung_cap.reject',
          doiTuong: 'nha_cung_cap',
          doiTuongId: id,
          truoc: { trangThaiXacMinh: current.trangThaiXacMinh },
          sau: { trangThaiXacMinh: dto.ketQua },
          lyDo: dto.ghiChu ?? null,
        },
        tx,
      );
      return row;
    });
    return toNhaCungCapResponse(updated, today);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.nhaCungCap.findUnique({ where: { id } });
      if (!current) {
        throw new AppException('NHA_CUNG_CAP_NOT_FOUND');
      }
      const receipts = await tx.phieuNhapHang.count({
        where: { nhaCungCapId: id },
      });
      if (receipts > 0) {
        throw new AppException('NHA_CUNG_CAP_IN_USE', {
          details: { soPhieuNhap: receipts },
        });
      }
      await tx.nhaCungCap.delete({ where: { id } });
    });
  }

  // ---- used by the inbound document module --------------------------------

  async findByIdOrThrow(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<NhaCungCapFull> {
    const client = tx ?? this.prisma;
    const row = await client.nhaCungCap.findUnique({
      where: { id },
      include: nhaCungCapInclude,
    });
    if (!row) {
      throw new AppException('NHA_CUNG_CAP_NOT_FOUND');
    }
    return row;
  }

  assertCanSupply(ncc: NhaCungCapFull): void {
    assertCanSupply(ncc, this.clock.today());
  }

  private parseDates(dto: UpdateNhaCungCapDto) {
    return {
      ngayCapGPKD: toDate(dto.ngayCapGPKD),
      ngayHetHanGPKD: toDate(dto.ngayHetHanGPKD),
      ngayCapGCNDuoc: toDate(dto.ngayCapGCNDuoc),
      ngayHetHanGCNDuoc: toDate(dto.ngayHetHanGCNDuoc),
    };
  }
}
