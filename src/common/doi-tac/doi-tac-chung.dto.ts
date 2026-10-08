import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoaiChuThe } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../transformers.js';
import { IsMoney } from '../validators/is-money.js';
import { IsVnPhone, NormalizePhone } from '../validators/is-vn-phone.js';

// Fields shared by customers and suppliers (the MISA "khách hàng / nhà cung cấp" form).
export class DoiTacChungDto {
  @ApiPropertyOptional({ enum: LoaiChuThe })
  @IsOptional()
  @IsEnum(LoaiChuThe)
  loaiChuThe?: LoaiChuThe;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(20)
  soCCCD?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @NormalizePhone()
  @IsVnPhone()
  dtCoDinh?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(20)
  fax?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  website?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Số ngày được nợ' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  soNgayDuocNo?: number | null;

  @ApiPropertyOptional({
    example: '50000000.00',
    description: 'Hạn mức nợ tối đa; 0 = không giới hạn',
  })
  @IsOptional()
  @IsMoney()
  soNoToiDa?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  quocGia?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  tinhTp?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  quanHuyen?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  xaPhuong?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  nhomDoiTacId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  dieuKhoanThanhToanId?: string | null;
}

export class DoiTacChungResponseDto {
  @ApiProperty({ enum: LoaiChuThe }) loaiChuThe!: LoaiChuThe;
  @ApiProperty({ nullable: true, type: String }) soCCCD!: string | null;
  @ApiProperty({ nullable: true, type: String }) dtCoDinh!: string | null;
  @ApiProperty({ nullable: true, type: String }) fax!: string | null;
  @ApiProperty({ nullable: true, type: String }) website!: string | null;
  @ApiProperty({ nullable: true, type: Number }) soNgayDuocNo!: number | null;
  @ApiProperty({ example: '0.00' }) soNoToiDa!: string;
  @ApiProperty() quocGia!: string;
  @ApiProperty({ nullable: true, type: String }) tinhTp!: string | null;
  @ApiProperty({ nullable: true, type: String }) quanHuyen!: string | null;
  @ApiProperty({ nullable: true, type: String }) xaPhuong!: string | null;
  @ApiProperty({ nullable: true, type: String }) nhomDoiTacId!: string | null;
  @ApiProperty({ nullable: true, type: String }) dieuKhoanThanhToanId!:
    string | null;
}
