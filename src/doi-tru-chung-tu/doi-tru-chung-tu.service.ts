import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { ClockService } from '../common/clock/clock.service.js';
import { formatDateOnly } from '../common/clock/vn-date.js';
import type { HuyPhieuDto } from '../common/dto/huy-phieu.dto.js';
import { AppException } from '../common/errors/app.exception.js';
import { moneyString, ZERO } from '../common/money.js';
import {
  paginate,
  parseSort,
  toOrderBy,
  type PagedResponse,
} from '../common/pagination/paginate.js';
import { PhieuXuatHangService } from '../phieu-xuat-hang/phieu-xuat-hang.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateDoiTruDto,
  DoiTruResponseDto,
  QueryDoiTruDto,
} from './dto/doi-tru.dto.js';

const SORT_WHITELIST = ['createdAt', 'ngayDoiTru', 'soTienDoiTru'] as const;

const include = {
  phieuThuCongNo: {
    select: {
      id: true,
      maPhieuThuCongNo: true,
      soTien: true,
      huyAt: true,
    },
  },
  phieuXuatHang: {
    select: {
      id: true,
      maPhieuXuatHang: true,
      khachHang: { select: { id: true, maKH: true, tenKH: true } },
    },
  },
} as const satisfies Prisma.DoiTruChungTuInclude;

type Row = Prisma.DoiTruChungTuGetPayload<{ include: typeof include }>;

const toResponse = (row: Row): DoiTruResponseDto => ({
  id: row.id,
  soTienDoiTru: moneyString(row.soTienDoiTru),
  ngayDoiTru: formatDateOnly(row.ngayDoiTru),
  daBo: row.daBoDoiTru || row.phieuThuCongNo.huyAt !== null,
  phieuThuCongNo: {
    id: row.phieuThuCongNo.id,
    maPhieuThuCongNo: row.phieuThuCongNo.maPhieuThuCongNo,
    soTien: moneyString(row.phieuThuCongNo.soTien),
    daHuy: row.phieuThuCongNo.huyAt !== null,
  },
  phieuXuat: {
    id: row.phieuXuatHang.id,
    maPhieuXuatHang: row.phieuXuatHang.maPhieuXuatHang,
    khachHang: row.phieuXuatHang.khachHang,
  },
  createdAt: row.createdAt,
});

