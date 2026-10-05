import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';
import { ToBoolean, Trim } from '../../common/transformers.js';

export class CreateViTriDto {
  @ApiProperty()
  @IsUUID()
  khoId!: string;

  @ApiProperty({ example: 'A-01-03' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  tenViTri!: string;

  @ApiPropertyOptional({ description: 'Vị trí bảo quản lạnh' })
  @IsOptional()
  @IsBoolean()
  isCapDong?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  ghiChu?: string | null;
}

// A location never moves to another warehouse, so khoId is not updatable.
export class UpdateViTriDto extends PartialType(
  OmitType(CreateViTriDto, ['khoId'] as const),
) {
  @ApiPropertyOptional({ description: 'false = ngừng sử dụng vị trí' })
  @IsOptional()
  @IsBoolean()
  trangThai?: boolean;
}

export class QueryViTriDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  khoId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isCapDong?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  trangThai?: boolean;
}

export class ViTriKhoDto {
  @ApiProperty() id!: string;
  @ApiProperty() tenKho!: string;
}

export class ViTriResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tenViTri!: string;
  @ApiProperty() isCapDong!: boolean;
  @ApiProperty({ nullable: true, type: String }) ghiChu!: string | null;
  @ApiProperty() trangThai!: boolean;
  @ApiProperty({ type: ViTriKhoDto }) kho!: ViTriKhoDto;
  @ApiProperty({ description: 'Đang có hàng tồn (soLuong > 0)' })
  coTon!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
