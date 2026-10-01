import { Global, Module } from '@nestjs/common';
import { CodeGeneratorService } from './code-generator.service.js';

@Global()
@Module({
  providers: [CodeGeneratorService],
  exports: [CodeGeneratorService],
})
export class CodeGeneratorModule {}
