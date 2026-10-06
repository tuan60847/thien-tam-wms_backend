import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
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
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';
import { Trim } from '../../common/transformers.js';
import { IsDateOnly } from '../../common/validators/is-date-only.js';
import { IsMoney } from '../../common/validators/is-money.js';

export const TRANG_THAI_PHIEU_NHAP = [
  'cho_xac_nhan',
  'da_nhap_kho',
  'da_huy',
] as const;
export type TrangThaiPhieuNhapValue = (typeof TRANG_THAI_PHIEU_NHAP)[number];

export const TRANG_THAI_THANH_TOAN = [
  'chua_thanh_toan',
  'thanh_toan_mot_phan',
  'da_thanh_toan',
] as const;

export const MAX_LINES = 200;
const INT_MAX = 2_147_483_647;

// A lot given inline: found by (hangHoaId, tenLo) or created with the receipt.
export class SoLoMoiDto {
  @ApiProperty() @IsUUID() hangHoaId!: string;

  @ApiProperty({ example: 'L240801' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  tenLo!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateOnly()
  ngaySX?: string | null;

  @ApiProperty({ example: '2027-08-01' })
  @IsDateOnly()
  hanSuDung!: string;
}

export class ChiTietNhapDto {
  @ApiPropertyOptional({ description: 'Lô có sẵn (hoặc dùng soLo, đúng một)' })
  @IsOptional()
  @IsUUID()
  soLoId?: string;

  @ApiPropertyOptional({ type: SoLoMoiDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SoLoMoiDto)
  soLo?: SoLoMoiDto;

  @ApiProperty() @IsUUID() viTriId!: string;

  @ApiProperty({ example: 'hộp' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  donViTinh!: string;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  @Max(INT_MAX)
  soLuong!: number;

  @ApiProperty({ example: '90000.00', description: 'Theo donViTinh của dòng' })
  @IsMoney()
  donGia!: string;
}

export class CreatePhieuNhapDto {
  @ApiProperty() @IsUUID() nhaCungCapId!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  phuongTienVanChuyenId?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Dự kiến' })
  @IsOptional()
  @IsDateOnly()
  ngayNhanHang?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  ghiChu?: string | null;

  @ApiPropertyOptional({ type: [ChiTietNhapDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_LINES)
  @ValidateNested({ each: true })
  @Type(() => ChiTietNhapDto)
  chiTiet?: ChiTietNhapDto[];
}

// Sending chiTiet replaces every line.
export class UpdatePhieuNhapDto extends PartialType(CreatePhieuNhapDto) {}

export class XacNhanNhapDto {
  @ApiPropertyOptional({ description: 'Mặc định hôm nay; không ở tương lai' })
  @IsOptional()
  @IsDateOnly()
  ngayNhanHang?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  ghiChu?: string;
}

const toArray = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.split(',').filter(Boolean) : value;

export class QueryPhieuNhapDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() nhaCungCapId?: string;

  @ApiPropertyOptional({ enum: TRANG_THAI_PHIEU_NHAP, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(TRANG_THAI_PHIEU_NHAP, { each: true })
  trangThai?: TrangThaiPhieuNhapValue[];

  @ApiPropertyOptional({ enum: TRANG_THAI_THANH_TOAN })
  @IsOptional()
  @IsEnum(TRANG_THAI_THANH_TOAN)
  trangThaiThanhToan?: (typeof TRANG_THAI_THANH_TOAN)[number];

  @ApiPropertyOptional() @IsOptional() @IsUUID() createdById?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() hangHoaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateOnly() createdAtFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateOnly() createdAtTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateOnly() ngayNhanHangFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateOnly() ngayNhanHangTo?: string;
}

// ---- responses -----------------------------------------------------------

export class PhieuNhapNccDto {
  @ApiProperty() id!: string;
  @ApiProperty() maNCC!: string;
  @ApiProperty() tenNCC!: string;
}

export class PhieuNhapUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() maNV!: string;
  @ApiProperty() hoTen!: string;
}

export class PhieuNhapListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() maPhieuNhapHang!: string;
  @ApiProperty({ type: PhieuNhapNccDto }) nhaCungCap!: PhieuNhapNccDto;
  @ApiProperty({ enum: TRANG_THAI_PHIEU_NHAP }) trangThai!: string;
  @ApiProperty({ nullable: true, example: '2026-10-06' })
  ngayNhanHang!: string | null;
  @ApiProperty() soDong!: number;
  @ApiProperty({ example: '1000000.00' }) tongTien!: string;
  @ApiProperty({ example: '0.00' }) daThanhToan!: string;
  @ApiProperty({ example: '1000000.00' }) conNo!: string;
  @ApiProperty({ enum: TRANG_THAI_THANH_TOAN, nullable: true })
  trangThaiThanhToan!: string | null;
  @ApiProperty({ type: PhieuNhapUserDto, nullable: true })
  createdBy!: PhieuNhapUserDto | null;
  @ApiProperty() createdAt!: Date;
}

export class ChiTietNhapResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() maChiTietPhieuNhapHang!: string;
  @ApiProperty() soLo!: {
    id: string;
    tenLo: string;
    ngaySX: string | null;
    hanSuDung: string;
    trangThai: string;
    hangHoa: { id: string; maSP: string; tenSP: string };
  };
  @ApiProperty() viTri!: {
    id: string;
    tenViTri: string;
    kho: { id: string; tenKho: string };
  };
  @ApiProperty() donViTinh!: string;
  @ApiProperty() heSoQuyDoi!: number;
  @ApiProperty() soLuong!: number;
  @ApiProperty() soLuongCoBan!: number;
  @ApiProperty({ example: '90000.00' }) donGia!: string;
  @ApiProperty({ example: '270000.00' }) thanhTien!: string;
}

export class ThanhToanTomTatDto {
  @ApiProperty() id!: string;
  @ApiProperty() maPhieuThanhToan!: string;
  @ApiProperty({ example: '400000.00' }) soTien!: string;
  @ApiProperty({ example: '2026-10-06' }) ngayThanhToan!: string;
  @ApiProperty() daHuy!: boolean;
}

export class PhieuNhapResponseDto extends PhieuNhapListItemDto {
  @ApiProperty({ nullable: true }) phuongTienVanChuyen!: {
    id: string;
    bienSo: string;
    isXeLanh: boolean;
  } | null;
  @ApiProperty({ nullable: true }) ghiChu!: string | null;
  @ApiProperty({ nullable: true }) xacNhanAt!: Date | null;
  @ApiProperty({ type: PhieuNhapUserDto, nullable: true })
  xacNhanBoi!: PhieuNhapUserDto | null;
  @ApiProperty({ nullable: true }) huyAt!: Date | null;
  @ApiProperty({ type: PhieuNhapUserDto, nullable: true })
  huyBoi!: PhieuNhapUserDto | null;
  @ApiProperty({ nullable: true }) lyDoHuy!: string | null;
  @ApiProperty({ type: [ChiTietNhapResponseDto] })
  chiTiet!: ChiTietNhapResponseDto[];
  @ApiProperty({ type: [ThanhToanTomTatDto] })
  thanhToan!: ThanhToanTomTatDto[];
  @ApiProperty() updatedAt!: Date;
}
