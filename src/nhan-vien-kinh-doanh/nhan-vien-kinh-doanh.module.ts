import { Module } from '@nestjs/common';
import { NhanVienKinhDoanhController } from './nhan-vien-kinh-doanh.controller.js';
import { NhanVienKinhDoanhService } from './nhan-vien-kinh-doanh.service.js';

@Module({
  controllers: [NhanVienKinhDoanhController],
  providers: [NhanVienKinhDoanhService],
  exports: [NhanVienKinhDoanhService],
})
export class NhanVienKinhDoanhModule {}
