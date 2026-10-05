import { Module } from '@nestjs/common';
import { NhaCungCapController } from './nha-cung-cap.controller.js';
import { NhaCungCapService } from './nha-cung-cap.service.js';

@Module({
  controllers: [NhaCungCapController],
  providers: [NhaCungCapService],
  exports: [NhaCungCapService],
})
export class NhaCungCapModule {}
