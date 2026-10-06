import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../transformers.js';

// Body of every "cancel / void a document" action.
export class HuyPhieuDto {
  @ApiProperty({ example: 'Nhập nhầm nhà cung cấp' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  lyDo!: string;
}
