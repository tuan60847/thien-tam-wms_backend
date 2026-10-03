import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateHangHoaDto } from './create-hang-hoa.dto.js';

// Units are managed through /hang-hoa/:id/ty-le-quy-doi; maSP never changes.
export class UpdateHangHoaDto extends PartialType(
  OmitType(CreateHangHoaDto, ['donViCoBan', 'cacDonViKhac'] as const),
) {
  @ApiPropertyOptional({ description: 'false = ngừng kinh doanh' })
  @IsOptional()
  @IsBoolean()
  trangThai?: boolean;
}
