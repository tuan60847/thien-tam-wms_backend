import { Module } from '@nestjs/common';
import { HangHoaModule } from '../hang-hoa/hang-hoa.module.js';
import { KhoViTriModule } from '../kho-vi-tri/kho-vi-tri.module.js';
import { NhaCungCapModule } from '../nha-cung-cap/nha-cung-cap.module.js';
import { PhuongTienVanChuyenModule } from '../phuong-tien-van-chuyen/phuong-tien-van-chuyen.module.js';
import { SoLoModule } from '../so-lo/so-lo.module.js';
import { TonKhoModule } from '../ton-kho/ton-kho.module.js';
import { TyLeQuyDoiModule } from '../ty-le-quy-doi/ty-le-quy-doi.module.js';
import { PhieuNhapHangController } from './phieu-nhap-hang.controller.js';
import { PhieuNhapHangService } from './phieu-nhap-hang.service.js';

@Module({
  imports: [
    NhaCungCapModule,
    PhuongTienVanChuyenModule,
    SoLoModule,
    HangHoaModule,
    KhoViTriModule,
    TyLeQuyDoiModule,
    TonKhoModule,
  ],
  controllers: [PhieuNhapHangController],
  providers: [PhieuNhapHangService],
  exports: [PhieuNhapHangService],
})
export class PhieuNhapHangModule {}
