import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { LowerTrim, Trim } from '../../common/transformers.js';

// username, maNV and password are deliberately absent.
export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  hoTen?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @LowerTrim()
  @IsEmail()
  @MaxLength(150)
  email?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiPropertyOptional({ description: 'false = khóa tài khoản' })
  @IsOptional()
  @IsBoolean()
  trangThai?: boolean;
}
