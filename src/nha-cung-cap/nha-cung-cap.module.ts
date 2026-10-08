import { Module } from '@nestjs/common';
import { DieuKhoanThanhToanModule } from '../dieu-khoan-thanh-toan/dieu-khoan-thanh-toan.module.js';
import { NhanVienKinhDoanhModule } from '../nhan-vien-kinh-doanh/nhan-vien-kinh-doanh.module.js';
import { NhomDoiTacModule } from '../nhom-doi-tac/nhom-doi-tac.module.js';
import { NhaCungCapController } from './nha-cung-cap.controller.js';
import { NhaCungCapService } from './nha-cung-cap.service.js';

@Module({
  imports: [
    NhomDoiTacModule,
    DieuKhoanThanhToanModule,
    NhanVienKinhDoanhModule,
  ],
  controllers: [NhaCungCapController],
  providers: [NhaCungCapService],
  exports: [NhaCungCapService],
})
export class NhaCungCapModule {}
