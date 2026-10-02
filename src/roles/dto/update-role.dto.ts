import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../common/transformers.js';

// maRole is deliberately absent: it is the key used in code and cannot change.
export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'Quản lý kho' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  tenRole?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  moTa?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  trangThai?: boolean;
}
