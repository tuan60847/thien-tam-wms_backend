import { Module } from '@nestjs/common';
import { FileStorageService } from './file-storage.service.js';
import { TepDinhKemController } from './tep-dinh-kem.controller.js';
import { TepDinhKemService } from './tep-dinh-kem.service.js';

@Module({
  controllers: [TepDinhKemController],
  providers: [TepDinhKemService, FileStorageService],
  exports: [TepDinhKemService],
})
export class TepDinhKemModule {}
