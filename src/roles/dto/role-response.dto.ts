import { ApiProperty } from '@nestjs/swagger';

export class RoleResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'QUAN_LY_KHO' }) maRole!: string;
  @ApiProperty() tenRole!: string;
  @ApiProperty({ nullable: true, type: String }) moTa!: string | null;
  @ApiProperty() trangThai!: boolean;
  @ApiProperty({ description: 'Số người dùng đang hoạt động thuộc vai trò' })
  soNguoiDung!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
