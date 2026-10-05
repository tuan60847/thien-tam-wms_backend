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
  CreateKhoDto,
  KhoResponseDto,
  QueryKhoDto,
  UpdateKhoDto,
} from './dto/kho.dto.js';
import { toKhoResponse } from './kho-vi-tri.mapper.js';

const SORT_WHITELIST = ['tenKho', 'createdAt'] as const;
const withCount = { _count: { select: { viTris: true } } } as const;

@Injectable()
export class KhoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: QueryKhoDto): Promise<PagedResponse<KhoResponseDto>> {
    const where: Prisma.KhoWhereInput = {
      trangThai: query.trangThai,
      OR: query.q
        ? [{ tenKho: { contains: query.q } }, { diaChi: { contains: query.q } }]
        : undefined,
    };
    const orderBy = toOrderBy(
      parseSort(query.sort, SORT_WHITELIST, [
        { field: 'tenKho', direction: 'asc' },
      ]),
    ) as Prisma.KhoOrderByWithRelationInput[];

    const page = await paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.kho.findMany({
          where,
          orderBy,
          skip,
          take,
          include: withCount,
        }),
      count: () => this.prisma.kho.count({ where }),
    });
    const stocked = await this.warehousesWithStock(page.items.map((k) => k.id));
    return {
      items: page.items.map((k) => toKhoResponse(k, stocked.has(k.id))),
      meta: page.meta,
    };
  }

  async findOne(id: string): Promise<KhoResponseDto> {
    const row = await this.getOrThrow(id);
    const stocked = await this.warehousesWithStock([id]);
    return toKhoResponse(row, stocked.has(id));
  }

  async create(dto: CreateKhoDto): Promise<KhoResponseDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      await this.assertNameFree(dto.tenKho, tx);
      return tx.kho.create({
        data: { tenKho: dto.tenKho, diaChi: dto.diaChi ?? null },
        include: withCount,
      });
    });
    return toKhoResponse(created, false);
  }

  async update(id: string, dto: UpdateKhoDto): Promise<KhoResponseDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.kho.findUnique({ where: { id } });
      if (!current) {
        throw new AppException('KHO_NOT_FOUND');
      }
      if (dto.tenKho !== undefined) {
        await this.assertNameFree(dto.tenKho, tx, id);
      }
      const deactivating = dto.trangThai === false && current.trangThai;
      if (deactivating && (await this.hasStock(id, tx))) {
        throw new AppException('KHO_IN_USE');
      }
      const row = await tx.kho.update({
        where: { id },
        data: {
          tenKho: dto.tenKho,
          diaChi: dto.diaChi,
          trangThai: dto.trangThai,
        },
        include: withCount,
      });
      if (dto.trangThai !== undefined && dto.trangThai !== current.trangThai) {
        await this.audit.record(
          {
            hanhDong: 'kho.status_change',
            doiTuong: 'kho',
            doiTuongId: id,
            truoc: { trangThai: current.trangThai },
            sau: { trangThai: row.trangThai },
          },
          tx,
        );
      }
      return row;
    });
    const stocked = await this.warehousesWithStock([id]);
    return toKhoResponse(updated, stocked.has(id));
  }

  async remove(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.kho.findUnique({
        where: { id },
        include: withCount,
      });
      if (!current) {
        throw new AppException('KHO_NOT_FOUND');
      }
      if (current._count.viTris > 0) {
        throw new AppException('KHO_HAS_VI_TRI', {
          details: { soViTri: current._count.viTris },
        });
      }
      await tx.kho.delete({ where: { id } });
    });
  }

  private async getOrThrow(id: string) {
    const row = await this.prisma.kho.findUnique({
      where: { id },
      include: withCount,
    });
    if (!row) {
      throw new AppException('KHO_NOT_FOUND');
    }
    return row;
  }

  private async assertNameFree(
    name: string,
    tx: Prisma.TransactionClient,
    exceptId?: string,
  ): Promise<void> {
    const other = await tx.kho.findUnique({ where: { tenKho: name } });
    if (other && other.id !== exceptId) {
      throw new AppException('KHO_NAME_TAKEN');
    }
  }

  private async hasStock(
    khoId: string,
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    return (
      (await tx.tonKho.count({
        where: { soLuong: { gt: 0 }, viTri: { khoId } },
      })) > 0
    );
  }

  // Which of these warehouses currently hold stock.
  private async warehousesWithStock(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) {
      return new Set();
    }
    const rows = await this.prisma.viTri.findMany({
      where: {
        khoId: { in: ids },
        tonKhos: { some: { soLuong: { gt: 0 } } },
      },
      select: { khoId: true },
    });
    return new Set(rows.map((r) => r.khoId));
  }
}
