import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { setupSwagger } from './common/swagger/setup-swagger.js';
import { appConfig, type AppConfig } from './config/app.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get<AppConfig>(appConfig.KEY);
  configureApp(app, config);
  setupSwagger(app, config);
  // Lets PrismaService disconnect cleanly when PM2 stops the process.
  app.enableShutdownHooks();

  await app.listen(config.port);
}
await bootstrap();
