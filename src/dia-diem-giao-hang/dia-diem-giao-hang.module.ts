import { Module } from '@nestjs/common';
import { KhachHangModule } from '../khach-hang/khach-hang.module.js';
import { DiaDiemGiaoHangController } from './dia-diem-giao-hang.controller.js';
import { DiaDiemGiaoHangService } from './dia-diem-giao-hang.service.js';

@Module({
  imports: [KhachHangModule],
  controllers: [DiaDiemGiaoHangController],
  providers: [DiaDiemGiaoHangService],
  exports: [DiaDiemGiaoHangService],
})
export class DiaDiemGiaoHangModule {}
