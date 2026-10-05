import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { TrangThaiXacMinh } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';
import { ToBoolean, Trim } from '../../common/transformers.js';
import { IsDateOnly } from '../../common/validators/is-date-only.js';
import {
  IsVnPhone,
  NormalizePhone,
} from '../../common/validators/is-vn-phone.js';

export const LICENSE_STATUS_VALUES = [
  'con_han',
  'sap_het_han',
  'het_han',
  'chua_khai_bao',
] as const;
type LicenseStatusValue = (typeof LICENSE_STATUS_VALUES)[number];

export class CreateNhaCungCapDto {
  @ApiProperty({ example: 'Công ty Dược Hậu Giang' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  tenNCC!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @NormalizePhone()
  @IsVnPhone()
  SDT?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  diaChi?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  tenNguoiPhuTrach?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @NormalizePhone()
  @IsVnPhone()
  sdtNguoiPT?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  ghiChu?: string | null;

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

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  noiCapGPKD?: string | null;

  @ApiPropertyOptional({ example: '2029-01-15', nullable: true })
  @IsOptional()
  @IsDateOnly()
  ngayHetHanGPKD?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(50)
  soGCNDuDieuKienKinhDoanhDuoc?: string | null;

  @ApiPropertyOptional({ example: '2024-01-15', nullable: true })
  @IsOptional()
  @IsDateOnly()
  ngayCapGCNDuoc?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  noiCapGCNDuoc?: string | null;

  @ApiPropertyOptional({ example: '2029-01-15', nullable: true })
  @IsOptional()
  @IsDateOnly()
  ngayHetHanGCNDuoc?: string | null;
}

// maNCC and trangThaiXacMinh are not updatable here; verification has its own endpoint.
export class UpdateNhaCungCapDto extends PartialType(CreateNhaCungCapDto) {
  @ApiPropertyOptional({ description: 'false = ngừng hoạt động' })
  @IsOptional()
  @IsBoolean()
  trangThai?: boolean;
}

export class XacMinhNhaCungCapDto {
  @ApiProperty({ enum: ['da_xac_minh', 'tu_choi'] })
  @IsIn(['da_xac_minh', 'tu_choi'])
  ketQua!: 'da_xac_minh' | 'tu_choi';

  @ApiPropertyOptional({ description: 'Bắt buộc khi từ chối' })
  @ValidateIf(
    (o: XacMinhNhaCungCapDto) =>
      o.ketQua === 'tu_choi' || o.ghiChu !== undefined,
  )
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  ghiChu?: string;
}

export class QueryNhaCungCapDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  trangThai?: boolean;

  @ApiPropertyOptional({ enum: TrangThaiXacMinh })
  @IsOptional()
  @IsEnum(TrangThaiXacMinh)
  trangThaiXacMinh?: TrangThaiXacMinh;
}

export class GiayPhepNhaCungCapDto {
  @ApiProperty({ enum: LICENSE_STATUS_VALUES }) gpkd!: LicenseStatusValue;
  @ApiProperty({ enum: LICENSE_STATUS_VALUES }) gcn!: LicenseStatusValue;
}

export class NguoiXacMinhDto {
  @ApiProperty() id!: string;
  @ApiProperty() maNV!: string;
  @ApiProperty() hoTen!: string;
}

export class NhaCungCapResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'NCC0001' }) maNCC!: string;
  @ApiProperty() tenNCC!: string;
  @ApiProperty({ nullable: true, type: String }) SDT!: string | null;
  @ApiProperty({ nullable: true, type: String }) diaChi!: string | null;
  @ApiProperty({ nullable: true, type: String }) tenNguoiPhuTrach!:
    string | null;
  @ApiProperty({ nullable: true, type: String }) sdtNguoiPT!: string | null;
  @ApiProperty({ nullable: true, type: String }) ghiChu!: string | null;
  @ApiProperty() trangThai!: boolean;
  @ApiProperty({ enum: TrangThaiXacMinh }) trangThaiXacMinh!: TrangThaiXacMinh;
  @ApiProperty({ nullable: true, type: Date }) xacMinhAt!: Date | null;
  @ApiProperty({ nullable: true, type: NguoiXacMinhDto })
  xacMinhBoi!: NguoiXacMinhDto | null;
  @ApiProperty({
    type: GiayPhepNhaCungCapDto,
    description: 'Tính khi đọc theo ngày hết hạn',
  })
  giayPhep!: GiayPhepNhaCungCapDto;
  @ApiProperty({ nullable: true, type: String }) soGiayPhepKinhDoanh!:
    string | null;
  @ApiProperty({ nullable: true, type: String }) ngayCapGPKD!: string | null;
  @ApiProperty({ nullable: true, type: String }) noiCapGPKD!: string | null;
  @ApiProperty({ nullable: true, type: String }) ngayHetHanGPKD!: string | null;
  @ApiProperty({ nullable: true, type: String }) soGCNDuDieuKienKinhDoanhDuoc!:
    string | null;
  @ApiProperty({ nullable: true, type: String }) ngayCapGCNDuoc!: string | null;
  @ApiProperty({ nullable: true, type: String }) noiCapGCNDuoc!: string | null;
  @ApiProperty({ nullable: true, type: String }) ngayHetHanGCNDuoc!:
    string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
