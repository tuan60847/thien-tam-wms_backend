import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';
import { ToBoolean } from '../../common/transformers.js';
import { IsDateOnly } from '../../common/validators/is-date-only.js';

export const TON_KHO_GROUP = ['hang-hoa', 'kho', 'loai-hang'] as const;
export const DOANH_THU_GROUP = [
  'ngay',
  'thang',
  'khach-hang',
  'hang-hoa',
  'nguoi-tao',
] as const;
export const TRANG_THAI_LO = ['con_han', 'can_date', 'het_han'] as const;

// ---- queries --------------------------------------------------------------

export class BaoCaoTonKhoQueryDto {
  @ApiPropertyOptional({ enum: TON_KHO_GROUP, default: 'hang-hoa' })
  @IsOptional()
  @IsEnum(TON_KHO_GROUP)
  groupBy?: (typeof TON_KHO_GROUP)[number];

  @ApiPropertyOptional() @IsOptional() @IsUUID() khoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() loaiHangId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() hangHoaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isCanGiuLanh?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  chiConTon?: boolean;
}

export class BaoCaoTheoLoQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() khoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() hangHoaId?: string;

  @ApiPropertyOptional({ enum: TRANG_THAI_LO })
  @IsOptional()
  @IsEnum(TRANG_THAI_LO)
  trangThaiLo?: (typeof TRANG_THAI_LO)[number];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  conTon?: boolean;
}

export class BaoCaoCanDateQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Mặc định EXPIRY_WARNING_DAYS' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  soNgay?: number;

  @ApiPropertyOptional() @IsOptional() @IsUUID() khoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() hangHoaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() loaiHangId?: string;
}

export class BaoCaoHetHanQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() khoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() hangHoaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() loaiHangId?: string;
}

export class BaoCaoNhapXuatTonQueryDto {
  @ApiProperty({ example: '2026-10-01' }) @IsDateOnly() tuNgay!: string;
  @ApiProperty({ example: '2026-10-31' }) @IsDateOnly() denNgay!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() khoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() loaiHangId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() hangHoaId?: string;
}

export class BaoCaoDoanhThuQueryDto {
  @ApiProperty({ example: '2026-10-01' }) @IsDateOnly() tuNgay!: string;
  @ApiProperty({ example: '2026-10-31' }) @IsDateOnly() denNgay!: string;

  @ApiPropertyOptional({ enum: DOANH_THU_GROUP, default: 'ngay' })
  @IsOptional()
  @IsEnum(DOANH_THU_GROUP)
  groupBy?: (typeof DOANH_THU_GROUP)[number];

  @ApiPropertyOptional() @IsOptional() @IsUUID() khachHangId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() hangHoaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() loaiHangId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() createdById?: string;
}

export class BaoCaoTopBanChayQueryDto {
  @ApiProperty({ example: '2026-10-01' }) @IsDateOnly() tuNgay!: string;
  @ApiProperty({ example: '2026-10-31' }) @IsDateOnly() denNgay!: string;

  @ApiPropertyOptional({
    enum: ['doanh-thu', 'so-luong'],
    default: 'doanh-thu',
  })
  @IsOptional()
  @IsEnum(['doanh-thu', 'so-luong'])
  tieuChi?: 'doanh-thu' | 'so-luong';

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional() @IsOptional() @IsUUID() loaiHangId?: string;
}

export class BaoCaoCongNoQueryDto {
  @ApiPropertyOptional({
    example: '2026-10-08',
    description: 'Mặc định hôm nay',
  })
  @IsOptional()
  @IsDateOnly()
  denNgay?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() khachHangId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() nhaCungCapId?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Bỏ đối tượng không còn nợ',
  })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  chiConNo?: boolean;
}

// ---- responses ------------------------------------------------------------

export class KyBaoCaoDto {
  @ApiProperty() tuNgay!: string;
  @ApiProperty() denNgay!: string;
}

export class TonKhoNhomDto {
  @ApiProperty() id!: string;
  @ApiProperty() ten!: string;
  @ApiProperty({ nullable: true, type: String }) ma!: string | null;
}

export class BaoCaoTonKhoItemDto {
  @ApiProperty({ type: TonKhoNhomDto }) nhom!: TonKhoNhomDto;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Chỉ khi nhóm theo hàng hóa',
  })
  donViCoBan!: string | null;
  @ApiProperty() tongTon!: number;
  @ApiProperty({ description: 'Lô chưa hết hạn' }) tonKhaDung!: number;
  @ApiProperty({ description: 'Một phần của tonKhaDung, sắp hết hạn' })
  tonCanDate!: number;
  @ApiProperty() tonHetHan!: number;
  @ApiProperty() soLo!: number;
  @ApiPropertyOptional({ example: '1000000.00' }) giaTriTon?: string;
  @ApiPropertyOptional({
    description: 'Có lô chưa có giá vốn nên chưa tính vào giá trị',
  })
  thieuGiaVon?: boolean;
}

export class BaoCaoTonKhoResponseDto {
  @ApiProperty({ type: [BaoCaoTonKhoItemDto] }) items!: BaoCaoTonKhoItemDto[];
  @ApiProperty() tong!: { tongTon: number; giaTriTon?: string };
  @ApiProperty() generatedAt!: Date;
}

