import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { ClockService } from '../common/clock/clock.service.js';
import { formatDateOnly, parseDateOnly } from '../common/clock/vn-date.js';
import { CodeGeneratorService } from '../common/code-generator/code-generator.service.js';
import { CODE } from '../common/code-generator/code-specs.js';
import { AppException } from '../common/errors/app.exception.js';
import {
  paginate,
  parseSort,
  toOrderBy,
  type PagedResponse,
} from '../common/pagination/paginate.js';
import { HangHoaService } from '../hang-hoa/hang-hoa.service.js';
import { KhachHangService } from '../khach-hang/khach-hang.service.js';
import { NhanVienKinhDoanhService } from '../nhan-vien-kinh-doanh/nhan-vien-kinh-doanh.service.js';
import type { PhieuXuatResponseDto } from '../phieu-xuat-hang/dto/phieu-xuat.dto.js';
import { PhieuXuatHangService } from '../phieu-xuat-hang/phieu-xuat-hang.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TyLeQuyDoiService } from '../ty-le-quy-doi/ty-le-quy-doi.service.js';
import { allocationCoversQuote, isExpired } from './bao-gia.rules.js';
import {
  baoGiaDetailInclude,
  baoGiaListInclude,
  hasLiveOrder,
  toBaoGiaListItem,
  toBaoGiaResponse,
} from './bao-gia.mapper.js';
import type {
  BaoGiaListItemDto,
  BaoGiaResponseDto,
  ChiTietBaoGiaDto,
  ChuyenPhieuXuatDto,
  CreateBaoGiaDto,
  QueryBaoGiaDto,
  UpdateBaoGiaDto,
} from './dto/bao-gia.dto.js';

const SORT_WHITELIST = [
  'createdAt',
  'ngayBaoGia',
  'hanHieuLuc',
  'maBaoGia',
] as const;

interface PreparedLine {
  thuTu: number;
  hangHoaId: string;
  donViTinh: string;
  soLuong: number;
  donGia: Prisma.Decimal;
  tyLeChietKhau: Prisma.Decimal;
  thueSuatGtgt: Prisma.Decimal;
}

