import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';
import { ToBoolean, Trim } from '../../common/transformers.js';
import {
  IsVehiclePlate,
  NormalizePlate,
} from '../../common/validators/is-vehicle-plate.js';

export class CreatePhuongTienDto {
  @ApiProperty({
    example: '51C-123.45',
    description: 'Được chuẩn hóa thành 51C12345',
  })
  @NormalizePlate()
  @IsVehiclePlate()
  bienSo!: string;

  @ApiPropertyOptional({ example: 'Xe tải 1.5 tấn', nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(50)
  loaiPhuongTien?: string | null;

  @ApiPropertyOptional({
    description: 'Xe lạnh, chở được hàng cần bảo quản lạnh',
  })
  @IsOptional()
  @IsBoolean()
  isXeLanh?: boolean;
}

export class UpdatePhuongTienDto extends PartialType(CreatePhuongTienDto) {
  @ApiPropertyOptional({ description: 'false = ngừng sử dụng' })
  @IsOptional()
  @IsBoolean()
  trangThai?: boolean;
}

export class QueryPhuongTienDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isXeLanh?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  trangThai?: boolean;
}

export class PhuongTienResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: '51C12345' }) bienSo!: string;
  @ApiProperty({ nullable: true, type: String }) loaiPhuongTien!: string | null;
  @ApiProperty() isXeLanh!: boolean;
  @ApiProperty() trangThai!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
