import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/transformers.js';

export class CreateLoaiHangDto {
  @ApiProperty({ example: 'Kháng sinh' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  tenLoaiHang!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  ghiChu?: string | null;
}
