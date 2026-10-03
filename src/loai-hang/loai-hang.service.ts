import { Injectable } from '@nestjs/common';
import type { LoaiHang, Prisma } from '@prisma/client';
import { AppException } from '../common/errors/app.exception.js';
import {
  paginate,
  parseSort,
  toOrderBy,
  type PagedResponse,
} from '../common/pagination/paginate.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateLoaiHangDto } from './dto/create-loai-hang.dto.js';
import type { LoaiHangResponseDto } from './dto/loai-hang-response.dto.js';
import type { QueryLoaiHangDto } from './dto/query-loai-hang.dto.js';
import type { UpdateLoaiHangDto } from './dto/update-loai-hang.dto.js';
import { toLoaiHangResponse } from './loai-hang.mapper.js';

const SORT_WHITELIST = ['tenLoaiHang', 'createdAt'] as const;
const withCount = { _count: { select: { hangHoas: true } } } as const;

@Injectable()
export class LoaiHangService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(
    query: QueryLoaiHangDto,
  ): Promise<PagedResponse<LoaiHangResponseDto>> {
    const where: Prisma.LoaiHangWhereInput = {
      trangThai: query.trangThai,
      OR: query.q
        ? [
            { tenLoaiHang: { contains: query.q } },
            { ghiChu: { contains: query.q } },
          ]
        : undefined,
    };
    const orderBy = toOrderBy(
      parseSort(query.sort, SORT_WHITELIST, [
        { field: 'tenLoaiHang', direction: 'asc' },
      ]),
    ) as Prisma.LoaiHangOrderByWithRelationInput[];

    return paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.loaiHang.findMany({
          where,
          orderBy,
          skip,
          take,
          include: withCount,
        }),
      count: () => this.prisma.loaiHang.count({ where }),
      map: toLoaiHangResponse,
    });
  }

  async findOne(id: string): Promise<LoaiHangResponseDto> {
    const row = await this.prisma.loaiHang.findUnique({
      where: { id },
      include: withCount,
    });
    if (!row) {
      throw new AppException('LOAI_HANG_NOT_FOUND');
    }
    return toLoaiHangResponse(row);
  }

  async create(dto: CreateLoaiHangDto): Promise<LoaiHangResponseDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      await this.assertNameFree(dto.tenLoaiHang, tx);
      return tx.loaiHang.create({
        data: { tenLoaiHang: dto.tenLoaiHang, ghiChu: dto.ghiChu ?? null },
        include: withCount,
      });
    });
    return toLoaiHangResponse(created);
  }

  async update(
    id: string,
    dto: UpdateLoaiHangDto,
  ): Promise<LoaiHangResponseDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.loaiHang.findUnique({ where: { id } });
      if (!current) {
        throw new AppException('LOAI_HANG_NOT_FOUND');
      }
      if (dto.tenLoaiHang !== undefined) {
        await this.assertNameFree(dto.tenLoaiHang, tx, id);
      }
      return tx.loaiHang.update({
        where: { id },
        data: {
          tenLoaiHang: dto.tenLoaiHang,
          ghiChu: dto.ghiChu,
          trangThai: dto.trangThai,
        },
        include: withCount,
      });
    });
    return toLoaiHangResponse(updated);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.loaiHang.findUnique({
        where: { id },
        include: withCount,
      });
      if (!current) {
        throw new AppException('LOAI_HANG_NOT_FOUND');
      }
      if (current._count.hangHoas > 0) {
        throw new AppException('LOAI_HANG_IN_USE', {
          details: { soHangHoa: current._count.hangHoas },
        });
      }
      await tx.loaiHang.delete({ where: { id } });
    });
  }

  // A category that is missing or switched off cannot receive new products.
  async assertUsable(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<LoaiHang> {
    const client = tx ?? this.prisma;
    const row = await client.loaiHang.findUnique({ where: { id } });
    if (!row?.trangThai) {
      throw new AppException('LOAI_HANG_NOT_FOUND');
    }
    return row;
  }

  // The column collation is case/accent-insensitive, so findUnique compares like that too.
  private async assertNameFree(
    name: string,
    tx: Prisma.TransactionClient,
    exceptId?: string,
  ): Promise<void> {
    const other = await tx.loaiHang.findUnique({
      where: { tenLoaiHang: name },
    });
    if (other && other.id !== exceptId) {
      throw new AppException('LOAI_HANG_NAME_TAKEN');
    }
  }
}
