import { Module } from '@nestjs/common';
import { PhuongTienController } from './phuong-tien.controller.js';
import { PhuongTienService } from './phuong-tien.service.js';

@Module({
  controllers: [PhuongTienController],
  providers: [PhuongTienService],
  exports: [PhuongTienService],
})
export class PhuongTienVanChuyenModule {}
