import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoaiKiemSoat } from '@prisma/client';

export class HangHoaLoaiDto {
  @ApiProperty() id!: string;
  @ApiProperty() tenLoaiHang!: string;
}

export class HangHoaDonViDto {
  @ApiProperty() id!: string;
  @ApiProperty() donViTinh!: string;
  @ApiProperty() soLuongQuyDoi!: number;
}

export class HangHoaListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'SP00001' }) maSP!: string;
  @ApiProperty() tenSP!: string;
  @ApiProperty({ nullable: true, type: String }) quyCach!: string | null;
  @ApiProperty({ type: HangHoaLoaiDto }) loaiHang!: HangHoaLoaiDto;
  @ApiProperty({ description: 'Đơn vị nhỏ nhất (hệ số 1)' })
  donViCoBan!: string;
  @ApiProperty({ description: 'Đơn vị mà các mức giá tính theo' })
  donViTinhGia!: string;
  @ApiProperty({ example: '1500.00' }) giaHienThi!: string;
  @ApiPropertyOptional({ description: 'Chỉ ADMIN, QUAN_LY_KHO, KE_TOAN thấy' })
  giaNhap?: string;
  @ApiPropertyOptional({ description: 'Chỉ ADMIN, QUAN_LY_KHO, KE_TOAN thấy' })
  giaToiThieu?: string;
  @ApiProperty() isKeDon!: boolean;
  @ApiProperty() isCanGiuLanh!: boolean;
  @ApiProperty({ enum: LoaiKiemSoat, nullable: true })
  loaiKiemSoat!: LoaiKiemSoat | null;
  @ApiProperty() trangThai!: boolean;
}

export class HangHoaResponseDto extends HangHoaListItemDto {
  @ApiProperty({ nullable: true, type: String }) soDangKy!: string | null;
  @ApiProperty({ nullable: true, type: String }) ghiChu!: string | null;
  @ApiProperty({ type: [HangHoaDonViDto] }) tyLeQuyDoi!: HangHoaDonViDto[];
  @ApiProperty({ nullable: true, type: String }) maQuyCach!: string | null;
  @ApiProperty({ example: '8.00', description: 'Thuế suất GTGT (%)' })
  thueSuatGtgt!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
