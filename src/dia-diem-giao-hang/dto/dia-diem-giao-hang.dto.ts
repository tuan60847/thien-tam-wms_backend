import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../common/transformers.js';

export class CreateDiaDiemGiaoHangDto {
  @ApiProperty({ example: '12 Lê Lợi, Quận 1, TP.HCM' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  diaDiem!: string;

  @ApiPropertyOptional({
    description:
      'Địa điểm mặc định của khách; địa điểm đầu tiên luôn là mặc định',
  })
  @IsOptional()
  @IsBoolean()
  laMacDinh?: boolean;
}

export class UpdateDiaDiemGiaoHangDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  diaDiem?: string;

  @ApiPropertyOptional({
    description: 'Chỉ đặt được true; muốn đổi mặc định thì đặt địa điểm khác',
  })
  @IsOptional()
  @IsBoolean()
  laMacDinh?: boolean;
}

export class DiaDiemGiaoHangResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() diaDiem!: string;
  @ApiProperty() laMacDinh!: boolean;
}
