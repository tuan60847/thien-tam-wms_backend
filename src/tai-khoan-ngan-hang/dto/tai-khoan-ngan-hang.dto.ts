import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/transformers.js';

export class CreateTaiKhoanNganHangDto {
  @ApiProperty({ example: '0123456789' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  soTaiKhoan!: string;

  @ApiProperty({ example: 'Vietcombank' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  tenNganHang!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  chiNhanh?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  tinhTpNganHang?: string | null;
}

export class UpdateTaiKhoanNganHangDto extends PartialType(
  CreateTaiKhoanNganHangDto,
) {}

export class TaiKhoanNganHangResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() soTaiKhoan!: string;
  @ApiProperty() tenNganHang!: string;
  @ApiProperty({ nullable: true }) chiNhanh!: string | null;
  @ApiProperty({ nullable: true }) tinhTpNganHang!: string | null;
}
