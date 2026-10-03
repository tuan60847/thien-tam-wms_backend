import { ApiPropertyOptional } from '@nestjs/swagger';
import { LoaiKiemSoat } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';
import { ToBoolean } from '../../common/transformers.js';

export class QueryHangHoaDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  loaiHangId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isKeDon?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isCanGiuLanh?: boolean;

  @ApiPropertyOptional({ enum: LoaiKiemSoat })
  @IsOptional()
  @IsEnum(LoaiKiemSoat)
  loaiKiemSoat?: LoaiKiemSoat;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  trangThai?: boolean;
}
