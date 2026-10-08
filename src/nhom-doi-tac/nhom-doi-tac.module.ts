import { Module } from '@nestjs/common';
import { NhomDoiTacController } from './nhom-doi-tac.controller.js';
import { NhomDoiTacService } from './nhom-doi-tac.service.js';

@Module({
  controllers: [NhomDoiTacController],
  providers: [NhomDoiTacService],
  exports: [NhomDoiTacService],
})
export class NhomDoiTacModule {}
