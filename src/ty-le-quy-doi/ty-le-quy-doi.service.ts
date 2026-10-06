import { toBaseQuantity } from './unit-conversion.js';
import { Injectable } from '@nestjs/common';
import type { Prisma, TyLeQuyDoi } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import { AppException } from '../common/errors/app.exception.js';
import {
  paginate,
  parseSort,
  toOrderBy,
  type PagedResponse,
} from '../common/pagination/paginate.js';
import { HangHoaService } from '../hang-hoa/hang-hoa.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateTyLeQuyDoiDto } from './dto/create-ty-le-quy-doi.dto.js';
import type { QueryTyLeQuyDoiDto } from './dto/query-ty-le-quy-doi.dto.js';
import type { TyLeQuyDoiResponseDto } from './dto/ty-le-quy-doi-response.dto.js';
import type { UpdateTyLeQuyDoiDto } from './dto/update-ty-le-quy-doi.dto.js';
import { toTyLeQuyDoiResponse } from './ty-le-quy-doi.mapper.js';

const SORT_WHITELIST = ['soLuongQuyDoi', 'donViTinh'] as const;
const same = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

@Injectable()
export class TyLeQuyDoiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hangHoa: HangHoaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(
    hangHoaId: string,
    query: QueryTyLeQuyDoiDto,
  ): Promise<PagedResponse<TyLeQuyDoiResponseDto>> {
    const product = await this.hangHoa.findByIdOrThrow(hangHoaId);
    const where: Prisma.TyLeQuyDoiWhereInput = { hangHoaId };
    const orderBy = toOrderBy(
      parseSort(query.sort, SORT_WHITELIST, [
        { field: 'soLuongQuyDoi', direction: 'asc' },
      ]),
    ) as Prisma.TyLeQuyDoiOrderByWithRelationInput[];

    return paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.tyLeQuyDoi.findMany({ where, orderBy, skip, take }),
      count: () => this.prisma.tyLeQuyDoi.count({ where }),
      map: (unit) => toTyLeQuyDoiResponse(unit, product.donViTinhGia),
    });
  }

  async findOne(hangHoaId: string, id: string): Promise<TyLeQuyDoiResponseDto> {
    const product = await this.hangHoa.findByIdOrThrow(hangHoaId);
    const unit = await this.getUnit(hangHoaId, id);
    return toTyLeQuyDoiResponse(unit, product.donViTinhGia);
  }

  async create(
    hangHoaId: string,
    dto: CreateTyLeQuyDoiDto,
  ): Promise<TyLeQuyDoiResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const product = await this.hangHoa.findByIdOrThrow(hangHoaId, tx);
      if (dto.soLuongQuyDoi < 2) {
        throw new AppException('TY_LE_QUY_DOI_BASE_REQUIRED');
      }
      this.assertNameFree(product.tyLeQuyDois, dto.donViTinh);
      const unit = await tx.tyLeQuyDoi.create({
        data: {
          hangHoaId,
          donViTinh: dto.donViTinh,
          soLuongQuyDoi: dto.soLuongQuyDoi,
        },
      });
      return toTyLeQuyDoiResponse(unit, product.donViTinhGia);
    });
  }

  async update(
    hangHoaId: string,
    id: string,
    dto: UpdateTyLeQuyDoiDto,
  ): Promise<TyLeQuyDoiResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const product = await this.hangHoa.findByIdOrThrow(hangHoaId, tx);
      const unit = product.tyLeQuyDois.find((u) => u.id === id);
      if (!unit) {
        throw new AppException('TY_LE_QUY_DOI_NOT_FOUND');
      }

      const isBase = unit.soLuongQuyDoi === 1;
      const nameChanged =
        dto.donViTinh !== undefined && dto.donViTinh !== unit.donViTinh;
      const ratioChanged =
        dto.soLuongQuyDoi !== undefined &&
        dto.soLuongQuyDoi !== unit.soLuongQuyDoi;

      if (isBase && ratioChanged) {
        throw new AppException('TY_LE_QUY_DOI_BASE_IMMUTABLE');
      }
      if (ratioChanged && dto.soLuongQuyDoi! < 2) {
        throw new AppException('TY_LE_QUY_DOI_BASE_REQUIRED');
      }
      if (
        (nameChanged || ratioChanged) &&
        (await this.hangHoa.hasLots(hangHoaId, tx))
      ) {
        throw new AppException('TY_LE_QUY_DOI_LOCKED');
      }
      if (nameChanged) {
        this.assertNameFree(
          product.tyLeQuyDois.filter((u) => u.id !== id),
          dto.donViTinh!,
        );
      }
      if (!nameChanged && !ratioChanged) {
        return toTyLeQuyDoiResponse(unit, product.donViTinhGia);
      }

      const updated = await tx.tyLeQuyDoi.update({
        where: { id },
        data: {
          donViTinh: nameChanged ? dto.donViTinh : undefined,
          soLuongQuyDoi: ratioChanged ? dto.soLuongQuyDoi : undefined,
        },
      });

      let donViTinhGia = product.donViTinhGia;
      if (nameChanged && same(unit.donViTinh, product.donViTinhGia)) {
        donViTinhGia = updated.donViTinh;
        await this.hangHoa.setPriceUnit(hangHoaId, donViTinhGia, tx);
      }
      await this.audit.record(
        {
          hanhDong: 'ty_le_quy_doi.update',
          doiTuong: 'ty_le_quy_doi',
          doiTuongId: id,
          truoc: snapshot(unit),
          sau: snapshot(updated),
        },
        tx,
      );
      return toTyLeQuyDoiResponse(updated, donViTinhGia);
    });
  }

  async remove(hangHoaId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const product = await this.hangHoa.findByIdOrThrow(hangHoaId, tx);
      const unit = product.tyLeQuyDois.find((u) => u.id === id);
      if (!unit) {
        throw new AppException('TY_LE_QUY_DOI_NOT_FOUND');
      }
      if (unit.soLuongQuyDoi === 1) {
        throw new AppException('TY_LE_QUY_DOI_BASE_IMMUTABLE');
      }
      if (same(unit.donViTinh, product.donViTinhGia)) {
        throw new AppException('TY_LE_QUY_DOI_IN_USE');
      }
      await tx.tyLeQuyDoi.delete({ where: { id } });
      await this.audit.record(
        {
          hanhDong: 'ty_le_quy_doi.delete',
          doiTuong: 'ty_le_quy_doi',
          doiTuongId: id,
          truoc: snapshot(unit),
        },
        tx,
      );
    });
  }

  // ---- used by the document modules (M5/M6) -------------------------------

  // Looks a unit up by name (case-insensitive); null when the product has no such unit.
  async resolveUnit(
    hangHoaId: string,
    donViTinh: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ donViTinh: string; heSoQuyDoi: number } | null> {
    const client = tx ?? this.prisma;
    const units = await client.tyLeQuyDoi.findMany({ where: { hangHoaId } });
    const unit = units.find((u) => same(u.donViTinh, donViTinh));
    return unit
      ? { donViTinh: unit.donViTinh, heSoQuyDoi: unit.soLuongQuyDoi }
      : null;
  }

  // Quantity entered in `donViTinh` (default: the base unit) -> base-unit quantity.
  async toBase(
    hangHoaId: string,
    soLuong: number,
    donViTinh?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    if (!donViTinh) {
      return toBaseQuantity(soLuong, 1);
    }
    const unit = await this.resolveUnit(hangHoaId, donViTinh, tx);
    if (!unit) {
      throw new AppException('VALIDATION_FAILED', {
        details: [
          {
            field: 'donViTinh',
            messages: ['Đơn vị tính không thuộc hàng hóa này'],
          },
        ],
      });
    }
    return toBaseQuantity(soLuong, unit.heSoQuyDoi);
  }

  private async getUnit(hangHoaId: string, id: string): Promise<TyLeQuyDoi> {
    const unit = await this.prisma.tyLeQuyDoi.findFirst({
      where: { id, hangHoaId },
    });
    if (!unit) {
      throw new AppException('TY_LE_QUY_DOI_NOT_FOUND');
    }
    return unit;
  }

  private assertNameFree(units: { donViTinh: string }[], name: string): void {
    if (units.some((u) => same(u.donViTinh, name))) {
      throw new AppException('TY_LE_QUY_DOI_UNIT_TAKEN');
    }
  }
}

function snapshot(unit: TyLeQuyDoi) {
  return { donViTinh: unit.donViTinh, soLuongQuyDoi: unit.soLuongQuyDoi };
}
