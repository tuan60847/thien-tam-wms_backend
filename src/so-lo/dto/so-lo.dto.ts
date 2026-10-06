import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';
import { ToBoolean, Trim } from '../../common/transformers.js';
import { IsDateOnly } from '../../common/validators/is-date-only.js';

export const TRANG_THAI_LO = ['con_han', 'can_date', 'het_han'] as const;
export type TrangThaiLo = (typeof TRANG_THAI_LO)[number];

export class CreateSoLoDto {
  @ApiProperty()
  @IsUUID()
  hangHoaId!: string;

  @ApiProperty({ example: 'L240801' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  tenLo!: string;

  @ApiPropertyOptional({ example: '2025-08-01', nullable: true })
  @IsOptional()
  @IsDateOnly()
  ngaySX?: string | null;

  @ApiProperty({ example: '2027-08-01' })
  @IsDateOnly()
  hanSuDung!: string;
}

// hangHoaId never changes after creation.
export class UpdateSoLoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  tenLo?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateOnly()
  ngaySX?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateOnly()
  hanSuDung?: string;

  @ApiPropertyOptional({
    description: 'Bắt buộc khi đổi hạn/ngày SX của lô đã có biến động tồn',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  lyDo?: string;
}

export class QuerySoLoDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  hangHoaId?: string;

  @ApiPropertyOptional({ enum: TRANG_THAI_LO })
  @IsOptional()
  @IsIn(TRANG_THAI_LO)
  trangThai?: TrangThaiLo;

  @ApiPropertyOptional({ description: 'Chỉ lô đang còn tồn (soLuong > 0)' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  conTon?: boolean;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsDateOnly()
  hanSuDungFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateOnly()
  hanSuDungTo?: string;
}

export class SoLoHangHoaDto {
  @ApiProperty() id!: string;
  @ApiProperty() maSP!: string;
  @ApiProperty() tenSP!: string;
}

export class SoLoResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tenLo!: string;
  @ApiProperty({ nullable: true, type: String, example: '2025-08-01' })
  ngaySX!: string | null;
  @ApiProperty({ example: '2027-08-01' }) hanSuDung!: string;
  @ApiProperty({
    enum: TRANG_THAI_LO,
    description: 'Tính khi đọc theo hạn sử dụng',
  })
  trangThai!: TrangThaiLo;
  @ApiProperty({ description: 'Âm khi đã quá hạn' }) soNgayConLai!: number;
  @ApiProperty({ type: SoLoHangHoaDto }) hangHoa!: SoLoHangHoaDto;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class SoLoDetailDto extends SoLoResponseDto {
  @ApiProperty({ description: 'Tổng tồn theo đơn vị cơ bản' }) tongTon!: number;
  @ApiProperty({ description: 'Số vị trí đang có hàng' }) soViTri!: number;
  @ApiProperty({ description: 'Đã có dòng chứng từ nhập/xuất' })
  daPhatSinhChungTu!: boolean;
}
