import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { loadAppConfig } from '../../src/config/app.config.js';

// Builds the app with the same pipeline as main.ts (prefix, validation, helmet, ...).
export async function createTestApp(
  options: { controllers?: Type<unknown>[] } = {},
): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: options.controllers ?? [],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app, loadAppConfig(process.env));
  await app.init();
  return app;
}
