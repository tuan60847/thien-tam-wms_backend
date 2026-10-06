import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';
import { ToBoolean, Trim } from '../../common/transformers.js';
import { IsDateOnly } from '../../common/validators/is-date-only.js';
import { IsPositiveMoney } from '../../common/validators/is-money.js';

export const PHUONG_THUC = ['tien_mat', 'chuyen_khoan'] as const;
export type PhuongThuc = (typeof PHUONG_THUC)[number];

export class CreatePhieuThanhToanDto {
  @ApiProperty() @IsUUID() phieuNhapHangId!: string;

  @ApiProperty({ example: '400000.00' })
  @IsPositiveMoney()
  soTien!: string;

  @ApiProperty({ example: '2026-10-06' })
  @IsDateOnly()
  ngayThanhToan!: string;

  @ApiProperty({ enum: PHUONG_THUC })
  @IsEnum(PHUONG_THUC)
  phuongThuc!: PhuongThuc;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  ghiChu?: string | null;
}

export class QueryPhieuThanhToanDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() phieuNhapHangId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() nhaCungCapId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() createdById?: string;

  @ApiPropertyOptional({ enum: PHUONG_THUC })
  @IsOptional()
  @IsEnum(PHUONG_THUC)
  phuongThuc?: PhuongThuc;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  daHuy?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsDateOnly() ngayThanhToanFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateOnly() ngayThanhToanTo?: string;
}

export class CongNoNccQueryDto {
  @ApiPropertyOptional({ default: true, description: 'Bỏ phiếu đã trả hết' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  chiConNo?: boolean;
}

export class PhieuThanhToanNhapDto {
  @ApiProperty() id!: string;
  @ApiProperty() maPhieuNhapHang!: string;
  @ApiProperty({ example: '1000000.00' }) tongTien!: string;
  @ApiProperty({
    example: '600000.00',
    description: 'Số còn nợ của phiếu nhập tại thời điểm đọc',
  })
  conNoSauKhiTra!: string;
  @ApiProperty() nhaCungCap!: { id: string; maNCC: string; tenNCC: string };
}

export class PhieuThanhToanResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() maPhieuThanhToan!: string;
  @ApiProperty({ example: '400000.00' }) soTien!: string;
  @ApiProperty({ example: '2026-10-06' }) ngayThanhToan!: string;
  @ApiProperty({ enum: PHUONG_THUC }) phuongThuc!: string;
  @ApiProperty({ nullable: true }) ghiChu!: string | null;
  @ApiProperty({ type: PhieuThanhToanNhapDto })
  phieuNhap!: PhieuThanhToanNhapDto;
  @ApiProperty({ nullable: true }) huyAt!: Date | null;
  @ApiProperty({ nullable: true }) huyBoi!: {
    id: string;
    maNV: string;
    hoTen: string;
  } | null;
  @ApiProperty({ nullable: true }) lyDoHuy!: string | null;
  @ApiProperty() daHuy!: boolean;
  @ApiProperty({ nullable: true }) createdBy!: {
    id: string;
    maNV: string;
    hoTen: string;
  } | null;
  @ApiProperty() createdAt!: Date;
}

export class CongNoPhieuDto {
  @ApiProperty() phieuNhapId!: string;
  @ApiProperty() maPhieuNhapHang!: string;
  @ApiProperty({ nullable: true }) ngayNhanHang!: string | null;
  @ApiProperty() tongTien!: string;
  @ApiProperty() daThanhToan!: string;
  @ApiProperty() conNo!: string;
  @ApiProperty() soNgayNo!: number;
}

export class CongNoNccResponseDto {
  @ApiProperty() nhaCungCap!: { id: string; maNCC: string; tenNCC: string };
  @ApiProperty() tongPhaiTra!: string;
  @ApiProperty() daThanhToan!: string;
  @ApiProperty() conNo!: string;
  @ApiProperty({ type: [CongNoPhieuDto] }) phieuConNo!: CongNoPhieuDto[];
  @ApiProperty() generatedAt!: Date;
}
