import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';
import { Trim } from '../../common/transformers.js';
import { IsDateOnly } from '../../common/validators/is-date-only.js';
import { IsMoney } from '../../common/validators/is-money.js';

export const TRANG_THAI_PHIEU_XUAT = [
  'cho_xu_ly',
  'da_xuat_kho',
  'da_giao',
  'da_huy',
] as const;
export type TrangThaiPhieuXuatValue = (typeof TRANG_THAI_PHIEU_XUAT)[number];

export const TRANG_THAI_THU = [
  'chua_thu',
  'thu_mot_phan',
  'da_thu_du',
] as const;

export const TINH_TRANG_NO = [
  'no_binh_thuong',
  'no_kho_doi',
  'no_khong_the_doi',
] as const;
export type TinhTrangNoValue = (typeof TINH_TRANG_NO)[number];

export const HINH_THUC_THANH_TOAN = ['chua_thu_tien', 'thu_tien_ngay'] as const;
export type HinhThucThanhToanValue = (typeof HINH_THUC_THANH_TOAN)[number];

export const PHUONG_THUC_THU = ['tien_mat', 'chuyen_khoan'] as const;
export type PhuongThucThuValue = (typeof PHUONG_THUC_THU)[number];

export const MAX_LINES = 200;
const PERCENT = /^(100(\.0{1,2})?|\d{1,2}(\.\d{1,2})?)$/;
const INT_MAX = 2_147_483_647;

export class ChiTietXuatDto {
  @ApiProperty() @IsUUID() soLoId!: string;
  @ApiProperty() @IsUUID() viTriId!: string;

