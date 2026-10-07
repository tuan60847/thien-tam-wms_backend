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

export const TRANG_THAI_PHIEU_XUAT = [
  'cho_xu_ly',
  'da_xuat_kho',
  'da_giao',
  'da_huy',
] as const;
export type TrangThaiPhieuXuatValue = (typeof TRANG_THAI_PHIEU_XUAT)[number];

export const TRANG_THAI_THU = [
  'chua_thu',
  'thu_mot_phan',
  'da_thu_du',
] as const;

export const MAX_LINES = 200;
const INT_MAX = 2_147_483_647;

export class ChiTietXuatDto {
  @ApiProperty() @IsUUID() soLoId!: string;
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

  @ApiProperty({ example: '125000.00', description: 'Theo donViTinh của dòng' })
  @IsMoney()
  donGia!: string;
}

export class CreatePhieuXuatDto {
  @ApiProperty() @IsUUID() khachHangId!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  phuongTienVanChuyenId?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Dự kiến' })
  @IsOptional()
  @IsDateOnly()
  ngayGiaoHang?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Mặc định lấy địa chỉ khách lúc lập',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  diaChiGiaoHang?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  ghiChu?: string | null;

  @ApiPropertyOptional({ type: [ChiTietXuatDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_LINES)
  @ValidateNested({ each: true })
  @Type(() => ChiTietXuatDto)
  chiTiet?: ChiTietXuatDto[];
}

// Sending chiTiet replaces every line.
export class UpdatePhieuXuatDto extends PartialType(CreatePhieuXuatDto) {}

export class GiaoHangDto {
  @ApiPropertyOptional({ description: 'Mặc định hôm nay' })
  @IsOptional()
  @IsDateOnly()
  ngayGiaoThucTe?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  ghiChu?: string;
}

const toArray = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.split(',').filter(Boolean) : value;

export class QueryPhieuXuatDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() khachHangId?: string;

  @ApiPropertyOptional({ enum: TRANG_THAI_PHIEU_XUAT, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(TRANG_THAI_PHIEU_XUAT, { each: true })
  trangThai?: TrangThaiPhieuXuatValue[];

  @ApiPropertyOptional({ enum: TRANG_THAI_THU })
  @IsOptional()
  @IsEnum(TRANG_THAI_THU)
  trangThaiThu?: (typeof TRANG_THAI_THU)[number];

  @ApiPropertyOptional() @IsOptional() @IsUUID() createdById?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() hangHoaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() soLoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateOnly() createdAtFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateOnly() createdAtTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateOnly() ngayXuatKhoFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateOnly() ngayXuatKhoTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateOnly() ngayGiaoHangFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateOnly() ngayGiaoHangTo?: string;
}

// ---- responses -----------------------------------------------------------

export class PhieuXuatKhachDto {
  @ApiProperty() id!: string;
  @ApiProperty() maKH!: string;
  @ApiProperty() tenKH!: string;
}

export class PhieuXuatUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() maNV!: string;
  @ApiProperty() hoTen!: string;
}

export class PhieuXuatListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() maPhieuXuatHang!: string;
  @ApiProperty({ type: PhieuXuatKhachDto }) khachHang!: PhieuXuatKhachDto;
  @ApiProperty({ enum: TRANG_THAI_PHIEU_XUAT }) trangThai!: string;
  @ApiProperty({ nullable: true }) ngayGiaoHang!: string | null;
  @ApiProperty({ nullable: true }) ngayXuatKho!: string | null;
  @ApiProperty() soDong!: number;
  @ApiProperty({ example: '1000000.00' }) tongTien!: string;
  @ApiProperty({ example: '0.00' }) daThu!: string;
  @ApiProperty({ example: '1000000.00' }) conNo!: string;
  @ApiProperty({ enum: TRANG_THAI_THU, nullable: true })
  trangThaiThu!: string | null;
  @ApiProperty({ type: PhieuXuatUserDto, nullable: true })
  createdBy!: PhieuXuatUserDto | null;
  @ApiProperty() createdAt!: Date;
}

export class ChiTietXuatResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() maChiTietPhieuXuatHang!: string;
  @ApiProperty() soLo!: {
    id: string;
    tenLo: string;
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
  @ApiProperty({ example: '125000.00' }) donGia!: string;
  @ApiProperty({ example: '375000.00' }) thanhTien!: string;
  @ApiProperty({ type: [String], description: "'KHONG_THEO_FEFO'" })
  canhBao!: string[];
}

export class ThuTienTomTatDto {
  @ApiProperty() id!: string;
  @ApiProperty() maPhieuThuCongNo!: string;
  @ApiProperty({ example: '300000.00' }) soTien!: string;
  @ApiProperty({ example: '2026-10-06' }) ngayThanhToan!: string;
  @ApiProperty() daHuy!: boolean;
}

export class PhieuXuatResponseDto extends PhieuXuatListItemDto {
  @ApiProperty({ nullable: true }) diaChiGiaoHang!: string | null;
  @ApiProperty({ nullable: true }) ghiChu!: string | null;
  @ApiProperty({ nullable: true }) phuongTienVanChuyen!: {
    id: string;
    bienSo: string;
    isXeLanh: boolean;
  } | null;
  @ApiProperty({ nullable: true }) ngayGiaoThucTe!: string | null;
  @ApiProperty({ type: PhieuXuatUserDto, nullable: true })
  xuatKhoBoi!: PhieuXuatUserDto | null;
  @ApiProperty({ nullable: true }) huyAt!: Date | null;
  @ApiProperty({ type: PhieuXuatUserDto, nullable: true })
  huyBoi!: PhieuXuatUserDto | null;
  @ApiProperty({ nullable: true }) lyDoHuy!: string | null;
  @ApiProperty({ type: [ChiTietXuatResponseDto] })
  chiTiet!: ChiTietXuatResponseDto[];
  @ApiProperty({ type: [ThuTienTomTatDto] }) thuTien!: ThuTienTomTatDto[];
  @ApiProperty() updatedAt!: Date;
}
