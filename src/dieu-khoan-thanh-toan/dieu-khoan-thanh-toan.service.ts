import { Injectable } from '@nestjs/common';
import type { DieuKhoanThanhToan, Prisma } from '@prisma/client';
import { AppException } from '../common/errors/app.exception.js';
import {
  paginate,
  parseSort,
  toOrderBy,
  type PagedResponse,
} from '../common/pagination/paginate.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateDieuKhoanDto,
  DieuKhoanResponseDto,
  QueryDieuKhoanDto,
  UpdateDieuKhoanDto,
} from './dto/dieu-khoan.dto.js';

const SORT_WHITELIST = ['ma', 'ten', 'soNgayDuocNo'] as const;

const toResponse = (row: DieuKhoanThanhToan): DieuKhoanResponseDto => ({
  id: row.id,
  ma: row.ma,
  ten: row.ten,
  soNgayDuocNo: row.soNgayDuocNo,
});

@Injectable()
export class DieuKhoanThanhToanService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(
    query: QueryDieuKhoanDto,
  ): Promise<PagedResponse<DieuKhoanResponseDto>> {
    const where: Prisma.DieuKhoanThanhToanWhereInput = query.q
      ? { OR: [{ ma: { contains: query.q } }, { ten: { contains: query.q } }] }
      : {};
    const orderBy = toOrderBy(
      parseSort(query.sort, SORT_WHITELIST, [
        { field: 'soNgayDuocNo', direction: 'asc' },
      ]),
    ) as Prisma.DieuKhoanThanhToanOrderByWithRelationInput[];
    return paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.dieuKhoanThanhToan.findMany({ where, orderBy, skip, take }),
      count: () => this.prisma.dieuKhoanThanhToan.count({ where }),
      map: toResponse,
    });
  }

  async findOne(id: string): Promise<DieuKhoanResponseDto> {
    return toResponse(await this.findByIdOrThrow(id));
  }

  async create(dto: CreateDieuKhoanDto): Promise<DieuKhoanResponseDto> {
    await this.assertCodeFree(dto.ma);
    return toResponse(
      await this.prisma.dieuKhoanThanhToan.create({
        data: { ma: dto.ma, ten: dto.ten, soNgayDuocNo: dto.soNgayDuocNo },
      }),
    );
  }

  async update(
    id: string,
    dto: UpdateDieuKhoanDto,
  ): Promise<DieuKhoanResponseDto> {
    await this.findByIdOrThrow(id);
    if (dto.ma !== undefined) {
      await this.assertCodeFree(dto.ma, id);
    }
    return toResponse(
      await this.prisma.dieuKhoanThanhToan.update({
        where: { id },
        data: { ma: dto.ma, ten: dto.ten, soNgayDuocNo: dto.soNgayDuocNo },
      }),
    );
  }

  async remove(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    const [khach, ncc, phieu] = await Promise.all([
      this.prisma.khachHang.count({ where: { dieuKhoanThanhToanId: id } }),
      this.prisma.nhaCungCap.count({ where: { dieuKhoanThanhToanId: id } }),
      this.prisma.phieuXuatHang.count({ where: { dieuKhoanThanhToanId: id } }),
    ]);
    if (khach + ncc + phieu > 0) {
      throw new AppException('DIEU_KHOAN_IN_USE');
    }
    await this.prisma.dieuKhoanThanhToan.delete({ where: { id } });
  }

  // Used by khach-hang / nha-cung-cap / phieu-xuat-hang when a term is assigned.
  async findByIdOrThrow(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<DieuKhoanThanhToan> {
    const row = await (tx ?? this.prisma).dieuKhoanThanhToan.findUnique({
      where: { id },
    });
    if (!row) {
      throw new AppException('DIEU_KHOAN_NOT_FOUND');
    }
    return row;
  }

  private async assertCodeFree(ma: string, exceptId?: string): Promise<void> {
    const other = await this.prisma.dieuKhoanThanhToan.findUnique({
      where: { ma },
    });
    if (other && other.id !== exceptId) {
      throw new AppException('DIEU_KHOAN_CODE_TAKEN');
    }
  }
}
