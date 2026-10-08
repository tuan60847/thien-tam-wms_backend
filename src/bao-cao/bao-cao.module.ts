import { Module } from '@nestjs/common';
import { BaoCaoController } from './bao-cao.controller.js';
import { BaoCaoKhoService } from './bao-cao-kho.service.js';
import { BaoCaoKinhDoanhService } from './bao-cao-kinh-doanh.service.js';

@Module({
  controllers: [BaoCaoController],
  providers: [BaoCaoKhoService, BaoCaoKinhDoanhService],
})
export class BaoCaoModule {}