export class BaoCaoTheoLoItemDto {
  @ApiProperty() soLo!: {
    id: string;
    tenLo: string;
    hanSuDung: string;
    trangThai: string;
    soNgayConLai: number;
  };
  @ApiProperty() hangHoa!: {
    id: string;
    maSP: string;
    tenSP: string;
    donViCoBan: string | null;
  };
  @ApiProperty() viTri!: {
    id: string;
    tenViTri: string;
    kho: { id: string; tenKho: string };
  };
  @ApiProperty() soLuong!: number;
  @ApiPropertyOptional({ nullable: true, type: String }) giaVonCoBan?:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) giaTri?: string | null;
}

export class BaoCaoHanDungTongDto {
  @ApiProperty() soLo!: number;
  @ApiProperty() tongSoLuong!: number;
  @ApiPropertyOptional() tongGiaTri?: string;
}

export class NhapXuatTonItemDto {
  @ApiProperty() hangHoa!: {
    id: string;
    maSP: string;
    tenSP: string;
    donViCoBan: string | null;
  };
  @ApiProperty() tonDau!: number;
  @ApiProperty() nhap!: number;
  @ApiProperty({ description: 'Số âm' }) xuat!: number;
  @ApiProperty({ description: 'Số âm' }) huyNhap!: number;
  @ApiProperty() huyXuat!: number;
  @ApiProperty() traHang!: number;
  @ApiProperty() dieuChinh!: number;
  @ApiProperty({ description: 'Chuyển vị trí: ra khỏi kho trừ, vào kho cộng' })
  chuyenRong!: number;
  @ApiProperty() tonCuoi!: number;
}

export class BaoCaoNhapXuatTonResponseDto {
  @ApiProperty({ type: [NhapXuatTonItemDto] }) items!: NhapXuatTonItemDto[];
  @ApiProperty() tong!: Omit<NhapXuatTonItemDto, 'hangHoa'>;
  @ApiProperty({ type: KyBaoCaoDto }) kyBaoCao!: KyBaoCaoDto;
  @ApiProperty() generatedAt!: Date;
}

export class DoanhThuItemDto {
  @ApiProperty() nhom!: { khoa: string; ten: string };
  @ApiProperty() soPhieu!: number;
  @ApiProperty() soLuongCoBan!: number;
  @ApiProperty({ example: '1000000.00' }) tienHang!: string;
  @ApiProperty({ example: '0.00' }) chietKhau!: string;
  @ApiProperty({
    example: '1000000.00',
    description: 'Tiền hàng − chiết khấu (chưa VAT)',
  })
  doanhThu!: string;
}

export class BaoCaoDoanhThuResponseDto {
  @ApiProperty({ type: [DoanhThuItemDto] }) items!: DoanhThuItemDto[];
  @ApiProperty() tong!: {
    soPhieu: number;
    soLuongCoBan: number;
    tienHang: string;
    chietKhau: string;
    tienThueGtgt: string;
    doanhThu: string;
    giaTriTraLai: string;
    doanhThuThuan: string;
  };
  @ApiProperty({ enum: DOANH_THU_GROUP }) groupBy!: string;
  @ApiProperty({ type: KyBaoCaoDto }) kyBaoCao!: KyBaoCaoDto;
  @ApiProperty() generatedAt!: Date;
}

export class TopBanChayItemDto {
  @ApiProperty() hang!: number;
  @ApiProperty() hangHoa!: {
    id: string;
    maSP: string;
    tenSP: string;
    donViCoBan: string | null;
  };
  @ApiProperty() soLuongCoBan!: number;
  @ApiProperty({ example: '1000000.00' }) doanhThu!: string;
  @ApiProperty() soPhieu!: number;
}

export class BaoCaoTopBanChayResponseDto {
  @ApiProperty({ type: [TopBanChayItemDto] }) items!: TopBanChayItemDto[];
  @ApiProperty({ type: KyBaoCaoDto }) kyBaoCao!: KyBaoCaoDto;
  @ApiProperty() generatedAt!: Date;
}

export class CongNoAgingDto {
  @ApiProperty({ example: '0.00' }) nhom0_30!: string;
  @ApiProperty({ example: '0.00' }) nhom31_60!: string;
  @ApiProperty({ example: '0.00' }) nhom61_90!: string;
  @ApiProperty({ example: '0.00' }) nhomTren90!: string;
  @ApiProperty({ example: '0.00' }) tongConNo!: string;
  @ApiProperty() soPhieuConNo!: number;
}

export class CongNoPhaiThuItemDto extends CongNoAgingDto {
  @ApiProperty() khachHang!: { id: string; maKH: string; tenKH: string };
}

export class CongNoPhaiTraItemDto extends CongNoAgingDto {
  @ApiProperty() nhaCungCap!: { id: string; maNCC: string; tenNCC: string };
}

export class BaoCaoCongNoPhaiThuResponseDto {
  @ApiProperty({ type: [CongNoPhaiThuItemDto] }) items!: CongNoPhaiThuItemDto[];
  @ApiProperty({ type: CongNoAgingDto }) tong!: CongNoAgingDto;
  @ApiProperty() denNgay!: string;
  @ApiProperty() generatedAt!: Date;
}

export class BaoCaoCongNoPhaiTraResponseDto {
  @ApiProperty({ type: [CongNoPhaiTraItemDto] }) items!: CongNoPhaiTraItemDto[];
  @ApiProperty({ type: CongNoAgingDto }) tong!: CongNoAgingDto;
  @ApiProperty() denNgay!: string;
  @ApiProperty() generatedAt!: Date;
}
