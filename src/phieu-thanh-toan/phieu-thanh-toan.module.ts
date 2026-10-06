import { Module } from '@nestjs/common';
import { PhieuNhapHangModule } from '../phieu-nhap-hang/phieu-nhap-hang.module.js';
import {
  CongNoNhaCungCapController,
  PhieuThanhToanController,
} from './phieu-thanh-toan.controller.js';
import { PhieuThanhToanService } from './phieu-thanh-toan.service.js';

@Module({
  imports: [PhieuNhapHangModule],
  controllers: [PhieuThanhToanController, CongNoNhaCungCapController],
  providers: [PhieuThanhToanService],
  exports: [PhieuThanhToanService],
})
export class PhieuThanhToanModule {}
