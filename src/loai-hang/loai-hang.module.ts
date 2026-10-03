import { Module } from '@nestjs/common';
import { LoaiHangController } from './loai-hang.controller.js';
import { LoaiHangService } from './loai-hang.service.js';

@Module({
  controllers: [LoaiHangController],
  providers: [LoaiHangService],
  exports: [LoaiHangService],
})
export class LoaiHangModule {}
