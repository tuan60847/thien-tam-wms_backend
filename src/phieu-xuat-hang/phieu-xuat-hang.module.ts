import { Module } from '@nestjs/common';
import { HangHoaModule } from '../hang-hoa/hang-hoa.module.js';
import { KhachHangModule } from '../khach-hang/khach-hang.module.js';
import { KhoViTriModule } from '../kho-vi-tri/kho-vi-tri.module.js';
import { PhuongTienVanChuyenModule } from '../phuong-tien-van-chuyen/phuong-tien-van-chuyen.module.js';
import { SoLoModule } from '../so-lo/so-lo.module.js';
import { TonKhoModule } from '../ton-kho/ton-kho.module.js';
import { TyLeQuyDoiModule } from '../ty-le-quy-doi/ty-le-quy-doi.module.js';
import { PhieuXuatHangController } from './phieu-xuat-hang.controller.js';
import { PhieuXuatHangService } from './phieu-xuat-hang.service.js';

@Module({
  imports: [
    KhachHangModule,
    PhuongTienVanChuyenModule,
    SoLoModule,
    HangHoaModule,
    KhoViTriModule,
    TyLeQuyDoiModule,
    TonKhoModule,
  ],
  controllers: [PhieuXuatHangController],
  providers: [PhieuXuatHangService],
  exports: [PhieuXuatHangService],
})
export class PhieuXuatHangModule {}
