import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';
import { Trim } from '../../common/transformers.js';

export class CreateDieuKhoanDto {
  @ApiProperty({ example: 'NET30' })
  @Trim()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,20}$/, {
    message: 'Mã gồm chữ, số, "-" hoặc "_", tối đa 20 ký tự',
  })
  ma!: string;

  @ApiProperty({ example: 'Thanh toán trong 30 ngày' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  ten!: string;

  @ApiProperty({ example: 30, description: '0 = thanh toán ngay' })
  @IsInt()
  @Min(0)
  @Max(3650)
  soNgayDuocNo!: number;
}

export class UpdateDieuKhoanDto extends PartialType(CreateDieuKhoanDto) {}

export class QueryDieuKhoanDto extends PaginationQueryDto {}

export class DieuKhoanResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() ma!: string;
  @ApiProperty() ten!: string;
  @ApiProperty() soNgayDuocNo!: number;
}
