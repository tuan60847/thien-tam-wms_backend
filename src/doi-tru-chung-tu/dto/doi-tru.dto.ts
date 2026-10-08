import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';
import { ToBoolean } from '../../common/transformers.js';
import { IsPositiveMoney } from '../../common/validators/is-money.js';

export class CreateDoiTruDto {
  @ApiProperty({ description: 'Phiếu thu còn số tiền chưa đối trừ' })
  @IsUUID()
  phieuThuCongNoId!: string;

  @ApiProperty({ description: 'Phiếu xuất cùng khách hàng, còn nợ' })
  @IsUUID()
  phieuXuatHangId!: string;

  @ApiProperty({ example: '300000.00' })
  @IsPositiveMoney()
  soTienDoiTru!: string;
}

export class QueryDoiTruDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() phieuThuCongNoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() phieuXuatHangId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() khachHangId?: string;

  @ApiPropertyOptional({ description: 'true = đã bỏ đối trừ' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  daBo?: boolean;
}

export class DoiTruResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: '300000.00' }) soTienDoiTru!: string;
  @ApiProperty({ example: '2026-10-08' }) ngayDoiTru!: string;
  @ApiProperty({ description: 'Đã bỏ đối trừ hoặc phiếu thu đã hủy' })
  daBo!: boolean;
  @ApiProperty() phieuThuCongNo!: {
    id: string;
    maPhieuThuCongNo: string;
    soTien: string;
    daHuy: boolean;
  };
  @ApiProperty() phieuXuat!: {
    id: string;
    maPhieuXuatHang: string;
    khachHang: { id: string; maKH: string; tenKH: string };
  };
  @ApiProperty() createdAt!: Date;
}
