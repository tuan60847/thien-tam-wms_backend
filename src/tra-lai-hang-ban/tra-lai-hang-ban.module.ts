import { Module } from '@nestjs/common';
import { KhoViTriModule } from '../kho-vi-tri/kho-vi-tri.module.js';
import { PhieuXuatHangModule } from '../phieu-xuat-hang/phieu-xuat-hang.module.js';
import { TonKhoModule } from '../ton-kho/ton-kho.module.js';
import { TyLeQuyDoiModule } from '../ty-le-quy-doi/ty-le-quy-doi.module.js';
import { TraLaiHangBanController } from './tra-lai-hang-ban.controller.js';
import { TraLaiHangBanService } from './tra-lai-hang-ban.service.js';

@Module({
  imports: [
    PhieuXuatHangModule,
    KhoViTriModule,
    TyLeQuyDoiModule,
    TonKhoModule,
  ],
  controllers: [TraLaiHangBanController],
  providers: [TraLaiHangBanService],
  exports: [TraLaiHangBanService],
})
export class TraLaiHangBanModule {}
