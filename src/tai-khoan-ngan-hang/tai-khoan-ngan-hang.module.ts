import { Module } from '@nestjs/common';
import { KhachHangModule } from '../khach-hang/khach-hang.module.js';
import { NhaCungCapModule } from '../nha-cung-cap/nha-cung-cap.module.js';
import {
  KhachHangNganHangController,
  NhaCungCapNganHangController,
} from './tai-khoan-ngan-hang.controller.js';
import { TaiKhoanNganHangService } from './tai-khoan-ngan-hang.service.js';

@Module({
  imports: [KhachHangModule, NhaCungCapModule],
  controllers: [KhachHangNganHangController, NhaCungCapNganHangController],
  providers: [TaiKhoanNganHangService],
})
export class TaiKhoanNganHangModule {}
