import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service.js';

const DB_TIMEOUT_MS = 2000;

@Injectable()
export class PrismaHealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly indicator: HealthIndicatorService,
  ) {}

  async isHealthy<Key extends string>(key: Key) {
    const session = this.indicator.check(key);
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), DB_TIMEOUT_MS),
        ),
      ]);
      return session.up();
    } catch {
      // Never leak connection details; only report the status.
      return session.down();
    }
  }
}
