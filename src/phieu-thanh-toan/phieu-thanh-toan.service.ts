import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { ClockService } from '../common/clock/clock.service.js';
import { CodeGeneratorService } from '../common/code-generator/code-generator.service.js';
import { CODE } from '../common/code-generator/code-specs.js';
import {
  diffDays,
  formatDateOnly,
  parseDateOnly,
} from '../common/clock/vn-date.js';
import type { HuyPhieuDto } from '../common/dto/huy-phieu.dto.js';
import { AppException } from '../common/errors/app.exception.js';
import { moneyString, ZERO } from '../common/money.js';
import {
  paginate,
  parseSort,
  toOrderBy,
  type PagedResponse,
} from '../common/pagination/paginate.js';
import { PhieuNhapHangService } from '../phieu-nhap-hang/phieu-nhap-hang.service.js';
import { computeTotals } from '../phieu-nhap-hang/phieu-nhap-hang.rules.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CongNoNccQueryDto,
  CongNoNccResponseDto,
  CreatePhieuThanhToanDto,
  PhieuThanhToanResponseDto,
  QueryPhieuThanhToanDto,
} from './dto/phieu-thanh-toan.dto.js';
import {
  phieuThanhToanInclude,
  toPhieuThanhToanResponse,
} from './phieu-thanh-toan.mapper.js';
import {
  assertAmountWithinDebt,
  assertPaymentDate,
} from './phieu-thanh-toan.rules.js';

const SORT_WHITELIST = ['ngayThanhToan', 'createdAt', 'soTien'] as const;

