import { Injectable } from '@nestjs/common';
import type { NhanVienKinhDoanh, Prisma } from '@prisma/client';
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
  CreateNhanVienKdDto,
  NhanVienKdResponseDto,
  QueryNhanVienKdDto,
  UpdateNhanVienKdDto,
} from './dto/nhan-vien-kd.dto.js';

const SORT_WHITELIST = ['maNV', 'hoTen', 'createdAt'] as const;

const toResponse = (row: NhanVienKinhDoanh): NhanVienKdResponseDto => ({
  id: row.id,
  maNV: row.maNV,
  hoTen: row.hoTen,
  dienThoai: row.dienThoai,
  trangThai: row.trangThai,
  userId: row.userId,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

@Injectable()
export class NhanVienKinhDoanhService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: CodeGeneratorService,
  ) {}

  findAll(
    query: QueryNhanVienKdDto,
  ): Promise<PagedResponse<NhanVienKdResponseDto>> {
    const where: Prisma.NhanVienKinhDoanhWhereInput = {
      trangThai: query.trangThai,
      OR: query.q
        ? [{ maNV: { contains: query.q } }, { hoTen: { contains: query.q } }]
        : undefined,
    };
    const orderBy = toOrderBy(
      parseSort(query.sort, SORT_WHITELIST, [
        { field: 'hoTen', direction: 'asc' },
      ]),
    ) as Prisma.NhanVienKinhDoanhOrderByWithRelationInput[];
    return paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.nhanVienKinhDoanh.findMany({ where, orderBy, skip, take }),
      count: () => this.prisma.nhanVienKinhDoanh.count({ where }),
      map: toResponse,
    });
  }

  async findOne(id: string): Promise<NhanVienKdResponseDto> {
    return toResponse(await this.findByIdOrThrow(id));
  }

  async create(dto: CreateNhanVienKdDto): Promise<NhanVienKdResponseDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.userId) {
        await this.assertUserFree(dto.userId, tx);
      }
      return tx.nhanVienKinhDoanh.create({
        data: {
          maNV: await this.codes.next(CODE.NHAN_VIEN_KD, tx),
          hoTen: dto.hoTen,
          dienThoai: dto.dienThoai ?? null,
          userId: dto.userId ?? null,
        },
      });
    });
    return toResponse(row);
  }

  async update(
    id: string,
    dto: UpdateNhanVienKdDto,
  ): Promise<NhanVienKdResponseDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      await this.findByIdOrThrow(id, tx);
      if (dto.userId) {
        await this.assertUserFree(dto.userId, tx, id);
      }
      return tx.nhanVienKinhDoanh.update({
        where: { id },
        data: {
          hoTen: dto.hoTen,
          dienThoai: dto.dienThoai,
          userId: dto.userId,
          trangThai: dto.trangThai,
        },
      });
    });
    return toResponse(row);
  }

  async remove(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    const where = { nhanVienBanHangId: id };
    const [khach, ncc, phieuXuat, phieuThu, baoGia] = await Promise.all([
      this.prisma.khachHang.count({ where }),
      this.prisma.nhaCungCap.count({ where: { nhanVienMuaHangId: id } }),
      this.prisma.phieuXuatHang.count({ where }),
      this.prisma.phieuThuCongNo.count({ where }),
      this.prisma.baoGia.count({ where }),
    ]);
    if (khach + ncc + phieuXuat + phieuThu + baoGia > 0) {
      throw new AppException('NHAN_VIEN_KD_IN_USE');
    }
    await this.prisma.nhanVienKinhDoanh.delete({ where: { id } });
  }

  async findByIdOrThrow(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<NhanVienKinhDoanh> {
    const row = await (tx ?? this.prisma).nhanVienKinhDoanh.findUnique({
      where: { id },
    });
    if (!row) {
      throw new AppException('NHAN_VIEN_KD_NOT_FOUND');
    }
    return row;
  }

  // A salesperson that is missing or switched off cannot be assigned to new records.
  async assertUsable(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<NhanVienKinhDoanh> {
    const row = await this.findByIdOrThrow(id, tx);
    if (!row.trangThai) {
      throw new AppException('NHAN_VIEN_KD_INACTIVE');
    }
    return row;
  }

  private async assertUserFree(
    userId: string,
    tx: Prisma.TransactionClient,
    exceptId?: string,
  ): Promise<void> {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppException('USER_NOT_FOUND');
    }
    const taken = await tx.nhanVienKinhDoanh.findUnique({ where: { userId } });
    if (taken && taken.id !== exceptId) {
      throw new AppException('NHAN_VIEN_KD_USER_TAKEN');
    }
  }
}
