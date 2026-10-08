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
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';
import { Trim } from '../../common/transformers.js';
import { IsDateOnly } from '../../common/validators/is-date-only.js';
import { IsMoney } from '../../common/validators/is-money.js';

export const TRANG_THAI_TRA_LAI = [
  'cho_xac_nhan',
  'da_nhap_kho',
  'da_huy',
] as const;
export type TrangThaiTraLaiValue = (typeof TRANG_THAI_TRA_LAI)[number];

const PERCENT = /^(100(\.0{1,2})?|\d{1,2}(\.\d{1,2})?)$/;
const INT_MAX = 2_147_483_647;
export const MAX_LINES = 200;

export class ChiTietTraLaiDto {
  @ApiProperty({ description: 'Dòng của phiếu xuất gốc được trả lại' })
  @IsUUID()
  chiTietPhieuXuatHangId!: string;

  @ApiPropertyOptional({ description: 'Mặc định = vị trí đã xuất' })
  @IsOptional()
  @IsUUID()
  viTriId?: string;

  @ApiPropertyOptional({ description: 'Mặc định = đơn vị của dòng xuất' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  donViTinh?: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  @Max(INT_MAX)
  soLuong!: number;

  @ApiPropertyOptional({
    example: '125000.00',
    description: 'Mặc định = đơn giá dòng xuất (bắt buộc nếu đổi đơn vị tính)',
  })
  @IsOptional()
  @IsMoney()
  donGia?: string;

  @ApiPropertyOptional({ description: 'Mặc định = chiết khấu của dòng xuất' })
  @IsOptional()
  @Matches(PERCENT, { message: 'Tỷ lệ chiết khấu phải từ 0 đến 100' })
  tyLeChietKhau?: string;
}

export class CreateTraLaiDto {
  @ApiProperty({ description: 'Phiếu xuất đã xuất kho / đã giao' })
  @IsUUID()
  phieuXuatHangId!: string;

  @ApiPropertyOptional({ nullable: true, description: 'Mặc định hôm nay' })
  @IsOptional()
  @IsDateOnly()
  ngayTraLai?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  lyDo?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  ghiChu?: string | null;

  @ApiPropertyOptional({ type: [ChiTietTraLaiDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_LINES)
  @ValidateNested({ each: true })
  @Type(() => ChiTietTraLaiDto)
  chiTiet?: ChiTietTraLaiDto[];
}

// The source order never changes; sending chiTiet replaces every line.
export class UpdateTraLaiDto extends PartialType(CreateTraLaiDto) {}

const toArray = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.split(',').filter(Boolean) : value;

export class QueryTraLaiDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() khachHangId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() phieuXuatHangId?: string;

  @ApiPropertyOptional({ enum: TRANG_THAI_TRA_LAI, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(TRANG_THAI_TRA_LAI, { each: true })
  trangThai?: TrangThaiTraLaiValue[];

  @ApiPropertyOptional() @IsOptional() @IsDateOnly() ngayTraLaiFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateOnly() ngayTraLaiTo?: string;
}

// ---- responses -----------------------------------------------------------

export class TraLaiListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'TL2610080001' }) maTraLai!: string;
  @ApiProperty({ enum: TRANG_THAI_TRA_LAI }) trangThai!: string;
  @ApiProperty({ example: '2026-10-08' }) ngayTraLai!: string;
  @ApiProperty() khachHang!: { id: string; maKH: string; tenKH: string };
  @ApiProperty({ nullable: true }) phieuXuat!: {
    id: string;
    maPhieuXuatHang: string;
  } | null;
  @ApiProperty() soDong!: number;
  @ApiProperty({
    example: '240000.00',
    description: 'Giá trị hàng trả = Σ (số lượng × đơn giá − chiết khấu)',
  })
  giaTri!: string;
  @ApiProperty() createdAt!: Date;
}

export class ChiTietTraLaiResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() maChiTiet!: string;
  @ApiProperty({ nullable: true, type: String }) chiTietPhieuXuatHangId!:
    string | null;
  @ApiProperty() soLo!: {
    id: string;
    tenLo: string;
    hanSuDung: string;
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
  @ApiProperty({ example: '0.00' }) tyLeChietKhau!: string;
  @ApiProperty({ example: '0.00' }) tienChietKhau!: string;
  @ApiProperty({
    example: '250000.00',
    description: 'Số lượng × đơn giá − chiết khấu',
  })
  thanhTien!: string;
}

export class TraLaiResponseDto extends TraLaiListItemDto {
  @ApiProperty({ nullable: true }) lyDo!: string | null;
  @ApiProperty({ nullable: true }) ghiChu!: string | null;
  @ApiProperty({ nullable: true }) xacNhanAt!: Date | null;
  @ApiProperty({ nullable: true }) huyAt!: Date | null;
  @ApiProperty({ nullable: true }) lyDoHuy!: string | null;
  @ApiProperty({ type: [ChiTietTraLaiResponseDto] })
  chiTiet!: ChiTietTraLaiResponseDto[];
  @ApiProperty() updatedAt!: Date;
}
