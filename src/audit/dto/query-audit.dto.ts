import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { IsDateOnly } from '../../common/validators/is-date-only.js';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';

export class QueryAuditDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  hanhDong?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  doiTuong?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(36)
  doiTuongId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsDateOnly()
  createdAtFrom?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsDateOnly()
  createdAtTo?: string;
}
