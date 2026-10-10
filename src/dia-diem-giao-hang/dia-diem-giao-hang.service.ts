import { Injectable } from '@nestjs/common';
import type { DiaDiemGiaoHang, Prisma } from '@prisma/client';
import { AppException } from '../common/errors/app.exception.js';
import { KhachHangService } from '../khach-hang/khach-hang.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateDiaDiemGiaoHangDto,
  DiaDiemGiaoHangResponseDto,
  UpdateDiaDiemGiaoHangDto,
} from './dto/dia-diem-giao-hang.dto.js';

const toResponse = (row: DiaDiemGiaoHang): DiaDiemGiaoHangResponseDto => ({
  id: row.id,
  diaDiem: row.diaDiem,
  laMacDinh: row.laMacDinh,
});

// Exactly one default per customer as soon as the customer has any location.
// Every write first locks the customer row so concurrent edits serialize.
@Injectable()
export class DiaDiemGiaoHangService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly khachHang: KhachHangService,
  ) {}

  async findAll(khachHangId: string): Promise<DiaDiemGiaoHangResponseDto[]> {
    await this.khachHang.findByIdOrThrow(khachHangId);
    const rows = await this.prisma.diaDiemGiaoHang.findMany({
      where: { khachHangId },
      orderBy: [{ laMacDinh: 'desc' }, { diaDiem: 'asc' }],
    });
    return rows.map(toResponse);
  }

  create(
    khachHangId: string,
    dto: CreateDiaDiemGiaoHangDto,
  ): Promise<DiaDiemGiaoHangResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockCustomer(khachHangId, tx);
      await this.assertUnique(khachHangId, dto.diaDiem, tx);
      const isFirst =
        (await tx.diaDiemGiaoHang.count({ where: { khachHangId } })) === 0;
      const makeDefault = isFirst || dto.laMacDinh === true;
      if (makeDefault) {
        await this.clearDefault(khachHangId, tx);
      }
      return toResponse(
        await tx.diaDiemGiaoHang.create({
          data: { khachHangId, diaDiem: dto.diaDiem, laMacDinh: makeDefault },
        }),
      );
    });
  }

  update(
    khachHangId: string,
    id: string,
    dto: UpdateDiaDiemGiaoHangDto,
  ): Promise<DiaDiemGiaoHangResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockCustomer(khachHangId, tx);
      const current = await this.findOwned(khachHangId, id, tx);
      if (dto.diaDiem !== undefined && dto.diaDiem !== current.diaDiem) {
        await this.assertUnique(khachHangId, dto.diaDiem, tx, id);
      }
      // The default can only be moved by choosing another one, never switched off.
      const makeDefault = dto.laMacDinh === true && !current.laMacDinh;
      if (makeDefault) {
        await this.clearDefault(khachHangId, tx);
      }
      return toResponse(
        await tx.diaDiemGiaoHang.update({
          where: { id },
          data: {
            diaDiem: dto.diaDiem,
            laMacDinh: makeDefault ? true : undefined,
          },
        }),
      );
    });
  }

  remove(khachHangId: string, id: string): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockCustomer(khachHangId, tx);
      const current = await this.findOwned(khachHangId, id, tx);
      await tx.diaDiemGiaoHang.delete({ where: { id } });
      if (current.laMacDinh) {
        // Hand the default to the next location (alphabetical) so one always remains.
        const next = await tx.diaDiemGiaoHang.findFirst({
          where: { khachHangId },
          orderBy: { diaDiem: 'asc' },
        });
        if (next) {
          await tx.diaDiemGiaoHang.update({
            where: { id: next.id },
            data: { laMacDinh: true },
          });
        }
      }
    });
  }

  private async lockCustomer(
    khachHangId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$queryRaw`SELECT id FROM khach_hang WHERE id = ${khachHangId} FOR UPDATE`;
    await this.khachHang.findByIdOrThrow(khachHangId, tx);
  }

  private clearDefault(khachHangId: string, tx: Prisma.TransactionClient) {
    return tx.diaDiemGiaoHang.updateMany({
      where: { khachHangId, laMacDinh: true },
      data: { laMacDinh: false },
    });
  }

  private async findOwned(
    khachHangId: string,
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<DiaDiemGiaoHang> {
    const row = await tx.diaDiemGiaoHang.findFirst({
      where: { id, khachHangId },
    });
    if (!row) {
      throw new AppException('DIA_DIEM_GIAO_HANG_NOT_FOUND');
    }
    return row;
  }

  private async assertUnique(
    khachHangId: string,
    diaDiem: string,
    tx: Prisma.TransactionClient,
    exceptId?: string,
  ): Promise<void> {
    const count = await tx.diaDiemGiaoHang.count({
      where: {
        khachHangId,
        diaDiem,
        id: exceptId ? { not: exceptId } : undefined,
      },
    });
    if (count > 0) {
      throw new AppException('DIA_DIEM_GIAO_HANG_DUPLICATE');
    }
  }
}
