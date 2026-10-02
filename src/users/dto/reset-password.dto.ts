import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from '../../common/validators/is-strong-password.js';

export class ResetPasswordDto {
  @ApiProperty({ example: 'MatKhauMoi@123' })
  @IsStrongPassword()
  newPassword!: string;
}
