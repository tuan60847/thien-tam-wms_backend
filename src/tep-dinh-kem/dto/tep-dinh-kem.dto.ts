import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';

export const LOAI_DOI_TUONG_TEP = [
  'khach_hang',
  'nha_cung_cap',
  'hang_hoa',
  'phieu_nhap_hang',
  'so_lo',
] as const;
export type LoaiDoiTuongTepValue = (typeof LOAI_DOI_TUONG_TEP)[number];

// Body fields of the multipart upload (the file itself is the `file` part).
export class UploadTepDto {
  @ApiProperty({ enum: LOAI_DOI_TUONG_TEP })
  @IsEnum(LOAI_DOI_TUONG_TEP)
  loaiDoiTuong!: LoaiDoiTuongTepValue;

  @ApiProperty()
  @IsUUID()
  doiTuongId!: string;
}

export class QueryTepDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: LOAI_DOI_TUONG_TEP })
  @IsOptional()
  @IsEnum(LOAI_DOI_TUONG_TEP)
  loaiDoiTuong?: LoaiDoiTuongTepValue;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  doiTuongId?: string;
}

export class TepDinhKemResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: LOAI_DOI_TUONG_TEP }) loaiDoiTuong!: string;
  @ApiProperty() doiTuongId!: string;
  @ApiProperty() tenFile!: string;
  @ApiProperty({ example: 'application/pdf' }) mime!: string;
  @ApiProperty({ description: 'Byte' }) kichThuoc!: number;
  @ApiProperty({ nullable: true }) createdBy!: {
    id: string;
    maNV: string;
    hoTen: string;
  } | null;
  @ApiProperty() createdAt!: Date;
}
