import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { LowerTrim, Trim } from '../../common/transformers.js';

export class UpdateProfileDto {
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
}