// "Đối trừ chứng từ": applying (part of) a receipt to a sales order. A receipt can pay several
// orders of one customer; whatever is not applied yet stays on the receipt ("chưa đối trừ").
@Injectable()
export class DoiTruChungTuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    private readonly phieuXuat: PhieuXuatHangService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(DoiTruChungTuService.name);
  }

  findAll(query: QueryDoiTruDto): Promise<PagedResponse<DoiTruResponseDto>> {
    const where: Prisma.DoiTruChungTuWhereInput = {
      phieuThuCongNoId: query.phieuThuCongNoId,
      phieuXuatHangId: query.phieuXuatHangId,
      daBoDoiTru: query.daBo,
      phieuXuatHang: query.khachHangId
        ? { khachHangId: query.khachHangId }
        : undefined,
    };
    const orderBy = toOrderBy(
      parseSort(query.sort, SORT_WHITELIST, [
        { field: 'createdAt', direction: 'desc' },
      ]),
    ) as Prisma.DoiTruChungTuOrderByWithRelationInput[];
    return paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.doiTruChungTu.findMany({
          where,
          orderBy,
          skip,
          take,
          include,
        }),
      count: () => this.prisma.doiTruChungTu.count({ where }),
      map: toResponse,
    });
  }

  async findOne(id: string): Promise<DoiTruResponseDto> {
    const row = await this.prisma.doiTruChungTu.findUnique({
      where: { id },
      include,
    });
    if (!row) {
      throw new AppException('DOI_TRU_NOT_FOUND');
    }
    return toResponse(row);
  }

  // Applies part of a receipt's unapplied money to another order of the same customer.
  async create(
    dto: CreateDoiTruDto,
    actor: AuthenticatedUser,
  ): Promise<DoiTruResponseDto> {
    const soTien = new Prisma.Decimal(dto.soTienDoiTru);
    const id = await this.prisma.$transaction(async (tx) => {
      // Lock the receipt first (then the order): same order everywhere avoids deadlocks.
      const receipt = await tx.$queryRaw<{ huy_at: Date | null }[]>`
        SELECT huy_at FROM phieu_thu_cong_no WHERE id = ${dto.phieuThuCongNoId} FOR UPDATE`;
      if (!receipt[0]) {
        throw new AppException('PHIEU_THU_NOT_FOUND');
      }
      if (receipt[0].huy_at) {
        throw new AppException('PHIEU_THU_ALREADY_VOID');
      }
      const order = await tx.$queryRaw<{ trang_thai: string }[]>`
        SELECT trang_thai FROM phieu_xuat_hang WHERE id = ${dto.phieuXuatHangId} FOR UPDATE`;
      if (!order[0]) {
        throw new AppException('PHIEU_XUAT_NOT_FOUND');
      }
      if (
        order[0].trang_thai !== 'da_xuat_kho' &&
        order[0].trang_thai !== 'da_giao'
      ) {
        throw new AppException('PHIEU_THU_ORDER_INVALID_STATE');
      }

      await this.assertSameCustomer(
        dto.phieuThuCongNoId,
        dto.phieuXuatHangId,
        tx,
      );
      const conLai = await this.unapplied(dto.phieuThuCongNoId, tx);
      if (soTien.gt(conLai)) {
        throw new AppException('DOI_TRU_EXCEEDS_UNALLOCATED', {
          params: { conLai: conLai.toFixed(2) },
          details: { conLai: moneyString(conLai) },
        });
      }
      const { conNo } = await this.phieuXuat.getReceivableSummary(
        dto.phieuXuatHangId,
        tx,
      );
      if (soTien.gt(conNo)) {
        throw new AppException('PHIEU_THU_EXCEEDS_DEBT', {
          params: { conNo: conNo.toFixed(2) },
          details: { conNo: moneyString(conNo) },
        });
      }

      const created = await tx.doiTruChungTu.create({
        data: {
          phieuThuCongNoId: dto.phieuThuCongNoId,
          phieuXuatHangId: dto.phieuXuatHangId,
          soTienDoiTru: soTien,
          ngayDoiTru: this.clock.today(),
          createdById: actor.id,
        },
      });
      await this.audit.record(
        {
          hanhDong: 'doi_tru.create',
          doiTuong: 'doi_tru_chung_tu',
          doiTuongId: created.id,
          sau: {
            phieuThuCongNoId: dto.phieuThuCongNoId,
            phieuXuatHangId: dto.phieuXuatHangId,
            soTienDoiTru: moneyString(soTien),
          },
        },
        tx,
      );
      return created.id;
    });
    this.logger.info(
      { event: 'doi_tru.created', doiTruId: id },
      'allocation created',
    );
    return this.findOne(id);
  }

  // "Bỏ đối trừ": the money goes back to the receipt's unapplied balance, the order owes it again.
  async remove(
    id: string,
    dto: HuyPhieuDto,
    actor: AuthenticatedUser,
  ): Promise<DoiTruResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.doiTruChungTu.updateMany({
        where: { id, daBoDoiTru: false },
        data: { daBoDoiTru: true },
      });
      if (count !== 1) {
        const exists = await tx.doiTruChungTu.findUnique({ where: { id } });
        throw new AppException(
          exists ? 'DOI_TRU_ALREADY_REMOVED' : 'DOI_TRU_NOT_FOUND',
        );
      }
      await this.audit.record(
        {
          hanhDong: 'doi_tru.remove',
          doiTuong: 'doi_tru_chung_tu',
          doiTuongId: id,
          lyDo: dto.lyDo,
          // Who removes it is recorded by the audit entry itself.
          sau: { daBoDoiTru: true, nguoiThucHien: actor.maNV },
        },
        tx,
      );
    });
    return this.findOne(id);
  }

  // ---- used by phieu-thu-cong-no -------------------------------------------

  // Money of a receipt that is not applied to any order yet.
  async unapplied(
    phieuThuCongNoId: string,
    tx: Prisma.TransactionClient,
  ): Promise<Prisma.Decimal> {
    const [receipt, applied] = await Promise.all([
      tx.phieuThuCongNo.findUniqueOrThrow({
        where: { id: phieuThuCongNoId },
        select: { soTien: true, tienChietKhau: true },
      }),
      tx.doiTruChungTu.aggregate({
        where: { phieuThuCongNoId, daBoDoiTru: false },
        _sum: { soTienDoiTru: true },
      }),
    ]);
    // Cash plus the payment discount is what the receipt can settle.
    return receipt.soTien
      .plus(receipt.tienChietKhau)
      .minus(applied._sum.soTienDoiTru ?? ZERO);
  }

  // Records the application of `soTien` of a (new) receipt to an order.
  async apply(
    input: {
      phieuThuCongNoId: string;
      phieuXuatHangId: string;
      soTien: Prisma.Decimal;
    },
    actor: AuthenticatedUser,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.doiTruChungTu.create({
      data: {
        phieuThuCongNoId: input.phieuThuCongNoId,
        phieuXuatHangId: input.phieuXuatHangId,
        soTienDoiTru: input.soTien,
        ngayDoiTru: this.clock.today(),
        createdById: actor.id,
      },
    });
  }

  // Voiding a receipt releases everything it was applied to.
  async removeAllOfReceipt(
    phieuThuCongNoId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.doiTruChungTu.updateMany({
      where: { phieuThuCongNoId, daBoDoiTru: false },
      data: { daBoDoiTru: true },
    });
  }

  private async assertSameCustomer(
    phieuThuCongNoId: string,
    phieuXuatHangId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const [receipt, order] = await Promise.all([
      tx.phieuThuCongNo.findUniqueOrThrow({
        where: { id: phieuThuCongNoId },
        select: { phieuXuatHang: { select: { khachHangId: true } } },
      }),
      tx.phieuXuatHang.findUniqueOrThrow({
        where: { id: phieuXuatHangId },
        select: { khachHangId: true },
      }),
    ]);
    if (receipt.phieuXuatHang.khachHangId !== order.khachHangId) {
      throw new AppException('PHIEU_THU_CUSTOMER_MISMATCH');
    }
  }
}
