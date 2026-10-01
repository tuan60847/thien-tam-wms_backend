import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  dateRangeFilter,
  paginate,
  parseSort,
  toOrderBy,
  type PagedResponse,
} from '../common/pagination/paginate.js';
import { RequestContext } from '../common/request-context/request-context.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { QueryAuditDto } from './dto/query-audit.dto.js';

const SORT_WHITELIST = ['createdAt', 'hanhDong', 'doiTuong'] as const;

export interface AuditLogItem {
  id: string;
  hanhDong: string;
  doiTuong: string;
  doiTuongId: string | null;
  truoc: unknown;
  sau: unknown;
  lyDo: string | null;
  ip: string | null;
  requestId: string | null;
  createdAt: Date;
  user: { id: string; maNV: string; hoTen: string } | null;
}

export interface AuditEntry {
  // <domain>.<verb>, e.g. 'phieu_xuat.cancel_after_issue'
  hanhDong: string;
  doiTuong: string;
  doiTuongId?: string | null;
  // Snapshots of the relevant fields only; never passwords or tokens.
  truoc?: Prisma.InputJsonValue | null;
  sau?: Prisma.InputJsonValue | null;
  lyDo?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  // Pass the caller's transaction so the log row commits or rolls back with the action.
  record(entry: AuditEntry, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.nhatKyHeThong.create({
      data: {
        hanhDong: entry.hanhDong,
        doiTuong: entry.doiTuong,
        doiTuongId: entry.doiTuongId ?? null,
        truoc: entry.truoc ?? undefined,
        sau: entry.sau ?? undefined,
        lyDo: entry.lyDo ?? null,
        userId: RequestContext.userId(),
        ip: RequestContext.ip(),
        requestId: RequestContext.requestId(),
      },
    });
  }

  async findAll(query: QueryAuditDto): Promise<PagedResponse<AuditLogItem>> {
    const where: Prisma.NhatKyHeThongWhereInput = {
      hanhDong: query.hanhDong,
      doiTuong: query.doiTuong,
      doiTuongId: query.doiTuongId,
      userId: query.userId,
      createdAt: dateRangeFilter(query.createdAtFrom, query.createdAtTo),
    };
    const orderBy = toOrderBy(
      parseSort(query.sort, SORT_WHITELIST, [
        { field: 'createdAt', direction: 'desc' },
      ]),
    ) as Prisma.NhatKyHeThongOrderByWithRelationInput[];

    return paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.nhatKyHeThong.findMany({
          where,
          orderBy,
          skip,
          take,
          include: { user: { select: { id: true, maNV: true, hoTen: true } } },
        }),
      count: () => this.prisma.nhatKyHeThong.count({ where }),
    });
  }
}
