import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { LowerTrim, Trim } from '../../common/transformers.js';
import { IsStrongPassword } from '../../common/validators/is-strong-password.js';
import { IsUsername } from '../../common/validators/is-username.js';

export class CreateUserDto {
  @ApiProperty({ example: 'nhanvien01' })
  @LowerTrim()
  @IsUsername()
  username!: string;

  @ApiProperty({ example: 'Matkhau@123' })
  @IsStrongPassword()
  password!: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  hoTen!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @LowerTrim()
  @IsEmail()
  @MaxLength(150)
  email?: string | null;

  @ApiProperty({ description: 'Id vai trò (vai trò phải đang hoạt động)' })
  @IsUUID()
  roleId!: string;
}