@Injectable()
export class PhieuThanhToanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: CodeGeneratorService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    private readonly phieuNhap: PhieuNhapHangService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(PhieuThanhToanService.name);
  }

  findAll(
    query: QueryPhieuThanhToanDto,
  ): Promise<PagedResponse<PhieuThanhToanResponseDto>> {
    const where: Prisma.PhieuThanhToanWhereInput = {
      phieuNhapHangId: query.phieuNhapHangId,
      phuongThuc: query.phuongThuc,
      createdById: query.createdById,
      huyAt:
        query.daHuy === undefined
          ? undefined
          : query.daHuy
            ? { not: null }
            : null,
      ngayThanhToan:
        query.ngayThanhToanFrom || query.ngayThanhToanTo
          ? {
              gte: query.ngayThanhToanFrom
                ? parseDateOnly(query.ngayThanhToanFrom)
                : undefined,
              lte: query.ngayThanhToanTo
                ? parseDateOnly(query.ngayThanhToanTo)
                : undefined,
            }
          : undefined,
      phieuNhapHang: query.nhaCungCapId
        ? { nhaCungCapId: query.nhaCungCapId }
        : undefined,
      OR: query.q
        ? [
            { maPhieuThanhToan: { contains: query.q } },
            { phieuNhapHang: { maPhieuNhapHang: { contains: query.q } } },
            {
              phieuNhapHang: { nhaCungCap: { tenNCC: { contains: query.q } } },
            },
          ]
        : undefined,
    };
    const orderBy = toOrderBy(
      parseSort(query.sort, SORT_WHITELIST, [
        { field: 'ngayThanhToan', direction: 'desc' },
      ]),
    ) as Prisma.PhieuThanhToanOrderByWithRelationInput[];

    return paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.phieuThanhToan.findMany({
          where,
          orderBy,
          skip,
          take,
          include: phieuThanhToanInclude,
        }),
      count: () => this.prisma.phieuThanhToan.count({ where }),
      map: toPhieuThanhToanResponse,
    });
  }

  async findOne(id: string): Promise<PhieuThanhToanResponseDto> {
    const row = await this.prisma.phieuThanhToan.findUnique({
      where: { id },
      include: phieuThanhToanInclude,
    });
    if (!row) {
      throw new AppException('PHIEU_THANH_TOAN_NOT_FOUND');
    }
    return toPhieuThanhToanResponse(row);
  }

  async create(
    dto: CreatePhieuThanhToanDto,
    actor: AuthenticatedUser,
  ): Promise<PhieuThanhToanResponseDto> {
    const soTien = new Prisma.Decimal(dto.soTien);
    const ngayThanhToan = parseDateOnly(dto.ngayThanhToan);

    const id = await this.prisma.$transaction(async (tx) => {
      // Locking read on the receipt is the first statement: concurrent payments for the
      // same receipt run one after another, so "check the debt, then write" is safe.
      const locked = await tx.$queryRaw<
        { trang_thai: string; ngay_nhan_hang: Date | null }[]
      >`SELECT trang_thai, ngay_nhan_hang FROM phieu_nhap_hang
        WHERE id = ${dto.phieuNhapHangId} FOR UPDATE`;
      const receipt = locked[0];
      if (!receipt) {
        throw new AppException('PHIEU_NHAP_NOT_FOUND');
      }
      if (receipt.trang_thai !== 'da_nhap_kho') {
        throw new AppException('PHIEU_THANH_TOAN_RECEIPT_INVALID_STATE');
      }
      assertPaymentDate(
        ngayThanhToan,
        this.clock.today(),
        receipt.ngay_nhan_hang,
      );
      const { conNo } = await this.phieuNhap.getPaymentSummary(
        dto.phieuNhapHangId,
        tx,
      );
      assertAmountWithinDebt(soTien, conNo);

      const created = await tx.phieuThanhToan.create({
        data: {
          maPhieuThanhToan: await this.codes.next(CODE.PHIEU_THANH_TOAN, tx),
          soTien,
          ngayThanhToan,
          phuongThuc: dto.phuongThuc,
          ghiChu: dto.ghiChu ?? null,
          phieuNhapHangId: dto.phieuNhapHangId,
          createdById: actor.id,
        },
      });
      return created.id;
    });
    this.logger.info(
      { event: 'phieu_thanh_toan.created', phieuThanhToanId: id },
      'payment created',
    );
    return this.findOne(id);
  }

  // Named `voidPayment` because `void` is reserved in JavaScript.
  async voidPayment(
    id: string,
    dto: HuyPhieuDto,
    actor: AuthenticatedUser,
  ): Promise<PhieuThanhToanResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.phieuThanhToan.updateMany({
        where: { id, huyAt: null },
        data: {
          huyAt: this.clock.now(),
          huyById: actor.id,
          lyDoHuy: dto.lyDo,
        },
      });
      if (count !== 1) {
        const exists = await tx.phieuThanhToan.findUnique({ where: { id } });
        throw new AppException(
          exists
            ? 'PHIEU_THANH_TOAN_ALREADY_VOID'
            : 'PHIEU_THANH_TOAN_NOT_FOUND',
        );
      }
      await this.audit.record(
        {
          hanhDong: 'phieu_thanh_toan.void',
          doiTuong: 'phieu_thanh_toan',
          doiTuongId: id,
          lyDo: dto.lyDo,
        },
        tx,
      );
    });
    this.logger.info(
      { event: 'phieu_thanh_toan.voided', phieuThanhToanId: id },
      'payment voided',
    );
    return this.findOne(id);
  }

  async congNoNhaCungCap(
    nhaCungCapId: string,
    query: CongNoNccQueryDto,
  ): Promise<CongNoNccResponseDto> {
    const ncc = await this.prisma.nhaCungCap.findUnique({
      where: { id: nhaCungCapId },
      select: { id: true, maNCC: true, tenNCC: true },
    });
    if (!ncc) {
      throw new AppException('NHA_CUNG_CAP_NOT_FOUND');
    }
    const receipts = await this.prisma.phieuNhapHang.findMany({
      where: { nhaCungCapId, trangThai: 'da_nhap_kho' },
      orderBy: [{ ngayNhanHang: 'asc' }, { maPhieuNhapHang: 'asc' }],
      select: {
        id: true,
        maPhieuNhapHang: true,
        ngayNhanHang: true,
        chiTietPhieuNhapHangs: { select: { soLuong: true, donGia: true } },
        phieuThanhToans: { select: { soTien: true, huyAt: true } },
      },
    });
    const today = this.clock.today();
    let tongPhaiTra = ZERO;
    let daThanhToan = ZERO;
    const phieuConNo = [];
    for (const receipt of receipts) {
      const tongTien = computeTotals(receipt.chiTietPhieuNhapHangs);
      const paid = receipt.phieuThanhToans
        .filter((t) => !t.huyAt)
        .reduce((sum, t) => sum.plus(t.soTien), ZERO);
      const conNo = tongTien.minus(paid);
      tongPhaiTra = tongPhaiTra.plus(tongTien);
      daThanhToan = daThanhToan.plus(paid);
      if ((query.chiConNo ?? true) && conNo.lte(0)) {
        continue;
      }
      phieuConNo.push({
        phieuNhapId: receipt.id,
        maPhieuNhapHang: receipt.maPhieuNhapHang,
        ngayNhanHang: receipt.ngayNhanHang
          ? formatDateOnly(receipt.ngayNhanHang)
          : null,
        tongTien: moneyString(tongTien),
        daThanhToan: moneyString(paid),
        conNo: moneyString(conNo),
        soNgayNo: receipt.ngayNhanHang
          ? diffDays(today, receipt.ngayNhanHang)
          : 0,
      });
    }
    return {
      nhaCungCap: ncc,
      tongPhaiTra: moneyString(tongPhaiTra),
      daThanhToan: moneyString(daThanhToan),
      conNo: moneyString(tongPhaiTra.minus(daThanhToan)),
      phieuConNo,
      generatedAt: this.clock.now(),
    };
  }
}
