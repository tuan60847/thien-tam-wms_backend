import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) {}

  // Revokes every still-valid refresh token of a user (lock, password change,
  // role change, token reuse detection). Returns how many were revoked.
  async revokeAllForUser(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.prisma;
    const { count } = await client.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count;
  }

  // Deletes tokens that expired before `before` (housekeeping job).
  async purgeExpired(before: Date): Promise<number> {
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: before } },
    });
    return count;
  }
}
