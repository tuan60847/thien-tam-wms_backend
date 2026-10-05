import { Injectable } from '@nestjs/common';
import type { PhuongTienVanChuyen, Prisma } from '@prisma/client';
import { AppException } from '../common/errors/app.exception.js';
import {
  paginate,
  parseSort,
  toOrderBy,
  type PagedResponse,
} from '../common/pagination/paginate.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreatePhuongTienDto,
  PhuongTienResponseDto,
  QueryPhuongTienDto,
  UpdatePhuongTienDto,
} from './dto/phuong-tien.dto.js';

const SORT_WHITELIST = ['bienSo', 'createdAt'] as const;

const toResponse = (row: PhuongTienVanChuyen): PhuongTienResponseDto => ({
  id: row.id,
  bienSo: row.bienSo,
  loaiPhuongTien: row.loaiPhuongTien,
  isXeLanh: row.isXeLanh,
  trangThai: row.trangThai,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

@Injectable()
export class PhuongTienService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(
    query: QueryPhuongTienDto,
  ): Promise<PagedResponse<PhuongTienResponseDto>> {
    const where: Prisma.PhuongTienVanChuyenWhereInput = {
      isXeLanh: query.isXeLanh,
      trangThai: query.trangThai,
      OR: query.q
        ? [
            { bienSo: { contains: query.q } },
            { loaiPhuongTien: { contains: query.q } },
          ]
        : undefined,
    };
    const orderBy = toOrderBy(
      parseSort(query.sort, SORT_WHITELIST, [
        { field: 'bienSo', direction: 'asc' },
      ]),
    ) as Prisma.PhuongTienVanChuyenOrderByWithRelationInput[];

    return paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.phuongTienVanChuyen.findMany({
          where,
          orderBy,
          skip,
          take,
        }),
      count: () => this.prisma.phuongTienVanChuyen.count({ where }),
      map: toResponse,
    });
  }

  async findOne(id: string): Promise<PhuongTienResponseDto> {
    return toResponse(await this.findByIdOrThrow(id));
  }

  async create(dto: CreatePhuongTienDto): Promise<PhuongTienResponseDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      await this.assertPlateFree(dto.bienSo, tx);
      return tx.phuongTienVanChuyen.create({
        data: {
          bienSo: dto.bienSo,
          loaiPhuongTien: dto.loaiPhuongTien ?? null,
          isXeLanh: dto.isXeLanh ?? false,
        },
      });
    });
    return toResponse(created);
  }

  async update(
    id: string,
    dto: UpdatePhuongTienDto,
  ): Promise<PhuongTienResponseDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.phuongTienVanChuyen.findUnique({
        where: { id },
      });
      if (!current) {
        throw new AppException('PHUONG_TIEN_NOT_FOUND');
      }
      if (dto.bienSo !== undefined) {
        await this.assertPlateFree(dto.bienSo, tx, id);
      }
      return tx.phuongTienVanChuyen.update({
        where: { id },
        data: {
          bienSo: dto.bienSo,
          loaiPhuongTien: dto.loaiPhuongTien,
          isXeLanh: dto.isXeLanh,
          trangThai: dto.trangThai,
        },
      });
    });
    return toResponse(updated);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.phuongTienVanChuyen.findUnique({
        where: { id },
      });
      if (!current) {
        throw new AppException('PHUONG_TIEN_NOT_FOUND');
      }
      const used = await tx.phieuNhapHang.count({
        where: { phuongTienVanChuyenId: id },
      });
      if (used > 0) {
        throw new AppException('PHUONG_TIEN_IN_USE');
      }
      await tx.phuongTienVanChuyen.delete({ where: { id } });
    });
  }

  // ---- used by the document modules -----------------------------------------

  async findByIdOrThrow(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PhuongTienVanChuyen> {
    const client = tx ?? this.prisma;
    const row = await client.phuongTienVanChuyen.findUnique({ where: { id } });
    if (!row) {
      throw new AppException('PHUONG_TIEN_NOT_FOUND');
    }
    return row;
  }

  // The vehicle must be active and, when the load needs cooling, a cold vehicle.
  async assertUsable(
    id: string,
    options: { requireCold: boolean },
    tx?: Prisma.TransactionClient,
  ): Promise<PhuongTienVanChuyen> {
    const row = await this.findByIdOrThrow(id, tx);
    if (!row.trangThai) {
      throw new AppException('PHUONG_TIEN_INACTIVE');
    }
    if (options.requireCold && !row.isXeLanh) {
      throw new AppException('PHUONG_TIEN_NOT_COLD');
    }
    return row;
  }

  private async assertPlateFree(
    bienSo: string,
    tx: Prisma.TransactionClient,
    exceptId?: string,
  ): Promise<void> {
    const other = await tx.phuongTienVanChuyen.findUnique({
      where: { bienSo },
    });
    if (other && other.id !== exceptId) {
      throw new AppException('PHUONG_TIEN_PLATE_TAKEN');
    }
  }
}