@Injectable()
export class BaoGiaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: CodeGeneratorService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    private readonly khachHang: KhachHangService,
    private readonly nhanVien: NhanVienKinhDoanhService,
    private readonly hangHoa: HangHoaService,
    private readonly units: TyLeQuyDoiService,
    private readonly phieuXuat: PhieuXuatHangService,
  ) {}

  // ===========================================================================
  // Queries
  // ===========================================================================

  async findAll(
    query: QueryBaoGiaDto,
  ): Promise<PagedResponse<BaoGiaListItemDto>> {
    const today = this.clock.today();
    const liveOrder: Prisma.PhieuXuatHangWhereInput = {
      trangThai: { not: 'da_huy' },
    };
    const where: Prisma.BaoGiaWhereInput = {
      khachHangId: query.khachHangId,
      ngayBaoGia:
        query.ngayBaoGiaFrom || query.ngayBaoGiaTo
          ? {
              gte: query.ngayBaoGiaFrom
                ? parseDateOnly(query.ngayBaoGiaFrom)
                : undefined,
              lte: query.ngayBaoGiaTo
                ? parseDateOnly(query.ngayBaoGiaTo)
                : undefined,
            }
          : undefined,
      // Computed from the date, so the filter is always current.
      ...(query.conHieuLuc === 'true' && {
        OR: [{ hanHieuLuc: null }, { hanHieuLuc: { gte: today } }],
      }),
      ...(query.conHieuLuc === 'false' && { hanHieuLuc: { lt: today } }),
      ...(query.daChuyenPhieuXuat === 'true' && {
        phieuXuatHangs: { some: liveOrder },
      }),
      ...(query.daChuyenPhieuXuat === 'false' && {
        phieuXuatHangs: { none: liveOrder },
      }),
      ...(query.q && {
        AND: [
          {
            OR: [
              { maBaoGia: { contains: query.q } },
              { khachHang: { tenKH: { contains: query.q } } },
              { khachHang: { maKH: { contains: query.q } } },
            ],
          },
        ],
      }),
    };
    const orderBy = toOrderBy(
      parseSort(query.sort, SORT_WHITELIST, [
        { field: 'createdAt', direction: 'desc' },
      ]),
    ) as Prisma.BaoGiaOrderByWithRelationInput[];
    return paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.baoGia.findMany({
          where,
          orderBy,
          skip,
          take,
          include: baoGiaListInclude,
        }),
      count: () => this.prisma.baoGia.count({ where }),
      map: toBaoGiaListItem(today),
    });
  }

  async findOne(id: string): Promise<BaoGiaResponseDto> {
    const row = await this.prisma.baoGia.findUnique({
      where: { id },
      include: baoGiaDetailInclude,
    });
    if (!row) {
      throw new AppException('BAO_GIA_NOT_FOUND');
    }
    return toBaoGiaResponse(row, this.clock.today());
  }

  // ===========================================================================
  // Writes
  // ===========================================================================

  async create(
    dto: CreateBaoGiaDto,
    actor: AuthenticatedUser,
  ): Promise<BaoGiaResponseDto> {
    const id = await this.prisma.$transaction(async (tx) => {
      const customer = await this.khachHang.findByIdOrThrow(
        dto.khachHangId,
        tx,
      );
      this.khachHang.assertCanBuy(customer);
      const ngayBaoGia = this.resolveDates(dto.ngayBaoGia, dto.hanHieuLuc);
      const salesperson = dto.nhanVienBanHangId ?? customer.nhanVienBanHangId;
      if (salesperson) {
        await this.nhanVien.assertUsable(salesperson, tx);
      }
      const lines = await this.prepareLines(dto.chiTiet, tx);
      const created = await tx.baoGia.create({
        data: {
          maBaoGia: await this.codes.next(CODE.BAO_GIA, tx),
          ngayBaoGia: ngayBaoGia.ngay,
          hanHieuLuc: ngayBaoGia.han,
          ghiChu: dto.ghiChu ?? null,
          khachHangId: customer.id,
          nhanVienBanHangId: salesperson ?? null,
          createdById: actor.id,
          chiTiets: { create: lines },
        },
      });
      await this.audit.record(
        {
          hanhDong: 'bao_gia.create',
          doiTuong: 'bao_gia',
          doiTuongId: created.id,
          sau: { maBaoGia: created.maBaoGia, soDong: lines.length },
        },
        tx,
      );
      return created.id;
    });
    return this.findOne(id);
  }

  async update(id: string, dto: UpdateBaoGiaDto): Promise<BaoGiaResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      const current = await this.lockEditable(id, tx);
      const data: Prisma.BaoGiaUpdateInput = {};

      if (dto.khachHangId !== undefined) {
        const customer = await this.khachHang.findByIdOrThrow(
          dto.khachHangId,
          tx,
        );
        this.khachHang.assertCanBuy(customer);
        data.khachHang = { connect: { id: customer.id } };
      }
      if (dto.ngayBaoGia !== undefined || dto.hanHieuLuc !== undefined) {
        const dates = this.resolveDates(
          dto.ngayBaoGia ?? formatDateOnly(current.ngayBaoGia),
          dto.hanHieuLuc === undefined
            ? current.hanHieuLuc && formatDateOnly(current.hanHieuLuc)
            : dto.hanHieuLuc,
        );
        data.ngayBaoGia = dates.ngay;
        data.hanHieuLuc = dates.han;
      }
      if (dto.nhanVienBanHangId !== undefined) {
        if (dto.nhanVienBanHangId) {
          await this.nhanVien.assertUsable(dto.nhanVienBanHangId, tx);
        }
        data.nhanVienBanHang = dto.nhanVienBanHangId
          ? { connect: { id: dto.nhanVienBanHangId } }
          : { disconnect: true };
      }
      if (dto.ghiChu !== undefined) {
        data.ghiChu = dto.ghiChu;
      }
      if (dto.chiTiet !== undefined) {
        const lines = await this.prepareLines(dto.chiTiet, tx);
        await tx.chiTietBaoGia.deleteMany({ where: { baoGiaId: id } });
        data.chiTiets = { create: lines };
      }
      await tx.baoGia.update({ where: { id }, data });
      await this.audit.record(
        {
          hanhDong: 'bao_gia.update',
          doiTuong: 'bao_gia',
          doiTuongId: id,
          sau: { maBaoGia: current.maBaoGia },
        },
        tx,
      );
    });
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await this.lockEditable(id, tx, true);
      await tx.baoGia.delete({ where: { id } });
      await this.audit.record(
        {
          hanhDong: 'bao_gia.delete',
          doiTuong: 'bao_gia',
          doiTuongId: id,
          truoc: { maBaoGia: current.maBaoGia },
        },
        tx,
      );
    });
  }

  // Turns the quote into a draft sales order. The order takes the quote's prices,
  // discounts and VAT; the lots to ship from are chosen by the caller.
  async convertToOrder(
    id: string,
    dto: ChuyenPhieuXuatDto,
    actor: AuthenticatedUser,
  ): Promise<PhieuXuatResponseDto> {
    const orderId = await this.prisma.$transaction(async (tx) => {
      // The quote row is locked first: two simultaneous conversions run one after another,
      // so the second sees the first one's order and is refused.
      await tx.$queryRaw`SELECT id FROM bao_gia WHERE id = ${id} FOR UPDATE`;
      const quote = await tx.baoGia.findUnique({
        where: { id },
        include: {
          chiTiets: true,
          phieuXuatHangs: { select: { trangThai: true } },
        },
      });
      if (!quote) {
        throw new AppException('BAO_GIA_NOT_FOUND');
      }
      if (hasLiveOrder(quote.phieuXuatHangs)) {
        throw new AppException('BAO_GIA_ALREADY_CONVERTED');
      }
      if (isExpired(quote.hanHieuLuc, this.clock.today())) {
        throw new AppException('BAO_GIA_EXPIRED');
      }
      if (quote.chiTiets.length === 0) {
        throw new AppException('BAO_GIA_EMPTY');
      }
      if (!allocationCoversQuote(quote.chiTiets, dto.phanBo)) {
        throw new AppException('BAO_GIA_ALLOCATION_INVALID');
      }

      const lines = new Map(quote.chiTiets.map((l) => [l.id, l]));
      const lots = await tx.soLo.findMany({
        where: { id: { in: dto.phanBo.map((a) => a.soLoId) } },
        select: { id: true, hangHoaId: true },
      });
      const lotProduct = new Map(lots.map((l) => [l.id, l.hangHoaId]));
      const chiTiet = dto.phanBo.map((alloc, index) => {
        const line = lines.get(alloc.chiTietBaoGiaId);
        // A lot of another product cannot fill this quote line; unknown lots are
        // reported by the order itself (SO_LO_NOT_FOUND).
        if (
          !line ||
          (lotProduct.has(alloc.soLoId) &&
            lotProduct.get(alloc.soLoId) !== line.hangHoaId)
        ) {
          throw new AppException('BAO_GIA_ALLOCATION_INVALID', {
            details: { field: `phanBo[${index}]` },
          });
        }
        return {
          soLoId: alloc.soLoId,
          viTriId: alloc.viTriId,
          donViTinh: line.donViTinh,
          soLuong: alloc.soLuong,
          donGia: line.donGia.toFixed(2),
          laHangKhuyenMai: alloc.laHangKhuyenMai,
          tyLeChietKhau: line.tyLeChietKhau.toFixed(2),
          thueSuatGtgt: line.thueSuatGtgt.toFixed(2),
        };
      });

      const createdId = await this.phieuXuat.createInTransaction(
        {
          khachHangId: quote.khachHangId,
          baoGiaId: quote.id,
          nhanVienBanHangId: quote.nhanVienBanHangId,
          phuongTienVanChuyenId: dto.phuongTienVanChuyenId,
          ngayGiaoHang: dto.ngayGiaoHang,
          diaChiGiaoHang: dto.diaChiGiaoHang,
          ghiChu: dto.ghiChu ?? quote.ghiChu,
          thamChieu: quote.maBaoGia,
          vuotHanMucLyDo: dto.vuotHanMucLyDo,
          chiTiet,
        },
        actor,
        tx,
      );
      await this.audit.record(
        {
          hanhDong: 'bao_gia.convert',
          doiTuong: 'bao_gia',
          doiTuongId: id,
          sau: { phieuXuatHangId: createdId },
        },
        tx,
      );
      return createdId;
    });
    return this.phieuXuat.findOne(orderId);
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  // Locks the quote row and refuses changes once an order was made from it.
  private async lockEditable(
    id: string,
    tx: Prisma.TransactionClient,
    forDelete = false,
  ) {
    await tx.$queryRaw`SELECT id FROM bao_gia WHERE id = ${id} FOR UPDATE`;
    const row = await tx.baoGia.findUnique({
      where: { id },
      include: { phieuXuatHangs: { select: { trangThai: true } } },
    });
    if (!row) {
      throw new AppException('BAO_GIA_NOT_FOUND');
    }
    // Deleting is blocked by any linked order (even cancelled ones keep the link).
    const blocked = forDelete
      ? row.phieuXuatHangs.length > 0
      : hasLiveOrder(row.phieuXuatHangs);
    if (blocked) {
      throw new AppException('BAO_GIA_ALREADY_CONVERTED');
    }
    return row;
  }

  private resolveDates(
    ngayBaoGia: string | undefined,
    hanHieuLuc: string | null | undefined,
  ): { ngay: Date; han: Date | null } {
    const ngay = ngayBaoGia ? parseDateOnly(ngayBaoGia) : this.clock.today();
    const han = hanHieuLuc ? parseDateOnly(hanHieuLuc) : null;
    if (han && han.getTime() < ngay.getTime()) {
      throw new AppException('BAO_GIA_DATE_INVALID');
    }
    return { ngay, han };
  }

  private async prepareLines(
    input: ChiTietBaoGiaDto[],
    tx: Prisma.TransactionClient,
  ): Promise<PreparedLine[]> {
    const lines: PreparedLine[] = [];
    for (const [index, line] of input.entries()) {
      const product = await this.hangHoa.findByIdOrThrow(line.hangHoaId, tx);
      const unit = await this.units.resolveUnit(product.id, line.donViTinh, tx);
      if (!unit) {
        throw new AppException('BAO_GIA_UNIT_INVALID', {
          details: { field: `chiTiet[${index}]`, donViTinh: line.donViTinh },
        });
      }
      lines.push({
        thuTu: index + 1,
        hangHoaId: product.id,
        donViTinh: unit.donViTinh,
        soLuong: line.soLuong,
        donGia: new Prisma.Decimal(line.donGia),
        tyLeChietKhau: new Prisma.Decimal(line.tyLeChietKhau ?? 0),
        thueSuatGtgt: line.thueSuatGtgt
          ? new Prisma.Decimal(line.thueSuatGtgt)
          : product.thueSuatGtgt,
      });
    }
    return lines;
  }
}
