import { Module } from '@nestjs/common';
import { NhanVienKinhDoanhModule } from '../nhan-vien-kinh-doanh/nhan-vien-kinh-doanh.module.js';
import { PhieuXuatHangModule } from '../phieu-xuat-hang/phieu-xuat-hang.module.js';
import {
  CongNoKhachHangController,
  PhieuThuCongNoController,
} from './phieu-thu-cong-no.controller.js';
import { PhieuThuCongNoService } from './phieu-thu-cong-no.service.js';

@Module({
  imports: [PhieuXuatHangModule, NhanVienKinhDoanhModule],
  controllers: [PhieuThuCongNoController, CongNoKhachHangController],
  providers: [PhieuThuCongNoService],
  exports: [PhieuThuCongNoService],
})
export class PhieuThuCongNoModule {}
