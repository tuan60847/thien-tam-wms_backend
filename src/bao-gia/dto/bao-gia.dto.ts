import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
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

export const MAX_LINES = 200;
const PERCENT = /^(100(\.0{1,2})?|\d{1,2}(\.\d{1,2})?)$/;
const INT_MAX = 2_147_483_647;

export class ChiTietBaoGiaDto {
  @ApiProperty() @IsUUID() hangHoaId!: string;

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

  @ApiPropertyOptional({ example: '5.00', description: 'Chiết khấu (%)' })
  @IsOptional()
  @Matches(PERCENT, { message: 'Tỷ lệ chiết khấu phải từ 0 đến 100' })
  tyLeChietKhau?: string;

  @ApiPropertyOptional({
    example: '8.00',
    description: 'Thuế suất GTGT (%); mặc định lấy từ hàng hóa',
  })
  @IsOptional()
  @Matches(PERCENT, { message: 'Thuế suất phải từ 0 đến 100' })
  thueSuatGtgt?: string;
}

export class CreateBaoGiaDto {
  @ApiProperty() @IsUUID() khachHangId!: string;

  @ApiPropertyOptional({ description: 'Mặc định hôm nay' })
  @IsOptional()
  @IsDateOnly()
  ngayBaoGia?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Không có = không hết hạn',
  })
  @IsOptional()
  @IsDateOnly()
  hanHieuLuc?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Mặc định lấy từ khách hàng',
  })
  @IsOptional()
  @IsUUID()
  nhanVienBanHangId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  ghiChu?: string | null;

  @ApiProperty({ type: [ChiTietBaoGiaDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_LINES)
  @ValidateNested({ each: true })
  @Type(() => ChiTietBaoGiaDto)
  chiTiet!: ChiTietBaoGiaDto[];
}

// Sending chiTiet replaces every line.
export class UpdateBaoGiaDto extends PartialType(CreateBaoGiaDto) {}

export class QueryBaoGiaDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() khachHangId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateOnly() ngayBaoGiaFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateOnly() ngayBaoGiaTo?: string;

  @ApiPropertyOptional({
    description: 'true = còn hiệu lực, false = đã hết hạn',
  })
  @IsOptional()
  @Matches(/^(true|false)$/)
  conHieuLuc?: 'true' | 'false';

  @ApiPropertyOptional({
    description: 'true = đã có phiếu xuất (chưa hủy), false = chưa chuyển',
  })
  @IsOptional()
  @Matches(/^(true|false)$/)
  daChuyenPhieuXuat?: 'true' | 'false';
}

export class PhanBoLoDto {
  @ApiProperty({ description: 'Dòng của báo giá' })
  @IsUUID()
  chiTietBaoGiaId!: string;

  @ApiProperty() @IsUUID() soLoId!: string;
  @ApiProperty() @IsUUID() viTriId!: string;

  @ApiProperty({
    example: 3,
    description:
      'Theo đơn vị tính của dòng báo giá; tổng các phần = số lượng dòng',
  })
  @IsInt()
  @Min(1)
  @Max(INT_MAX)
  soLuong!: number;

  @ApiPropertyOptional({
    description: 'Hàng khuyến mại: không kiểm giá tối thiểu',
  })
  @IsOptional()
  @IsBoolean()
  laHangKhuyenMai?: boolean;
}

export class ChuyenPhieuXuatDto {
  @ApiPropertyOptional({
    description:
      'Lý do vượt hạn mức nợ của khách: chỉ ADMIN/QUAN_LY_KHO được phép',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  vuotHanMucLyDo?: string;

  @ApiProperty({
    type: [PhanBoLoDto],
    description: 'Chọn lô/vị trí xuất cho từng dòng báo giá (phủ đủ số lượng)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_LINES)
  @ValidateNested({ each: true })
  @Type(() => PhanBoLoDto)
  phanBo!: PhanBoLoDto[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  phuongTienVanChuyenId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateOnly()
  ngayGiaoHang?: string | null;

  @ApiPropertyOptional({ nullable: true })
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
}

// ---- responses -----------------------------------------------------------

export class BaoGiaTotalsDto {
  @ApiProperty({ example: '1000000.00' }) tongTienHang!: string;
  @ApiProperty({ example: '0.00' }) tienChietKhau!: string;
  @ApiProperty({ example: '0.00' }) tienThueGtgt!: string;
  @ApiProperty({ example: '1000000.00' }) tongThanhToan!: string;
}

export class BaoGiaPhieuXuatDto {
  @ApiProperty() id!: string;
  @ApiProperty() maPhieuXuatHang!: string;
  @ApiProperty() trangThai!: string;
}

export class BaoGiaListItemDto extends BaoGiaTotalsDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'BG2610090001' }) maBaoGia!: string;
  @ApiProperty({ example: '2026-10-09' }) ngayBaoGia!: string;
  @ApiProperty({ nullable: true, example: '2026-10-31' }) hanHieuLuc!:
    string | null;
  @ApiProperty() conHieuLuc!: boolean;
  @ApiProperty({ description: 'Có phiếu xuất chưa hủy tạo từ báo giá này' })
  daChuyenPhieuXuat!: boolean;
  @ApiProperty() khachHang!: { id: string; maKH: string; tenKH: string };
  @ApiProperty() soDong!: number;
  @ApiProperty() createdAt!: Date;
}

export class ChiTietBaoGiaResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() hangHoa!: { id: string; maSP: string; tenSP: string };
  @ApiProperty() donViTinh!: string;
  @ApiProperty() soLuong!: number;
  @ApiProperty({ example: '125000.00' }) donGia!: string;
  @ApiProperty({ example: '375000.00' }) thanhTien!: string;
  @ApiProperty({ example: '0.00' }) tyLeChietKhau!: string;
  @ApiProperty({ example: '0.00' }) tienChietKhau!: string;
  @ApiProperty({ example: '0.00' }) thueSuatGtgt!: string;
  @ApiProperty({ example: '0.00' }) tienThueGtgt!: string;
}

export class BaoGiaResponseDto extends BaoGiaListItemDto {
  @ApiProperty({ nullable: true }) ghiChu!: string | null;
  @ApiProperty({ nullable: true }) nhanVienBanHang!: {
    id: string;
    maNV: string;
    hoTen: string;
  } | null;
  @ApiProperty({ nullable: true }) createdBy!: {
    id: string;
    maNV: string;
    hoTen: string;
  } | null;
  @ApiProperty({ type: [ChiTietBaoGiaResponseDto] })
  chiTiet!: ChiTietBaoGiaResponseDto[];
  @ApiProperty({ type: [BaoGiaPhieuXuatDto] })
  phieuXuats!: BaoGiaPhieuXuatDto[];
  @ApiProperty() updatedAt!: Date;
}
