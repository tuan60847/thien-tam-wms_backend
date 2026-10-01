import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter } from './http-exception.filter.js';

@Global()
@Module({
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class ErrorsModule {}
