import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateLoaiHangDto } from './create-loai-hang.dto.js';

export class UpdateLoaiHangDto extends PartialType(CreateLoaiHangDto) {
  @ApiPropertyOptional({ description: 'false = ngừng sử dụng' })
  @IsOptional()
  @IsBoolean()
  trangThai?: boolean;
}
