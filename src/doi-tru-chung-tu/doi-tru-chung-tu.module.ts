import { Module } from '@nestjs/common';
import { PhieuXuatHangModule } from '../phieu-xuat-hang/phieu-xuat-hang.module.js';
import { DoiTruChungTuController } from './doi-tru-chung-tu.controller.js';
import { DoiTruChungTuService } from './doi-tru-chung-tu.service.js';

@Module({
  imports: [PhieuXuatHangModule],
  controllers: [DoiTruChungTuController],
  providers: [DoiTruChungTuService],
  exports: [DoiTruChungTuService],
})
export class DoiTruChungTuModule {}
