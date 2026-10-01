import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { validationExceptionFactory } from './common/errors/validation.js';
import type { AppConfig } from './config/app.config.js';

export const API_PREFIX = 'api/v1';

// Configuration shared by main.ts and the e2e tests so tests run against the
// same pipeline as production.
export function configureApp(
  app: INestApplication,
  config?: Pick<AppConfig, 'corsOrigins' | 'trustProxy'>,
): void {
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );

  if (config) {
    // Pure JSON API: CSP adds nothing and breaks Swagger UI.
    app.use(helmet({ contentSecurityPolicy: false }));
    if (config.corsOrigins.length > 0) {
      app.enableCors({ origin: config.corsOrigins });
    }
    if (config.trustProxy !== false) {
      (app as NestExpressApplication).set('trust proxy', config.trustProxy);
    }
  }
}
