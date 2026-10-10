import { Injectable } from '@nestjs/common';
import { Prisma, type TaiKhoanNganHang } from '@prisma/client';
import { AppException } from '../common/errors/app.exception.js';
import { KhachHangService } from '../khach-hang/khach-hang.service.js';
import { NhaCungCapService } from '../nha-cung-cap/nha-cung-cap.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateTaiKhoanNganHangDto,
  TaiKhoanNganHangResponseDto,
  UpdateTaiKhoanNganHangDto,
} from './dto/tai-khoan-ngan-hang.dto.js';

// A bank account belongs to exactly one customer or one supplier.
export type BankAccountOwner =
  { khachHangId: string } | { nhaCungCapId: string };

const toResponse = (row: TaiKhoanNganHang): TaiKhoanNganHangResponseDto => ({
  id: row.id,
  soTaiKhoan: row.soTaiKhoan,
  tenNganHang: row.tenNganHang,
  chiNhanh: row.chiNhanh,
  tinhTpNganHang: row.tinhTpNganHang,
});

@Injectable()
export class TaiKhoanNganHangService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly khachHang: KhachHangService,
    private readonly nhaCungCap: NhaCungCapService,
  ) {}

  async findAll(
    owner: BankAccountOwner,
  ): Promise<TaiKhoanNganHangResponseDto[]> {
    await this.assertOwner(owner);
    const rows = await this.prisma.taiKhoanNganHang.findMany({
      where: owner,
      orderBy: [{ tenNganHang: 'asc' }, { soTaiKhoan: 'asc' }],
    });
    return rows.map(toResponse);
  }

  async create(
    owner: BankAccountOwner,
    dto: CreateTaiKhoanNganHangDto,
  ): Promise<TaiKhoanNganHangResponseDto> {
    return this.guardDuplicate(() =>
      this.prisma.$transaction(async (tx) => {
        await this.assertOwner(owner, tx);
        await this.assertUnique(owner, dto.soTaiKhoan, dto.tenNganHang, tx);
        const created = await tx.taiKhoanNganHang.create({
          data: {
            ...owner,
            soTaiKhoan: dto.soTaiKhoan,
            tenNganHang: dto.tenNganHang,
            chiNhanh: dto.chiNhanh ?? null,
            tinhTpNganHang: dto.tinhTpNganHang ?? null,
          },
        });
        return toResponse(created);
      }),
    );
  }

  async update(
    owner: BankAccountOwner,
    id: string,
    dto: UpdateTaiKhoanNganHangDto,
  ): Promise<TaiKhoanNganHangResponseDto> {
    return this.guardDuplicate(() =>
      this.prisma.$transaction(async (tx) => {
        const current = await this.findOwned(owner, id, tx);
        const soTaiKhoan = dto.soTaiKhoan ?? current.soTaiKhoan;
        const tenNganHang = dto.tenNganHang ?? current.tenNganHang;
        if (
          soTaiKhoan !== current.soTaiKhoan ||
          tenNganHang !== current.tenNganHang
        ) {
          await this.assertUnique(owner, soTaiKhoan, tenNganHang, tx, id);
        }
        const updated = await tx.taiKhoanNganHang.update({
          where: { id },
          data: {
            soTaiKhoan,
            tenNganHang,
            chiNhanh: dto.chiNhanh,
            tinhTpNganHang: dto.tinhTpNganHang,
          },
        });
        return toResponse(updated);
      }),
    );
  }

  async remove(owner: BankAccountOwner, id: string): Promise<void> {
    await this.findOwned(owner, id);
    await this.prisma.taiKhoanNganHang.delete({ where: { id } });
  }

  // The unique index is the final guard: two simultaneous identical inserts both pass the
  // pre-check, and the loser is reported like any other duplicate.
  private async guardDuplicate<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppException('TAI_KHOAN_NGAN_HANG_DUPLICATE');
      }
      throw error;
    }
  }

  private async assertOwner(
    owner: BankAccountOwner,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if ('khachHangId' in owner) {
      await this.khachHang.findByIdOrThrow(owner.khachHangId, tx);
    } else {
      await this.nhaCungCap.findByIdOrThrow(owner.nhaCungCapId, tx);
    }
  }

  // An id belonging to another owner is reported as not found.
  private async findOwned(
    owner: BankAccountOwner,
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<TaiKhoanNganHang> {
    const row = await (tx ?? this.prisma).taiKhoanNganHang.findFirst({
      where: { id, ...owner },
    });
    if (!row) {
      throw new AppException('TAI_KHOAN_NGAN_HANG_NOT_FOUND');
    }
    return row;
  }

  private async assertUnique(
    owner: BankAccountOwner,
    soTaiKhoan: string,
    tenNganHang: string,
    tx: Prisma.TransactionClient,
    exceptId?: string,
  ): Promise<void> {
    const duplicate = await tx.taiKhoanNganHang.count({
      where: {
        ...owner,
        soTaiKhoan,
        tenNganHang,
        id: exceptId ? { not: exceptId } : undefined,
      },
    });
    if (duplicate > 0) {
      throw new AppException('TAI_KHOAN_NGAN_HANG_DUPLICATE');
    }
  }
}
