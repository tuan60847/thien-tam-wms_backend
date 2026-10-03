import { Module } from '@nestjs/common';
import { HangHoaModule } from '../hang-hoa/hang-hoa.module.js';
import { TyLeQuyDoiController } from './ty-le-quy-doi.controller.js';
import { TyLeQuyDoiService } from './ty-le-quy-doi.service.js';

@Module({
  imports: [HangHoaModule],
  controllers: [TyLeQuyDoiController],
  providers: [TyLeQuyDoiService],
  exports: [TyLeQuyDoiService],
})
export class TyLeQuyDoiModule {}
