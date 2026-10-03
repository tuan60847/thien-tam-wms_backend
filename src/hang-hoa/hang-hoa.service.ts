import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { CodeGeneratorService } from '../common/code-generator/code-generator.service.js';
import { CODE } from '../common/code-generator/code-specs.js';
import { AppException } from '../common/errors/app.exception.js';
import {
  paginate,
  parseSort,
  toOrderBy,
  type PagedResponse,
} from '../common/pagination/paginate.js';
import { LoaiHangService } from '../loai-hang/loai-hang.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateHangHoaDto } from './dto/create-hang-hoa.dto.js';
import type {
  HangHoaListItemDto,
  HangHoaResponseDto,
} from './dto/hang-hoa-response.dto.js';
import type { QueryHangHoaDto } from './dto/query-hang-hoa.dto.js';
import type { UpdateHangHoaDto } from './dto/update-hang-hoa.dto.js';
import {
  hangHoaInclude,
  toHangHoaListItem,
  toHangHoaResponse,
  type HangHoaFull,
} from './hang-hoa.mapper.js';
import {
  assertControlType,
  assertPriceOrder,
  buildUnits,
  resolvePriceUnit,
} from './hang-hoa.rules.js';

const SORT_WHITELIST = ['tenSP', 'maSP', 'giaHienThi', 'createdAt'] as const;
const ZERO = '0.00';

