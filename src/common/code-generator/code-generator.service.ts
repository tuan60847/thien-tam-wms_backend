import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ClockService } from '../clock/clock.service.js';
import { toVnDateString } from '../clock/vn-date.js';
import { formatCode, toDateKey, type CodeSpec } from './code-specs.js';

@Injectable()
export class CodeGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  // Returns the next code. Pass the caller's transaction so the counter row stays
  // locked until the record using the code commits (serialises concurrent creators
  // of the same prefix/day). Without tx a short internal transaction is used and a
  // rolled-back caller simply leaves a gap in the sequence.
  async next(spec: CodeSpec, tx?: Prisma.TransactionClient): Promise<string> {
    if (!tx) {
      return this.prisma.$transaction((inner) => this.next(spec, inner));
    }
    const dateOnly = toVnDateString(this.clock.now());
    const dateKey = toDateKey(dateOnly);
    const sequence = await this.increment(
      tx,
      spec.prefix,
      spec.dated ? dateKey : '',
    );
    return formatCode(spec, sequence, dateKey);
  }

  // Makes sure the next code for a non-dated counter is greater than `floor`
  // (used when records with explicit codes already exist).
  async ensureAtLeast(
    spec: CodeSpec,
    floor: number,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.$executeRaw`
      INSERT INTO bo_dem_ma (tien_to, ngay, gia_tri)
      VALUES (${spec.prefix}, '', ${floor})
      ON DUPLICATE KEY UPDATE gia_tri = GREATEST(gia_tri, ${floor})`;
  }

  // Atomic increment-or-create. A single INSERT ... ON DUPLICATE KEY UPDATE avoids the
  // gap-lock deadlocks that "UPDATE, then INSERT if missing" causes when many
  // transactions create the first row of a counter at the same time.
  private async increment(
    tx: Prisma.TransactionClient,
    tienTo: string,
    ngay: string,
  ): Promise<number> {
    await tx.$executeRaw`
      INSERT INTO bo_dem_ma (tien_to, ngay, gia_tri)
      VALUES (${tienTo}, ${ngay}, 1)
      ON DUPLICATE KEY UPDATE gia_tri = gia_tri + 1`;
    const rows = await tx.$queryRaw<{ gia_tri: number }[]>`
      SELECT gia_tri FROM bo_dem_ma WHERE tien_to = ${tienTo} AND ngay = ${ngay}`;
    const value = rows[0]?.gia_tri;
    if (value === undefined) {
      throw new Error(`Could not allocate a code for prefix ${tienTo}`);
    }
    return Number(value);
  }
}
