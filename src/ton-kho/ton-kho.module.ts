import { Module } from '@nestjs/common';
import { KhoViTriModule } from '../kho-vi-tri/kho-vi-tri.module.js';
import { SoLoModule } from '../so-lo/so-lo.module.js';
import { TyLeQuyDoiModule } from '../ty-le-quy-doi/ty-le-quy-doi.module.js';
import { StockJobsService } from './jobs/stock-jobs.service.js';
import { TonKhoController } from './ton-kho.controller.js';
import { TonKhoQueryService } from './ton-kho-query.service.js';
import { TonKhoService } from './ton-kho.service.js';

@Module({
  imports: [SoLoModule, KhoViTriModule, TyLeQuyDoiModule],
  controllers: [TonKhoController],
  providers: [TonKhoService, TonKhoQueryService, StockJobsService],
  exports: [TonKhoService, TonKhoQueryService],
})
export class TonKhoModule {}
