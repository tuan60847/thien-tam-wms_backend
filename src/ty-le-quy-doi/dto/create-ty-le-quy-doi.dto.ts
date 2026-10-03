import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../../common/transformers.js';

export class CreateTyLeQuyDoiDto {
  @ApiProperty({ example: 'hộp' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  donViTinh!: string;

  // 1 is accepted by validation so the service can answer with the clearer
  // TY_LE_QUY_DOI_BASE_REQUIRED (a product has exactly one base unit).
  @ApiProperty({
    example: 100,
    description: 'Số đơn vị cơ bản trong một đơn vị này (≥ 2)',
  })
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  soLuongQuyDoi!: number;
}
