import { ApiProperty } from '@nestjs/swagger';

export class LoaiHangResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tenLoaiHang!: string;
  @ApiProperty({ nullable: true, type: String }) ghiChu!: string | null;
  @ApiProperty() trangThai!: boolean;
  @ApiProperty({
    description: 'Số hàng hóa thuộc loại (kể cả ngừng kinh doanh)',
  })
  soHangHoa!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
