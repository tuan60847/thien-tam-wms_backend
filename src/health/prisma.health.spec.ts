import { HealthIndicatorService } from '@nestjs/terminus';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PrismaHealthIndicator } from './prisma.health.js';

function setup(queryRaw: () => Promise<unknown>) {
  const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
  return new PrismaHealthIndicator(prisma, new HealthIndicatorService());
}

describe('PrismaHealthIndicator', () => {
  it('DB trả lời → up', async () => {
    const result = await setup(async () => [{ 1: 1 }]).isHealthy('database');
    expect(result.database.status).toBe('up');
  });

  it('DB lỗi → down, không lộ chi tiết kết nối', async () => {
    const result = await setup(async () => {
      throw new Error('connect ECONNREFUSED mysql://root:secret@db');
    }).isHealthy('database');
    expect(result.database.status).toBe('down');
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('DB treo quá thời hạn → down', async () => {
    vi.useFakeTimers();
    const pending = setup(() => new Promise(() => {})).isHealthy('database');
    await vi.advanceTimersByTimeAsync(2500);
    expect((await pending).database.status).toBe('down');
    vi.useRealTimers();
  });
});
