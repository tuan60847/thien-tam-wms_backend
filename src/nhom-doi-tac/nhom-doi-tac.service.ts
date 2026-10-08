import { Injectable } from '@nestjs/common';
import type { NhomDoiTac, Prisma } from '@prisma/client';
import { AppException } from '../common/errors/app.exception.js';
import {
  paginate,
  parseSort,
  toOrderBy,
  type PagedResponse,
} from '../common/pagination/paginate.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateNhomDoiTacDto,
  NhomDoiTacResponseDto,
  QueryNhomDoiTacDto,
  UpdateNhomDoiTacDto,
} from './dto/nhom-doi-tac.dto.js';

const SORT_WHITELIST = ['ma', 'ten'] as const;
const withCounts = {
  _count: { select: { khachHangs: true, nhaCungCaps: true } },
} as const;

type Row = NhomDoiTac & {
  _count: { khachHangs: number; nhaCungCaps: number };
};

const toResponse = (row: Row): NhomDoiTacResponseDto => ({
  id: row.id,
  ma: row.ma,
  ten: row.ten,
  soKhachHang: row._count.khachHangs,
  soNhaCungCap: row._count.nhaCungCaps,
});

@Injectable()
export class NhomDoiTacService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(
    query: QueryNhomDoiTacDto,
  ): Promise<PagedResponse<NhomDoiTacResponseDto>> {
    const where: Prisma.NhomDoiTacWhereInput = query.q
      ? { OR: [{ ma: { contains: query.q } }, { ten: { contains: query.q } }] }
      : {};
    const orderBy = toOrderBy(
      parseSort(query.sort, SORT_WHITELIST, [
        { field: 'ten', direction: 'asc' },
      ]),
    ) as Prisma.NhomDoiTacOrderByWithRelationInput[];
    return paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.nhomDoiTac.findMany({
          where,
          orderBy,
          skip,
          take,
          include: withCounts,
        }),
      count: () => this.prisma.nhomDoiTac.count({ where }),
      map: toResponse,
    });
  }

  async findOne(id: string): Promise<NhomDoiTacResponseDto> {
    const row = await this.prisma.nhomDoiTac.findUnique({
      where: { id },
      include: withCounts,
    });
    if (!row) {
      throw new AppException('NHOM_DOI_TAC_NOT_FOUND');
    }
    return toResponse(row);
  }

  async create(dto: CreateNhomDoiTacDto): Promise<NhomDoiTacResponseDto> {
    await this.assertCodeFree(dto.ma);
    const row = await this.prisma.nhomDoiTac.create({
      data: { ma: dto.ma, ten: dto.ten },
      include: withCounts,
    });
    return toResponse(row);
  }

  async update(
    id: string,
    dto: UpdateNhomDoiTacDto,
  ): Promise<NhomDoiTacResponseDto> {
    await this.assertExists(id);
    if (dto.ma !== undefined) {
      await this.assertCodeFree(dto.ma, id);
    }
    const row = await this.prisma.nhomDoiTac.update({
      where: { id },
      data: { ma: dto.ma, ten: dto.ten },
      include: withCounts,
    });
    return toResponse(row);
  }

  async remove(id: string): Promise<void> {
    const row = await this.prisma.nhomDoiTac.findUnique({
      where: { id },
      include: withCounts,
    });
    if (!row) {
      throw new AppException('NHOM_DOI_TAC_NOT_FOUND');
    }
    if (row._count.khachHangs + row._count.nhaCungCaps > 0) {
      throw new AppException('NHOM_DOI_TAC_IN_USE');
    }
    await this.prisma.nhomDoiTac.delete({ where: { id } });
  }

  // Used by khach-hang / nha-cung-cap when a group is assigned.
  async assertExists(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const count = await (tx ?? this.prisma).nhomDoiTac.count({ where: { id } });
    if (count === 0) {
      throw new AppException('NHOM_DOI_TAC_NOT_FOUND');
    }
  }

  private async assertCodeFree(ma: string, exceptId?: string): Promise<void> {
    const other = await this.prisma.nhomDoiTac.findUnique({ where: { ma } });
    if (other && other.id !== exceptId) {
      throw new AppException('NHOM_DOI_TAC_CODE_TAKEN');
    }
  }
}
