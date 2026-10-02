import { ApiProperty } from '@nestjs/swagger';

export class UserRoleDto {
  @ApiProperty() id!: string;
  @ApiProperty() maRole!: string;
  @ApiProperty() tenRole!: string;
}

// Never contains the password hash.
export class UserResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'NV0002' }) maNV!: string;
  @ApiProperty() username!: string;
  @ApiProperty() hoTen!: string;
  @ApiProperty({ nullable: true, type: String }) email!: string | null;
  @ApiProperty() trangThai!: boolean;
  @ApiProperty({ nullable: true, type: UserRoleDto }) role!: UserRoleDto | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
