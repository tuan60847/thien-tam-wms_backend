import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoaiBienDong } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';
import { ToBoolean, Trim } from '../../common/transformers.js';
import { IsDateOnly } from '../../common/validators/is-date-only.js';
import { TRANG_THAI_LO, type TrangThaiLo } from '../../so-lo/dto/so-lo.dto.js';

const INT_MAX = 2_147_483_647;

// ---- queries ---------------------------------------------------------------

export class QueryTonKhoDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() khoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() viTriId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() hangHoaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() soLoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() loaiHangId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isCanGiuLanh?: boolean;

  @ApiPropertyOptional({ enum: TRANG_THAI_LO })
  @IsOptional()
  @IsIn(TRANG_THAI_LO)
  trangThaiLo?: TrangThaiLo;

  @ApiPropertyOptional({
    default: true,
    description: 'Mặc định chỉ dòng có tồn > 0',
  })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  conTon?: boolean;
}

export class QueryTonKhoTongHopDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() khoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() loaiHangId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isCanGiuLanh?: boolean;
}

export class GoiYXuatQueryDto {
  @ApiProperty() @IsUUID() hangHoaId!: string;

  @ApiProperty({
    example: 250,
    description: 'Số lượng cần xuất, theo donViTinh (mặc định đơn vị cơ bản)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(INT_MAX)
  soLuong!: number;

  @ApiPropertyOptional({ example: 'hộp' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(30)
  donViTinh?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() khoId?: string;
}

export class QueryBienDongDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() soLoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() viTriId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() hangHoaId?: string;

  @ApiPropertyOptional({ enum: LoaiBienDong })
  @IsOptional()
  @IsEnum(LoaiBienDong)
  loai?: LoaiBienDong;

  @ApiPropertyOptional({
    description: 'Id chứng từ / thao tác gây ra biến động',
  })
  @IsOptional()
  @IsUUID()
  thamChieuId?: string;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsDateOnly()
  createdAtFrom?: string;
  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsDateOnly()
  createdAtTo?: string;
}

// ---- commands --------------------------------------------------------------

export class ChuyenViTriDto {
  @ApiProperty() @IsUUID() soLoId!: string;
  @ApiProperty() @IsUUID() tuViTriId!: string;
  @ApiProperty() @IsUUID() denViTriId!: string;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1)
  @Max(INT_MAX)
  soLuong!: number;

  @ApiPropertyOptional({ description: 'Mặc định đơn vị cơ bản' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(30)
  donViTinh?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  lyDo?: string;
}

export class DieuChinhTonKhoDto {
  @ApiProperty() @IsUUID() soLoId!: string;
  @ApiProperty() @IsUUID() viTriId!: string;

  @ApiProperty({
    example: 120,
    description: 'Số lượng đếm thực tế, theo đơn vị cơ bản',
  })
  @IsInt()
  @Min(0)
  @Max(INT_MAX)
  soLuongMoi!: number;

  @ApiProperty({ example: 'Kiểm kê tháng 10: lệch 4 viên' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  lyDo!: string;
}

// ---- responses ---------------------------------------------------------------

export class TonKhoLoDto {
  @ApiProperty() id!: string;
  @ApiProperty() tenLo!: string;
  @ApiProperty({ example: '2027-08-01' }) hanSuDung!: string;
  @ApiProperty({ enum: TRANG_THAI_LO }) trangThai!: TrangThaiLo;
  @ApiProperty() soNgayConLai!: number;
}

export class TonKhoHangHoaDto {
  @ApiProperty() id!: string;
  @ApiProperty() maSP!: string;
  @ApiProperty() tenSP!: string;
}

export class TonKhoViTriDto {
  @ApiProperty() id!: string;
  @ApiProperty() tenViTri!: string;
  @ApiProperty() isCapDong!: boolean;
  @ApiProperty() kho!: { id: string; tenKho: string };
}

export class TonKhoResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ description: 'Theo đơn vị cơ bản' }) soLuong!: number;
  @ApiProperty() donViCoBan!: string;
  @ApiProperty({ type: TonKhoLoDto }) soLo!: TonKhoLoDto;
  @ApiProperty({ type: TonKhoHangHoaDto }) hangHoa!: TonKhoHangHoaDto;
  @ApiProperty({ type: TonKhoViTriDto }) viTri!: TonKhoViTriDto;
  @ApiProperty() updatedAt!: Date;
}

export class TonKhoTongHopDto {
  @ApiProperty() hangHoa!: TonKhoHangHoaDto & { donViCoBan: string };
  @ApiProperty() tongTon!: number;
  @ApiProperty({ description: 'Tồn các lô chưa hết hạn' }) tonKhaDung!: number;
  @ApiProperty({ description: 'Một phần của tonKhaDung: lô cận date' })
  tonCanDate!: number;
  @ApiProperty() tonHetHan!: number;
  @ApiProperty() soLo!: number;
}

export class GoiYXuatPhanBoDto {
  @ApiProperty() soLoId!: string;
  @ApiProperty() tenLo!: string;
  @ApiProperty() hanSuDung!: string;
  @ApiProperty() viTriId!: string;
  @ApiProperty() tenViTri!: string;
  @ApiProperty({ description: 'Theo đơn vị cơ bản' }) soLuong!: number;
}

export class GoiYXuatResponseDto {
  @ApiProperty() hangHoaId!: string;
  @ApiProperty({ description: 'Đơn vị cơ bản' }) donViCoBan!: string;
  @ApiProperty({ description: 'Yêu cầu, đã quy đổi về đơn vị cơ bản' })
  yeuCau!: number;
  @ApiProperty() daPhanBo!: number;
  @ApiProperty({ description: '> 0 khi tồn khả dụng không đủ' }) thieu!: number;
  @ApiProperty({ type: [GoiYXuatPhanBoDto] }) phanBo!: GoiYXuatPhanBoDto[];
}

export class ChuyenViTriResponseDto {
  @ApiProperty({ type: TonKhoResponseDto }) tu!: TonKhoResponseDto;
  @ApiProperty({ type: TonKhoResponseDto }) den!: TonKhoResponseDto;
}

export class BienDongTonKhoResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: LoaiBienDong }) loai!: LoaiBienDong;
  @ApiProperty({ description: 'Có dấu: + tăng, − giảm' })
  soLuongThayDoi!: number;
  @ApiProperty() soLuongSau!: number;
  @ApiProperty() soLo!: { id: string; tenLo: string };
  @ApiProperty() viTri!: { id: string; tenViTri: string };
  @ApiProperty({ nullable: true }) thamChieu!: {
    loai: string;
    id: string;
  } | null;
  @ApiProperty({ nullable: true, type: String }) lyDo!: string | null;
  @ApiProperty({ nullable: true }) nguoiThucHien!: {
    id: string;
    maNV: string;
    hoTen: string;
  } | null;
  @ApiProperty() createdAt!: Date;
}

export class DoiSoatResponseDto {
  @ApiProperty() kiemTraLuc!: Date;
  @ApiProperty() soDongKiemTra!: number;
  @ApiProperty() soDongLech!: number;
  @ApiProperty() chiTietLech!: {
    soLoId: string;
    viTriId: string;
    tonKho: number;
    tongBienDong: number;
  }[];
}
