import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    default: DEFAULT_PAGE_SIZE,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({
    description: 'field:asc|desc, nhiều field cách nhau dấu phẩy',
    example: 'hanSuDung:asc,tenLo:asc',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sort?: string;

  @ApiPropertyOptional({ description: 'Tìm kiếm văn bản tự do' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
