import { Module } from '@nestjs/common';
import { DieuKhoanThanhToanController } from './dieu-khoan-thanh-toan.controller.js';
import { DieuKhoanThanhToanService } from './dieu-khoan-thanh-toan.service.js';

@Module({
  controllers: [DieuKhoanThanhToanController],
  providers: [DieuKhoanThanhToanService],
  exports: [DieuKhoanThanhToanService],
})
export class DieuKhoanThanhToanModule {}
