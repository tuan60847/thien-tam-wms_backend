import { Module } from '@nestjs/common';
import { DieuKhoanThanhToanModule } from '../dieu-khoan-thanh-toan/dieu-khoan-thanh-toan.module.js';
import { NhanVienKinhDoanhModule } from '../nhan-vien-kinh-doanh/nhan-vien-kinh-doanh.module.js';
import { NhomDoiTacModule } from '../nhom-doi-tac/nhom-doi-tac.module.js';
import { KhachHangController } from './khach-hang.controller.js';
import { KhachHangService } from './khach-hang.service.js';

@Module({
  imports: [
    NhomDoiTacModule,
    DieuKhoanThanhToanModule,
    NhanVienKinhDoanhModule,
  ],
  controllers: [KhachHangController],
  providers: [KhachHangService],
  exports: [KhachHangService],
})
export class KhachHangModule {}
