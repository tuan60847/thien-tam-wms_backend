import { Injectable, Logger } from '@nestjs/common';
import type { ReadStream } from 'node:fs';
import { AuditService } from '../audit/audit.service.js';
import { ROLE, type RoleCode } from '../auth/roles.constants.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { AppException } from '../common/errors/app.exception.js';
import {
  paginate,
  parseSort,
  toOrderBy,
  type PagedResponse,
} from '../common/pagination/paginate.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  LoaiDoiTuongTepValue,
  QueryTepDto,
  TepDinhKemResponseDto,
  UploadTepDto,
} from './dto/tep-dinh-kem.dto.js';
import { FileStorageService } from './file-storage.service.js';
import {
  decodeUploadedName,
  detectMime,
  extensionFor,
  MAX_FILE_BYTES,
  MAX_FILES_PER_TARGET,
  sanitizeFileName,
} from './tep-dinh-kem.rules.js';

export interface UploadedBinary {
  originalname: string;
  size: number;
  buffer: Buffer;
}

const SORT_WHITELIST = ['createdAt', 'tenFile', 'kichThuoc'] as const;

// Who may attach / remove files = who may edit the target (docs/03-cross-cutting/permissions.md).
// Reading is open to every authenticated role, like reading the target itself.
const WRITERS: Record<LoaiDoiTuongTepValue, RoleCode[]> = {
  khach_hang: [ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.KE_TOAN],
  nha_cung_cap: [ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.KE_TOAN],
  hang_hoa: [ROLE.ADMIN, ROLE.QUAN_LY_KHO],
  phieu_nhap_hang: [ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.NHAN_VIEN_KHO],
  so_lo: [ROLE.ADMIN, ROLE.QUAN_LY_KHO],
};

const userSelect = { select: { id: true, maNV: true, hoTen: true } } as const;

@Injectable()
export class TepDinhKemService {
  private readonly logger = new Logger(TepDinhKemService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorageService,
    private readonly audit: AuditService,
  ) {}

  findAll(query: QueryTepDto): Promise<PagedResponse<TepDinhKemResponseDto>> {
    const where = {
      loaiDoiTuong: query.loaiDoiTuong,
      doiTuongId: query.doiTuongId,
    };
    const orderBy = toOrderBy(
      parseSort(query.sort, SORT_WHITELIST, [
        { field: 'createdAt', direction: 'desc' },
      ]),
    ) as Record<string, 'asc' | 'desc'>[];
    return paginate({
      page: query.page,
      pageSize: query.pageSize,
      findMany: ({ skip, take }) =>
        this.prisma.tepDinhKem.findMany({
          where,
          orderBy,
          skip,
          take,
          include: { createdBy: userSelect },
        }),
      count: () => this.prisma.tepDinhKem.count({ where }),
      map: (row) => ({
        id: row.id,
        loaiDoiTuong: row.loaiDoiTuong,
        doiTuongId: row.doiTuongId,
        tenFile: row.tenFile,
        mime: row.mime,
        kichThuoc: row.kichThuoc,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
      }),
    });
  }

  async upload(
    file: UploadedBinary | undefined,
    dto: UploadTepDto,
    actor: AuthenticatedUser,
  ): Promise<TepDinhKemResponseDto> {
    if (!file || file.size === 0) {
      throw new AppException('TEP_NO_FILE');
    }
    this.assertMayWrite(dto.loaiDoiTuong, actor);
    if (file.size > MAX_FILE_BYTES) {
      throw new AppException('COMMON_PAYLOAD_TOO_LARGE');
    }
    const mime = detectMime(file.buffer);
    if (!mime) {
      throw new AppException('TEP_TYPE_NOT_ALLOWED');
    }
    await this.assertTargetAcceptsFiles(dto.loaiDoiTuong, dto.doiTuongId);

    let duongDan: string;
    try {
      duongDan = await this.storage.save(
        dto.loaiDoiTuong,
        extensionFor(mime),
        file.buffer,
      );
    } catch (error) {
      this.logger.error(error);
      throw new AppException('TEP_STORAGE_FAILED');
    }
    try {
      const row = await this.prisma.tepDinhKem.create({
        data: {
          loaiDoiTuong: dto.loaiDoiTuong,
          doiTuongId: dto.doiTuongId,
          tenFile: sanitizeFileName(
            decodeUploadedName(file.originalname),
            mime,
          ),
          mime,
          kichThuoc: file.size,
          duongDan,
          createdById: actor.id,
        },
        include: { createdBy: userSelect },
      });
      return {
        id: row.id,
        loaiDoiTuong: row.loaiDoiTuong,
        doiTuongId: row.doiTuongId,
        tenFile: row.tenFile,
        mime: row.mime,
        kichThuoc: row.kichThuoc,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
      };
    } catch (error) {
      // Compensate: do not leave an unreferenced file behind.
      await this.storage.remove(duongDan).catch((e: unknown) => {
        this.logger.error(
          `Could not remove orphan file ${duongDan}: ${String(e)}`,
        );
      });
      throw error;
    }
  }