@Injectable()
export class HangHoaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loaiHang: LoaiHangService,
    private readonly codes: CodeGeneratorService,
    private readonly audit: AuditService,
  ) {}

  findAll(
    query: QueryHangHoaDto,
    viewer: AuthenticatedUser,
  ): Promise<PagedResponse<HangHoaListItemDto>> {
    const where: Prisma.HangHoaWhereInput = {
      loaiHangId: query.loaiHangId,
      isKeDon: query.isKeDon,
      isCanGiuLanh: query.isCanGiuLanh,
      loaiKiemSoat: query.loaiKiemSoat,
      trangThai: query.trangThai,
      OR: query.q
        ? [
            { tenSP: { contains: query.q } },
            { maSP: { contains: query.q } },
            { soDangKy: { contains: query.q } },
          ]
        : undefined,
    };
    const orderBy = toOrderBy(
      parseSort(query.sort, SORT_WHITELIST, [
        { field: 'tenSP', direction: 'asc' },
      ]),
    ) as Prisma.HangHoaOrderByWithRelationInput[];

    return paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.hangHoa.findMany({
          where,
          orderBy,
          skip,
          take,
          include: hangHoaInclude,
        }),
      count: () => this.prisma.hangHoa.count({ where }),
      map: (row) => toHangHoaListItem(row, viewer.role?.maRole),
    });
  }

  async findOne(
    id: string,
    viewer: AuthenticatedUser,
  ): Promise<HangHoaResponseDto> {
    return toHangHoaResponse(
      await this.findByIdOrThrow(id),
      viewer.role?.maRole,
    );
  }

  async create(
    dto: CreateHangHoaDto,
    actor: AuthenticatedUser,
  ): Promise<HangHoaResponseDto> {
    const units = buildUnits(dto.donViCoBan, dto.cacDonViKhac);
    const donViTinhGia = resolvePriceUnit(
      units,
      dto.donViTinhGia ?? dto.donViCoBan,
    );
    const giaHienThi = dto.giaHienThi ?? ZERO;
    const giaToiThieu = dto.giaToiThieu ?? ZERO;
    assertPriceOrder(giaToiThieu, giaHienThi);

    const isKeDon = dto.isKeDon ?? false;
    const loaiKiemSoat = dto.loaiKiemSoat ?? (isKeDon ? undefined : 'thuong');
    assertControlType({ isKeDon, loaiKiemSoat, soDangKy: dto.soDangKy });

    const created = await this.prisma.$transaction(async (tx) => {
      await this.loaiHang.assertUsable(dto.loaiHangId, tx);
      const maSP = await this.codes.next(CODE.SAN_PHAM, tx);
      return tx.hangHoa.create({
        data: {
          maSP,
          tenSP: dto.tenSP,
          quyCach: dto.quyCach ?? null,
          loaiHangId: dto.loaiHangId,
          donViTinhGia,
          giaNhap: dto.giaNhap ?? ZERO,
          giaHienThi,
          giaToiThieu,
          isKeDon,
          isCanGiuLanh: dto.isCanGiuLanh ?? false,
          loaiKiemSoat: loaiKiemSoat ?? null,
          soDangKy: dto.soDangKy ?? null,
          ghiChu: dto.ghiChu ?? null,
          createdById: actor.id,
          updatedById: actor.id,
          // The aggregate root creates its own units so a product never exists without a base unit.
          tyLeQuyDois: { create: units },
        },
        include: hangHoaInclude,
      });
    });
    return toHangHoaResponse(created, actor.role?.maRole);
  }

  async update(
    id: string,
    dto: UpdateHangHoaDto,
    actor: AuthenticatedUser,
  ): Promise<HangHoaResponseDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await this.findByIdOrThrow(id, tx);

      if (dto.loaiHangId && dto.loaiHangId !== current.loaiHangId) {
        await this.loaiHang.assertUsable(dto.loaiHangId, tx);
      }
      const donViTinhGia = dto.donViTinhGia
        ? resolvePriceUnit(current.tyLeQuyDois, dto.donViTinhGia)
        : current.donViTinhGia;

      const giaNhap = dto.giaNhap ?? current.giaNhap.toFixed(2);
      const giaHienThi = dto.giaHienThi ?? current.giaHienThi.toFixed(2);
      const giaToiThieu = dto.giaToiThieu ?? current.giaToiThieu.toFixed(2);
      assertPriceOrder(giaToiThieu, giaHienThi);

      const isKeDon = dto.isKeDon ?? current.isKeDon;
      const loaiKiemSoat = dto.loaiKiemSoat ?? current.loaiKiemSoat;
      const soDangKy =
        dto.soDangKy === undefined ? current.soDangKy : dto.soDangKy;
      assertControlType({ isKeDon, loaiKiemSoat, soDangKy });

      const priceChanged =
        !current.giaNhap.equals(giaNhap) ||
        !current.giaHienThi.equals(giaHienThi) ||
        !current.giaToiThieu.equals(giaToiThieu) ||
        current.donViTinhGia !== donViTinhGia;

      const row = await tx.hangHoa.update({
        where: { id },
        data: {
          tenSP: dto.tenSP,
          quyCach: dto.quyCach,
          loaiHangId: dto.loaiHangId,
          donViTinhGia,
          giaNhap,
          giaHienThi,
          giaToiThieu,
          isKeDon: dto.isKeDon,
          isCanGiuLanh: dto.isCanGiuLanh,
          loaiKiemSoat: dto.loaiKiemSoat,
          soDangKy: dto.soDangKy,
          ghiChu: dto.ghiChu,
          trangThai: dto.trangThai,
          updatedById: actor.id,
        },
        include: hangHoaInclude,
      });

      if (priceChanged) {
        await this.audit.record(
          {
            hanhDong: 'hang_hoa.price_change',
            doiTuong: 'hang_hoa',
            doiTuongId: id,
            truoc: priceSnapshot(current),
            sau: priceSnapshot(row),
          },
          tx,
        );
      }
      return row;
    });
    return toHangHoaResponse(updated, actor.role?.maRole);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.hangHoa.findUnique({
        where: { id },
        include: { _count: { select: { soLos: true } } },
      });
      if (!current) {
        throw new AppException('HANG_HOA_NOT_FOUND');
      }
      if (current._count.soLos > 0) {
        throw new AppException('HANG_HOA_IN_USE', {
          details: { soLo: current._count.soLos },
        });
      }
      await tx.tyLeQuyDoi.deleteMany({ where: { hangHoaId: id } });
      await tx.hangHoa.delete({ where: { id } });
    });
  }

  // ---- used by other modules --------------------------------------------

  async findByIdOrThrow(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<HangHoaFull> {
    const client = tx ?? this.prisma;
    const row = await client.hangHoa.findUnique({
      where: { id },
      include: hangHoaInclude,
    });
    if (!row) {
      throw new AppException('HANG_HOA_NOT_FOUND');
    }
    return row;
  }

  // Receiving stock of a discontinued product is refused; issuing what is left is not.
  assertReceivable(hangHoa: { trangThai: boolean }): void {
    if (!hangHoa.trangThai) {
      throw new AppException('HANG_HOA_INACTIVE');
    }
  }

  // Units are "locked" once the product has any lot.
  async hasLots(id: string, tx?: Prisma.TransactionClient): Promise<boolean> {
    const client = tx ?? this.prisma;
    return (await client.soLo.count({ where: { hangHoaId: id } })) > 0;
  }

  // Keeps donViTinhGia pointing at a renamed unit.
  async setPriceUnit(
    id: string,
    donViTinhGia: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.hangHoa.update({ where: { id }, data: { donViTinhGia } });
  }
}

function priceSnapshot(row: {
  giaNhap: Prisma.Decimal;
  giaHienThi: Prisma.Decimal;
  giaToiThieu: Prisma.Decimal;
  donViTinhGia: string;
}) {
  return {
    giaNhap: row.giaNhap.toFixed(2),
    giaHienThi: row.giaHienThi.toFixed(2),
    giaToiThieu: row.giaToiThieu.toFixed(2),
    donViTinhGia: row.donViTinhGia,
  };
}
