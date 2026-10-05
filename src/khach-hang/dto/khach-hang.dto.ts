import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { TrangThaiKhachHang } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';
import { LowerTrim, Trim } from '../../common/transformers.js';
import { IsDateOnly } from '../../common/validators/is-date-only.js';
import {
  IsVnPhone,
  NormalizePhone,
} from '../../common/validators/is-vn-phone.js';
import { IsVnTaxCode } from '../../common/validators/is-vn-tax-code.js';

export const GIAY_PHEP_VALUES = [
  'con_han',
  'sap_het_han',
  'het_han',
  'chua_khai_bao',
] as const;
export type GiayPhep = (typeof GIAY_PHEP_VALUES)[number];

export class CreateKhachHangDto {
  @ApiProperty({ example: 'Nhà thuốc Minh Châu' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  tenKH!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  diaChi?: string | null;

  @ApiPropertyOptional({ example: '0312345678', nullable: true })
  @IsOptional()
  @Trim()
  @IsVnTaxCode()
  maSoThue?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @LowerTrim()
  @IsEmail()
  @MaxLength(150)
  email?: string | null;

  @ApiPropertyOptional({ example: '0901234567', nullable: true })
  @IsOptional()
  @NormalizePhone()
  @IsVnPhone()
  SDT?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  nguoiDaiDien?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @NormalizePhone()
  @IsVnPhone()
  SDTNDD?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(50)
  soGiayPhepKinhDoanh?: string | null;

  @ApiPropertyOptional({ example: '2024-01-15', nullable: true })
  @IsOptional()
  @IsDateOnly()
  ngayCapGPKD?: string | null;

  @ApiPropertyOptional({ example: '2029-01-15', nullable: true })
  @IsOptional()
  @IsDateOnly()
  ngayHetHanGPKD?: string | null;
}

// maKH is generated and never changes.
export class UpdateKhachHangDto extends PartialType(CreateKhachHangDto) {
  @ApiPropertyOptional({ enum: TrangThaiKhachHang })
  @IsOptional()
  @IsEnum(TrangThaiKhachHang)
  trangThai?: TrangThaiKhachHang;
}

export class QueryKhachHangDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TrangThaiKhachHang })
  @IsOptional()
  @IsEnum(TrangThaiKhachHang)
  trangThai?: TrangThaiKhachHang;

  @ApiPropertyOptional({ enum: GIAY_PHEP_VALUES })
  @IsOptional()
  @IsEnum(GIAY_PHEP_VALUES)
  giayPhep?: GiayPhep;
}

export class KhachHangResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'KH00001' }) maKH!: string;
  @ApiProperty() tenKH!: string;
  @ApiProperty({ nullable: true, type: String }) diaChi!: string | null;
  @ApiProperty({ nullable: true, type: String }) maSoThue!: string | null;
  @ApiProperty({ nullable: true, type: String }) email!: string | null;
  @ApiProperty({ nullable: true, type: String }) SDT!: string | null;
  @ApiProperty({ nullable: true, type: String }) nguoiDaiDien!: string | null;
  @ApiProperty({ nullable: true, type: String }) SDTNDD!: string | null;
  @ApiProperty({ enum: TrangThaiKhachHang }) trangThai!: TrangThaiKhachHang;
  @ApiProperty({ nullable: true, type: String }) soGiayPhepKinhDoanh!:
    string | null;
  @ApiProperty({ nullable: true, type: String, example: '2024-01-15' })
  ngayCapGPKD!: string | null;
  @ApiProperty({ nullable: true, type: String, example: '2029-01-15' })
  ngayHetHanGPKD!: string | null;
  @ApiProperty({
    enum: GIAY_PHEP_VALUES,
    description: 'Tính khi đọc theo ngày hết hạn GPKD',
  })
  giayPhep!: GiayPhep;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
