import { Module } from '@nestjs/common';
import { KhachHangController } from './khach-hang.controller.js';
import { KhachHangService } from './khach-hang.service.js';

@Module({
  controllers: [KhachHangController],
  providers: [KhachHangService],
  exports: [KhachHangService],
})
export class KhachHangModule {}
