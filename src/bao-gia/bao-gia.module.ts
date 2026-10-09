import { Module } from '@nestjs/common';
import { HangHoaModule } from '../hang-hoa/hang-hoa.module.js';
import { KhachHangModule } from '../khach-hang/khach-hang.module.js';
import { NhanVienKinhDoanhModule } from '../nhan-vien-kinh-doanh/nhan-vien-kinh-doanh.module.js';
import { PhieuXuatHangModule } from '../phieu-xuat-hang/phieu-xuat-hang.module.js';
import { TyLeQuyDoiModule } from '../ty-le-quy-doi/ty-le-quy-doi.module.js';
import { BaoGiaController } from './bao-gia.controller.js';
import { BaoGiaService } from './bao-gia.service.js';

@Module({
  imports: [
    KhachHangModule,
    NhanVienKinhDoanhModule,
    HangHoaModule,
    TyLeQuyDoiModule,
    PhieuXuatHangModule,
  ],
  controllers: [BaoGiaController],
  providers: [BaoGiaService],
})
export class BaoGiaModule {}
