import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoaiKiemSoat } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Trim } from '../../common/transformers.js';
import { IsMoney } from '../../common/validators/is-money.js';

export class DonViKhacDto {
  @ApiProperty({ example: 'vỉ' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  donViTinh!: string;

  @ApiProperty({
    example: 10,
    description: 'Số đơn vị cơ bản trong một đơn vị này',
  })
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  soLuongQuyDoi!: number;
}

export class CreateHangHoaDto {
  @ApiProperty({ example: 'Paracetamol 500mg' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  tenSP!: string;

  @ApiProperty()
  @IsUUID()
  loaiHangId!: string;

  @ApiPropertyOptional({ example: 'Hộp 10 vỉ × 10 viên', nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  quyCach?: string | null;

  @ApiProperty({
    example: 'viên',
    description: 'Đơn vị nhỏ nhất (hệ số quy đổi = 1)',
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  donViCoBan!: string;

  @ApiPropertyOptional({ type: [DonViKhacDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => DonViKhacDto)
  cacDonViKhac?: DonViKhacDto[];

  @ApiPropertyOptional({ description: 'Mặc định = đơn vị cơ bản' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(30)
  donViTinhGia?: string;

  @ApiPropertyOptional({ example: '1250.00' })
  @IsOptional()
  @IsMoney()
  giaNhap?: string;

  @ApiPropertyOptional({ example: '1500.00' })
  @IsOptional()
  @IsMoney()
  giaHienThi?: string;

  @ApiPropertyOptional({ example: '1400.00' })
  @IsOptional()
  @IsMoney()
  giaToiThieu?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isKeDon?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCanGiuLanh?: boolean;

  @ApiPropertyOptional({ enum: LoaiKiemSoat })
  @IsOptional()
  @IsEnum(LoaiKiemSoat)
  loaiKiemSoat?: LoaiKiemSoat;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(50)
  soDangKy?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  ghiChu?: string | null;
}