  @ApiProperty({ example: 'hộp' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  donViTinh!: string;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  @Max(INT_MAX)
  soLuong!: number;

  @ApiProperty({ example: '125000.00', description: 'Theo donViTinh của dòng' })
  @IsMoney()
  donGia!: string;

  @ApiPropertyOptional({
    description: 'Hàng khuyến mại: không kiểm giá tối thiểu',
  })
  @IsOptional()
  @IsBoolean()
  laHangKhuyenMai?: boolean;

  @ApiPropertyOptional({
    example: '5.00',
    description: 'Tỷ lệ chiết khấu (%), 0 đến 100',
  })
  @IsOptional()
  @Matches(PERCENT, { message: 'Tỷ lệ chiết khấu phải từ 0 đến 100' })
  tyLeChietKhau?: string;

  @ApiPropertyOptional({
    example: '8.00',
    description: 'Thuế suất GTGT (%); mặc định lấy từ hàng hóa',
  })
  @IsOptional()
  @Matches(PERCENT, { message: 'Thuế suất phải từ 0 đến 100' })
  thueSuatGtgt?: string;
}

export class CreatePhieuXuatDto {
  @ApiProperty() @IsUUID() khachHangId!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  phuongTienVanChuyenId?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Dự kiến' })
  @IsOptional()
  @IsDateOnly()
  ngayGiaoHang?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Mặc định lấy địa chỉ khách lúc lập',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  diaChiGiaoHang?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  ghiChu?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Mặc định lấy từ khách hàng',
  })
  @IsOptional()
  @IsUUID()
  nhanVienBanHangId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Mặc định lấy từ khách hàng',
  })
  @IsOptional()
  @IsUUID()
  dieuKhoanThanhToanId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Số ngày được nợ; mặc định theo điều khoản hoặc khách hàng',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  soNgayDuocNo?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Mặc định = ngày xuất kho + số ngày được nợ',
  })
  @IsOptional()
  @IsDateOnly()
  hanThanhToan?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  thamChieu?: string | null;

  @ApiPropertyOptional({
    enum: HINH_THUC_THANH_TOAN,
    description:
      'thu_tien_ngay: khi xuất kho tự lập phiếu thu đủ tổng phiếu, không phát sinh nợ',
  })
  @IsOptional()
  @IsEnum(HINH_THUC_THANH_TOAN)
  hinhThucThanhToan?: HinhThucThanhToanValue;

  @ApiPropertyOptional({
    enum: PHUONG_THUC_THU,
    nullable: true,
    description:
      'Phương thức của phiếu thu tự lập khi xuất kho (thu_tien_ngay); mặc định tiền mặt',
  })
  @IsOptional()
  @IsEnum(PHUONG_THUC_THU)
  phuongThucThu?: PhuongThucThuValue | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  lapKemHoaDon?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  dieuKhoanKhac?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  tenMatHangChung?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Mặc định lấy người liên hệ của khách',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  nguoiLienHe?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  baoGiaId?: string | null;

  @ApiPropertyOptional({
    description:
      'Lý do vượt hạn mức nợ: chỉ ADMIN/QUAN_LY_KHO được phép; ghi vào nhật ký',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  vuotHanMucLyDo?: string;

  @ApiPropertyOptional({ type: [ChiTietXuatDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_LINES)
  @ValidateNested({ each: true })
  @Type(() => ChiTietXuatDto)
  chiTiet?: ChiTietXuatDto[];
}

// Sending chiTiet replaces every line.
export class UpdatePhieuXuatDto extends PartialType(CreatePhieuXuatDto) {}

export class XuatKhoDto {
  @ApiPropertyOptional({
    description:
      'Lý do vượt hạn mức nợ: chỉ ADMIN/QUAN_LY_KHO được phép; ghi vào nhật ký',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  vuotHanMucLyDo?: string;

  @ApiPropertyOptional({
    enum: PHUONG_THUC_THU,
    default: 'tien_mat',
    description:
      'Chỉ dùng khi phiếu là thu_tien_ngay; ghi đè phương thức đã lưu trên phiếu',
  })
  @IsOptional()
  @IsEnum(PHUONG_THUC_THU)
  phuongThucThu?: PhuongThucThuValue;
}

export class GiaoHangDto {
  @ApiPropertyOptional({ description: 'Mặc định hôm nay' })
  @IsOptional()
  @IsDateOnly()
  ngayGiaoThucTe?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  ghiChu?: string;
}

export class DoiTinhTrangNoDto {
  @ApiProperty({ enum: TINH_TRANG_NO })
  @IsEnum(TINH_TRANG_NO)
  tinhTrangNo!: TinhTrangNoValue;

  @ApiPropertyOptional({ description: 'Lý do đổi (ghi vào nhật ký)' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  lyDo?: string;
}

const toArray = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.split(',').filter(Boolean) : value;

export class QueryPhieuXuatDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() khachHangId?: string;

  @ApiPropertyOptional({ enum: TRANG_THAI_PHIEU_XUAT, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(TRANG_THAI_PHIEU_XUAT, { each: true })
  trangThai?: TrangThaiPhieuXuatValue[];

  @ApiPropertyOptional({ enum: TRANG_THAI_THU })
  @IsOptional()
  @IsEnum(TRANG_THAI_THU)
  trangThaiThu?: (typeof TRANG_THAI_THU)[number];

  @ApiPropertyOptional({ enum: TINH_TRANG_NO })
  @IsOptional()
  @IsEnum(TINH_TRANG_NO)
  tinhTrangNo?: TinhTrangNoValue;

  @ApiPropertyOptional() @IsOptional() @IsUUID() createdById?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() hangHoaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() soLoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateOnly() createdAtFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateOnly() createdAtTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateOnly() ngayXuatKhoFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateOnly() ngayXuatKhoTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateOnly() ngayGiaoHangFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateOnly() ngayGiaoHangTo?: string;
}

// ---- responses -----------------------------------------------------------

export class PhieuXuatKhachDto {
  @ApiProperty() id!: string;
  @ApiProperty() maKH!: string;
  @ApiProperty() tenKH!: string;
}

export class PhieuXuatUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() maNV!: string;
  @ApiProperty() hoTen!: string;
}

export class PhieuXuatListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() maPhieuXuatHang!: string;
  @ApiProperty({ type: PhieuXuatKhachDto }) khachHang!: PhieuXuatKhachDto;
  @ApiProperty({ enum: TRANG_THAI_PHIEU_XUAT }) trangThai!: string;
  @ApiProperty({ nullable: true }) ngayGiaoHang!: string | null;
  @ApiProperty({ nullable: true }) ngayXuatKho!: string | null;
  @ApiProperty() soDong!: number;
  @ApiProperty({
    example: '1000000.00',
    description: 'Tổng thanh toán = tiền hàng − chiết khấu + thuế GTGT',
  })
  tongTien!: string;
  @ApiProperty({ example: '1000000.00' }) tongTienHang!: string;
  @ApiProperty({ example: '0.00' }) tienChietKhau!: string;
  @ApiProperty({ example: '0.00' }) tienThueGtgt!: string;
  @ApiProperty({ example: '0.00' }) daThu!: string;
  @ApiProperty({
    example: '0.00',
    description: 'Giá trị hàng khách đã trả lại',
  })
  giaTriTraLai!: string;
  @ApiProperty({ example: '1000000.00' }) conNo!: string;
  @ApiProperty({ enum: TRANG_THAI_THU, nullable: true })
  trangThaiThu!: string | null;
  @ApiProperty({ type: PhieuXuatUserDto, nullable: true })
  createdBy!: PhieuXuatUserDto | null;
  @ApiProperty() createdAt!: Date;
}

export class ChiTietXuatResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() maChiTietPhieuXuatHang!: string;
  @ApiProperty() soLo!: {
    id: string;
    tenLo: string;
    hanSuDung: string;
    trangThai: string;
    hangHoa: { id: string; maSP: string; tenSP: string };
  };
  @ApiProperty() viTri!: {
    id: string;
    tenViTri: string;
    kho: { id: string; tenKho: string };
  };
  @ApiProperty() donViTinh!: string;
  @ApiProperty() heSoQuyDoi!: number;
  @ApiProperty() soLuong!: number;
  @ApiProperty() soLuongCoBan!: number;
  @ApiProperty({ example: '125000.00' }) donGia!: string;
  @ApiProperty({
    example: '375000.00',
    description: 'Số lượng × đơn giá (chưa chiết khấu, chưa thuế)',
  })
  thanhTien!: string;
  @ApiProperty() laHangKhuyenMai!: boolean;
  @ApiProperty({ example: '0.00' }) tyLeChietKhau!: string;
  @ApiProperty({ example: '0.00' }) tienChietKhau!: string;
  @ApiProperty({ example: '0.00' }) thueSuatGtgt!: string;
  @ApiProperty({ example: '0.00' }) tienThueGtgt!: string;
  @ApiProperty({ type: [String], description: "'KHONG_THEO_FEFO'" })
  canhBao!: string[];
}

export class ThuTienTomTatDto {
  @ApiProperty() id!: string;
  @ApiProperty() maPhieuThuCongNo!: string;
  @ApiProperty({ example: '300000.00' }) soTien!: string;
  @ApiProperty({ example: '2026-10-06' }) ngayThanhToan!: string;
  @ApiProperty() daHuy!: boolean;
}

export class PhieuXuatResponseDto extends PhieuXuatListItemDto {
  @ApiProperty({ nullable: true }) diaChiGiaoHang!: string | null;
  @ApiProperty({ nullable: true }) ghiChu!: string | null;
  @ApiProperty({ nullable: true }) phuongTienVanChuyen!: {
    id: string;
    bienSo: string;
    isXeLanh: boolean;
  } | null;
  @ApiProperty({ nullable: true }) ngayGiaoThucTe!: string | null;
  @ApiProperty({ enum: HINH_THUC_THANH_TOAN })
  hinhThucThanhToan!: string;
  @ApiProperty({ enum: PHUONG_THUC_THU, nullable: true })
  phuongThucThu!: string | null;
  @ApiProperty({ enum: TINH_TRANG_NO })
  tinhTrangNo!: string;
  @ApiProperty({ nullable: true, type: Number }) soNgayDuocNo!: number | null;
  @ApiProperty({ nullable: true, example: '2026-11-06' }) hanThanhToan!:
    string | null;
  @ApiProperty({ nullable: true }) thamChieu!: string | null;
  @ApiProperty() lapKemHoaDon!: boolean;
  @ApiProperty() daLapHoaDon!: boolean;
  @ApiProperty({ nullable: true }) dieuKhoanKhac!: string | null;
  @ApiProperty({ nullable: true }) tenMatHangChung!: string | null;
  @ApiProperty({ nullable: true }) nguoiLienHe!: string | null;
  @ApiProperty({
    nullable: true,
    description: 'Thông tin khách chụp lại lúc lập phiếu',
  })
  khachSnapshot!: {
    ten: string | null;
    maSoThue: string | null;
    diaChi: string | null;
  };
  @ApiProperty({ nullable: true }) nhanVienBanHang!: {
    id: string;
    maNV: string;
    hoTen: string;
  } | null;
  @ApiProperty({ nullable: true }) dieuKhoanThanhToan!: {
    id: string;
    ma: string;
    ten: string;
    soNgayDuocNo: number;
  } | null;
  @ApiProperty({ nullable: true, type: String }) baoGiaId!: string | null;
  @ApiProperty({ type: PhieuXuatUserDto, nullable: true })
  xuatKhoBoi!: PhieuXuatUserDto | null;
  @ApiProperty({ nullable: true }) huyAt!: Date | null;
  @ApiProperty({ type: PhieuXuatUserDto, nullable: true })
  huyBoi!: PhieuXuatUserDto | null;
  @ApiProperty({ nullable: true }) lyDoHuy!: string | null;
  @ApiProperty({ type: [ChiTietXuatResponseDto] })
  chiTiet!: ChiTietXuatResponseDto[];
  @ApiProperty({ type: [ThuTienTomTatDto] }) thuTien!: ThuTienTomTatDto[];
  @ApiProperty() updatedAt!: Date;
}
