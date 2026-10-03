import { Module } from '@nestjs/common';
import { LoaiHangModule } from '../loai-hang/loai-hang.module.js';
import { HangHoaController } from './hang-hoa.controller.js';
import { HangHoaService } from './hang-hoa.service.js';

@Module({
  imports: [LoaiHangModule],
  controllers: [HangHoaController],
  providers: [HangHoaService],
  exports: [HangHoaService],
})
export class HangHoaModule {}
