import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';
import { ToBoolean, Trim } from '../../common/transformers.js';

export class CreateKhoDto {
  @ApiProperty({ example: 'Kho chính' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  tenKho!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  diaChi?: string | null;
}

export class UpdateKhoDto extends PartialType(CreateKhoDto) {
  @ApiPropertyOptional({ description: 'false = vô hiệu hóa kho' })
  @IsOptional()
  @IsBoolean()
  trangThai?: boolean;
}

export class QueryKhoDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  trangThai?: boolean;
}

export class KhoResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tenKho!: string;
  @ApiProperty({ nullable: true, type: String }) diaChi!: string | null;
  @ApiProperty() trangThai!: boolean;
  @ApiProperty() soViTri!: number;
  @ApiProperty({ description: 'Có vị trí đang còn hàng tồn' }) coTon!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
