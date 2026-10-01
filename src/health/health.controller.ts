import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../auth/decorators/public.decorator.js';
import { PrismaHealthIndicator } from './prisma.health.js';

const HEAP_LIMIT_BYTES = 400 * 1024 * 1024;

@ApiTags('Hệ thống')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: PrismaHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Kiểm tra sẵn sàng (DB, bộ nhớ)' })
  async ready() {
    const result = await this.health.check([
      () => this.database.isHealthy('database'),
      () => this.memory.checkHeap('memory_heap', HEAP_LIMIT_BYTES),
    ]);
    return { ...result, uptime: Math.round(process.uptime()) };
  }

  @Get('live')
  @ApiOperation({ summary: 'Kiểm tra tiến trình còn sống' })
  live() {
    return { status: 'ok' };
  }
}
