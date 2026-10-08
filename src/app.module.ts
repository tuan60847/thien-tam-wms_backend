import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, type ConfigType } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ClockModule } from './common/clock/clock.module.js';
import { CodeGeneratorModule } from './common/code-generator/code-generator.module.js';
import { ErrorsModule } from './common/errors/errors.module.js';
import { RequestContextMiddleware } from './common/request-context/request-context.js';
import { appConfig } from './config/app.config.js';
import { HangHoaModule } from './hang-hoa/hang-hoa.module.js';
import { KhachHangModule } from './khach-hang/khach-hang.module.js';
import { KhoViTriModule } from './kho-vi-tri/kho-vi-tri.module.js';
import { HealthModule } from './health/health.module.js';
import { LoaiHangModule } from './loai-hang/loai-hang.module.js';
import { NhaCungCapModule } from './nha-cung-cap/nha-cung-cap.module.js';
import { PhieuNhapHangModule } from './phieu-nhap-hang/phieu-nhap-hang.module.js';
import { PhieuThuCongNoModule } from './phieu-thu-cong-no/phieu-thu-cong-no.module.js';
import { PhieuXuatHangModule } from './phieu-xuat-hang/phieu-xuat-hang.module.js';
import { PhieuThanhToanModule } from './phieu-thanh-toan/phieu-thanh-toan.module.js';
import { PhuongTienVanChuyenModule } from './phuong-tien-van-chuyen/phuong-tien-van-chuyen.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RolesModule } from './roles/roles.module.js';
import { SoLoModule } from './so-lo/so-lo.module.js';
import { TonKhoModule } from './ton-kho/ton-kho.module.js';
import { TepDinhKemModule } from './tep-dinh-kem/tep-dinh-kem.module.js';
import { TyLeQuyDoiModule } from './ty-le-quy-doi/ty-le-quy-doi.module.js';
import { UsersModule } from './users/users.module.js';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }),
    LoggerModule.forRootAsync({
      inject: [appConfig.KEY],
      useFactory: (config: ConfigType<typeof appConfig>) => ({
        pinoHttp: {
          level: config.logLevel,
          // Reuse a well-formed client request id, otherwise generate one;
          // always echoed back so support can trace a failure by requestId.
          genReqId: (req, res) => {
            const given = req.headers['x-request-id'];
            const id =
              typeof given === 'string' && REQUEST_ID_PATTERN.test(given)
                ? given
                : randomUUID();
            res.setHeader('x-request-id', id);
            return id;
          },
          autoLogging: { ignore: (req) => (req.url ?? '').includes('/health') },
          customLogLevel: (_req, res, error) =>
            error || res.statusCode >= 500
              ? 'error'
              : res.statusCode >= 400
                ? 'warn'
                : 'info',
          serializers: {
            req: (req: { id: string; method: string; url: string }) => ({
              id: req.id,
              method: req.method,
              url: req.url,
            }),
            res: (res: { statusCode: number }) => ({
              statusCode: res.statusCode,
            }),
          },
          customProps: (req) => ({
            userId: (req as { user?: { id?: string } }).user?.id ?? null,
          }),
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
              '*.password',
              '*.accessToken',
              '*.refreshToken',
              '*.tokenHash',
              '*.email',
              '*.SDT',
              '*.maSoThue',
            ],
            censor: '[REDACTED]',
          },
          transport:
            config.nodeEnv === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
        },
      }),
    }),
    // Only POST /auth/login opts in (ThrottlerGuard on that route); other routes are not limited.
    ThrottlerModule.forRootAsync({
      inject: [appConfig.KEY],
      useFactory: (config: ConfigType<typeof appConfig>) => ({
        throttlers: [
          { name: 'login', ttl: 60_000, limit: config.loginRateLimit },
        ],
      }),
    }),
    ScheduleModule.forRoot(),
    ClockModule,
    ErrorsModule,
    CodeGeneratorModule,
    PrismaModule,
    AuditModule,
    RolesModule,
    UsersModule,
    LoaiHangModule,
    HangHoaModule,
    TyLeQuyDoiModule,
    KhoViTriModule,
    KhachHangModule,
    NhaCungCapModule,
    PhuongTienVanChuyenModule,
    SoLoModule,
    TonKhoModule,
    PhieuNhapHangModule,
    PhieuThanhToanModule,
    PhieuXuatHangModule,
    PhieuThuCongNoModule,
    TepDinhKemModule,
    AuthModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
