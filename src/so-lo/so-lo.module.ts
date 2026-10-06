import { Module } from '@nestjs/common';
import { HangHoaModule } from '../hang-hoa/hang-hoa.module.js';
import { SoLoController } from './so-lo.controller.js';
import { SoLoService } from './so-lo.service.js';

@Module({
  imports: [HangHoaModule],
  controllers: [SoLoController],
  providers: [SoLoService],
  exports: [SoLoService],
})
export class SoLoModule {}
