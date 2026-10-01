import { timingSafeEqual } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import type { AppConfig } from '../../config/app.config.js';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function basicAuth(user: string, password: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization ?? '';
    const [scheme, encoded] = header.split(' ');
    if (scheme === 'Basic' && encoded) {
      const [givenUser = '', ...rest] = Buffer.from(encoded, 'base64')
        .toString()
        .split(':');
      if (safeEqual(givenUser, user) && safeEqual(rest.join(':'), password)) {
        next();
        return;
      }
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="ThienTamWMS API docs"');
    res.status(401).send('Unauthorized');
  };
}

// Swagger UI at /api/docs, JSON at /api/docs-json. Off by default in production;
// when enabled there it is protected by basic auth.
export function setupSwagger(app: INestApplication, config: AppConfig): void {
  if (!config.swaggerEnabled) {
    return;
  }
  if (config.swaggerUser && config.swaggerPassword) {
    app.use(
      ['/api/docs', '/api/docs-json'],
      basicAuth(config.swaggerUser, config.swaggerPassword),
    );
  }
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('ThienTamWMS API')
      .setDescription('Hệ thống quản lý kho thuốc cho nhà phân phối')
      .setVersion('0.0.1')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
  });
}
