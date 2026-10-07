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

export class CreatePhieuThuDto {
  @ApiProperty() @IsUUID() phieuXuatHangId!: string;

  @ApiProperty({ example: '300000.00' })
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

export class QueryPhieuThuDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() phieuXuatHangId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() khachHangId?: string;
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

export class CongNoKhachQueryDto {
  @ApiPropertyOptional({ default: true, description: 'Bỏ phiếu đã thu đủ' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  chiConNo?: boolean;
}

export class PhieuThuXuatDto {
  @ApiProperty() id!: string;
  @ApiProperty() maPhieuXuatHang!: string;
  @ApiProperty({ nullable: true }) ngayXuatKho!: string | null;
  @ApiProperty({ example: '1000000.00' }) tongTien!: string;
  @ApiProperty({
    example: '700000.00',
    description: 'Số còn nợ của phiếu xuất tại thời điểm đọc',
  })
  conNoSauKhiThu!: string;
  @ApiProperty() khachHang!: { id: string; maKH: string; tenKH: string };
}

export class PhieuThuResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() maPhieuThuCongNo!: string;
  @ApiProperty({ example: '300000.00' }) soTien!: string;
  @ApiProperty({ example: '2026-10-06' }) ngayThanhToan!: string;
  @ApiProperty({ enum: PHUONG_THUC }) phuongThuc!: string;
  @ApiProperty({ nullable: true }) ghiChu!: string | null;
  @ApiProperty({ type: PhieuThuXuatDto }) phieuXuat!: PhieuThuXuatDto;
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

export class CongNoPhieuXuatDto {
  @ApiProperty() phieuXuatId!: string;
  @ApiProperty() maPhieuXuatHang!: string;
  @ApiProperty({ nullable: true }) ngayXuatKho!: string | null;
  @ApiProperty() tongTien!: string;
  @ApiProperty() daThu!: string;
  @ApiProperty() conNo!: string;
  @ApiProperty() soNgayNo!: number;
  @ApiProperty({ enum: ['0-30', '31-60', '61-90', '>90'] }) nhomTuoiNo!: string;
}

export class CongNoKhachResponseDto {
  @ApiProperty() khachHang!: {
    id: string;
    maKH: string;
    tenKH: string;
    hanMucCongNo: string | null;
  };
  @ApiProperty() tongPhaiThu!: string;
  @ApiProperty() daThu!: string;
  @ApiProperty() conNo!: string;
  @ApiProperty({ nullable: true, type: Boolean }) vuotHanMuc!: boolean | null;
  @ApiProperty({ type: [CongNoPhieuXuatDto] })
  phieuConNo!: CongNoPhieuXuatDto[];
  @ApiProperty() generatedAt!: Date;
}
