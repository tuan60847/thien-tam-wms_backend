import { ApiProperty } from '@nestjs/swagger';

export class TyLeQuyDoiResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() hangHoaId!: string;
  @ApiProperty() donViTinh!: string;
  @ApiProperty() soLuongQuyDoi!: number;
  @ApiProperty({ description: 'Đơn vị cơ bản (hệ số 1)' })
  laDonViCoBan!: boolean;
  @ApiProperty({ description: 'Đơn vị mà các mức giá của hàng tính theo' })
  laDonViTinhGia!: boolean;
}
