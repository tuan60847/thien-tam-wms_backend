import { Module } from '@nestjs/common';
import { KhoController } from './kho.controller.js';
import { KhoService } from './kho.service.js';
import { ViTriController } from './vi-tri.controller.js';
import { ViTriService } from './vi-tri.service.js';

@Module({
  controllers: [KhoController, ViTriController],
  providers: [KhoService, ViTriService],
  exports: [KhoService, ViTriService],
})
export class KhoViTriModule {}
