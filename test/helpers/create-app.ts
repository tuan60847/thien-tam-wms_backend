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
  // Listen once on a free port: left alone, supertest would open and close a server for
  // every request, and long suites then hit intermittent cross-talk between those servers.
  await app.listen(0, '127.0.0.1');
  return app;
}
