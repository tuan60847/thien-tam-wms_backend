import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import { AppException } from '../common/errors/app.exception.js';
import {
  paginate,
  parseSort,
  toOrderBy,
  type PagedResponse,
} from '../common/pagination/paginate.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateViTriDto,
  QueryViTriDto,
  UpdateViTriDto,
  ViTriResponseDto,
} from './dto/vi-tri.dto.js';
import { toViTriResponse, type ViTriWithKho } from './kho-vi-tri.mapper.js';

const SORT_WHITELIST = ['tenViTri', 'createdAt'] as const;
const withKho = { kho: { select: { id: true, tenKho: true } } } as const;

@Injectable()
export class ViTriService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(
    query: QueryViTriDto,
  ): Promise<PagedResponse<ViTriResponseDto>> {
    const where: Prisma.ViTriWhereInput = {
      khoId: query.khoId,
      isCapDong: query.isCapDong,
      trangThai: query.trangThai,
      OR: query.q
        ? [
            { tenViTri: { contains: query.q } },
            { ghiChu: { contains: query.q } },
          ]
        : undefined,
    };
    const orderBy = toOrderBy(
      parseSort(query.sort, SORT_WHITELIST, [
        { field: 'tenViTri', direction: 'asc' },
      ]),
    ) as Prisma.ViTriOrderByWithRelationInput[];

    const page = await paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.viTri.findMany({
          where,
          orderBy,
          skip,
          take,
          include: withKho,
        }),
      count: () => this.prisma.viTri.count({ where }),
    });
    const stocked = await this.locationsWithStock(page.items.map((v) => v.id));
    return {
      items: page.items.map((v) => toViTriResponse(v, stocked.has(v.id))),
      meta: page.meta,
    };
  }

  async findOne(id: string): Promise<ViTriResponseDto> {
    const row = await this.getOrThrow(id);
    const stocked = await this.locationsWithStock([id]);
    return toViTriResponse(row, stocked.has(id));
  }

  async create(dto: CreateViTriDto): Promise<ViTriResponseDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      const kho = await tx.kho.findUnique({ where: { id: dto.khoId } });
      if (!kho) {
        throw new AppException('KHO_NOT_FOUND');
      }
      if (!kho.trangThai) {
        throw new AppException('VI_TRI_INACTIVE');
      }
      await this.assertNameFree(dto.khoId, dto.tenViTri, tx);
      return tx.viTri.create({
        data: {
          khoId: dto.khoId,
          tenViTri: dto.tenViTri,
          isCapDong: dto.isCapDong ?? false,
          ghiChu: dto.ghiChu ?? null,
        },
        include: withKho,
      });
    });
    return toViTriResponse(created, false);
  }

  async update(id: string, dto: UpdateViTriDto): Promise<ViTriResponseDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.viTri.findUnique({ where: { id } });
      if (!current) {
        throw new AppException('VI_TRI_NOT_FOUND');
      }
      if (dto.tenViTri !== undefined) {
        await this.assertNameFree(current.khoId, dto.tenViTri, tx, id);
      }
      const deactivating = dto.trangThai === false && current.trangThai;
      if (deactivating && (await this.stockCount(id, tx)) > 0) {
        throw new AppException('VI_TRI_HAS_STOCK');
      }
      const dropsCold = dto.isCapDong === false && current.isCapDong;
      if (dropsCold && (await this.coldStockCount(id, tx)) > 0) {
        throw new AppException('VI_TRI_COLD_CONFLICT');
      }

      const row = await tx.viTri.update({
        where: { id },
        data: {
          tenViTri: dto.tenViTri,
          isCapDong: dto.isCapDong,
          ghiChu: dto.ghiChu,
          trangThai: dto.trangThai,
        },
        include: withKho,
      });
      const flagsChanged =
        row.isCapDong !== current.isCapDong ||
        row.trangThai !== current.trangThai;
      if (flagsChanged) {
        await this.audit.record(
          {
            hanhDong: 'vi_tri.update',
            doiTuong: 'vi_tri',
            doiTuongId: id,
            truoc: {
              isCapDong: current.isCapDong,
              trangThai: current.trangThai,
            },
            sau: { isCapDong: row.isCapDong, trangThai: row.trangThai },
          },
          tx,
        );
      }
      return row;
    });
    const stocked = await this.locationsWithStock([id]);
    return toViTriResponse(updated, stocked.has(id));
  }

  // Only locations that never held stock can be deleted. M4/M5 extend this check with
  // stock-movement and document-line references.
  async remove(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.viTri.findUnique({ where: { id } });
      if (!current) {
        throw new AppException('VI_TRI_NOT_FOUND');
      }
      const everUsed = await tx.tonKho.count({ where: { viTriId: id } });
      if (everUsed > 0) {
        throw new AppException('VI_TRI_IN_USE');
      }
      await tx.viTri.delete({ where: { id } });
    });
  }

  // ---- used by ton-kho and the document modules ---------------------------

  async findByIdOrThrow(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ViTriWithKho> {
    const client = tx ?? this.prisma;
    const row = await client.viTri.findUnique({
      where: { id },
      include: withKho,
    });
    if (!row) {
      throw new AppException('VI_TRI_NOT_FOUND');
    }
    return row;
  }

  // A location can receive stock only while it and its warehouse are active.
  async assertReceivable(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ViTriWithKho> {
    const client = tx ?? this.prisma;
    const row = await client.viTri.findUnique({
      where: { id },
      include: { kho: { select: { id: true, tenKho: true, trangThai: true } } },
    });
    if (!row) {
      throw new AppException('VI_TRI_NOT_FOUND');
    }
    if (!row.trangThai || !row.kho.trangThai) {
      throw new AppException('VI_TRI_INACTIVE');
    }
    return row;
  }

  private async getOrThrow(id: string): Promise<ViTriWithKho> {
    return this.findByIdOrThrow(id);
  }

  private async assertNameFree(
    khoId: string,
    name: string,
    tx: Prisma.TransactionClient,
    exceptId?: string,
  ): Promise<void> {
    const other = await tx.viTri.findUnique({
      where: { khoId_tenViTri: { khoId, tenViTri: name } },
    });
    if (other && other.id !== exceptId) {
      throw new AppException('VI_TRI_NAME_TAKEN');
    }
  }

  private stockCount(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    return tx.tonKho.count({ where: { viTriId: id, soLuong: { gt: 0 } } });
  }

  // Stock of products that must stay cold.
  private coldStockCount(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    return tx.tonKho.count({
      where: {
        viTriId: id,
        soLuong: { gt: 0 },
        soLo: { hangHoa: { isCanGiuLanh: true } },
      },
    });
  }

  private async locationsWithStock(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) {
      return new Set();
    }
    const rows = await this.prisma.tonKho.findMany({
      where: { viTriId: { in: ids }, soLuong: { gt: 0 } },
      select: { viTriId: true },
      distinct: ['viTriId'],
    });
    return new Set(rows.map((r) => r.viTriId));
  }
}