  async download(id: string): Promise<{
    stream: ReadStream;
    tenFile: string;
    mime: string;
    kichThuoc: number;
  }> {
    const row = await this.prisma.tepDinhKem.findUnique({ where: { id } });
    if (!row) {
      throw new AppException('TEP_NOT_FOUND');
    }
    const stream = await this.storage.open(row.duongDan);
    if (!stream) {
      this.logger.error(`File missing on disk for attachment ${id}`);
      throw new AppException('TEP_NOT_FOUND');
    }
    return {
      stream,
      tenFile: row.tenFile,
      mime: row.mime,
      kichThuoc: row.kichThuoc,
    };
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const row = await this.prisma.tepDinhKem.findUnique({ where: { id } });
    if (!row) {
      throw new AppException('TEP_NOT_FOUND');
    }
    this.assertMayWrite(row.loaiDoiTuong, actor);
    await this.prisma.$transaction(async (tx) => {
      await tx.tepDinhKem.delete({ where: { id } });
      await this.audit.record(
        {
          hanhDong: 'tep_dinh_kem.delete',
          doiTuong: 'tep_dinh_kem',
          doiTuongId: id,
          truoc: {
            loaiDoiTuong: row.loaiDoiTuong,
            doiTuongId: row.doiTuongId,
            tenFile: row.tenFile,
          },
        },
        tx,
      );
    });
    // After the DB commit: a failure here only leaves a harmless orphan file.
    await this.storage.remove(row.duongDan).catch((e: unknown) => {
      this.logger.error(`Could not remove file ${row.duongDan}: ${String(e)}`);
    });
  }

  private assertMayWrite(
    loai: LoaiDoiTuongTepValue,
    actor: AuthenticatedUser,
  ): void {
    const role = actor.role?.maRole as RoleCode | undefined;
    if (!role || !WRITERS[loai].includes(role)) {
      throw new AppException('AUTH_FORBIDDEN');
    }
  }

  private async assertTargetAcceptsFiles(
    loai: LoaiDoiTuongTepValue,
    doiTuongId: string,
  ): Promise<void> {
    const exists = await this.targetExists(loai, doiTuongId);
    const count = exists
      ? await this.prisma.tepDinhKem.count({
          where: { loaiDoiTuong: loai, doiTuongId },
        })
      : 0;
    if (!exists || count >= MAX_FILES_PER_TARGET) {
      throw new AppException('TEP_TARGET_INVALID');
    }
  }

  private async targetExists(
    loai: LoaiDoiTuongTepValue,
    id: string,
  ): Promise<boolean> {
    const where = { id };
    switch (loai) {
      case 'khach_hang':
        return (await this.prisma.khachHang.count({ where })) > 0;
      case 'nha_cung_cap':
        return (await this.prisma.nhaCungCap.count({ where })) > 0;
      case 'hang_hoa':
        return (await this.prisma.hangHoa.count({ where })) > 0;
      case 'phieu_nhap_hang':
        return (await this.prisma.phieuNhapHang.count({ where })) > 0;
      case 'so_lo':
        return (await this.prisma.soLo.count({ where })) > 0;
    }
  }
}
