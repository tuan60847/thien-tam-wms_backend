import type { KhachHang } from '@prisma/client';
import { formatDateOnly } from '../common/clock/vn-date.js';
import { toChungResponse } from '../common/doi-tac/doi-tac-chung.js';
import { computeLicenseStatus } from '../common/license-status.js';
import type { KhachHangResponseDto } from './dto/khach-hang.dto.js';

const dateOrNull = (value: Date | null) =>
  value ? formatDateOnly(value) : null;

export function toKhachHangResponse(
  row: KhachHang,
  today: Date,
): KhachHangResponseDto {
  return {
    ...toChungResponse(row),
    id: row.id,
    maKH: row.maKH,
    tenKH: row.tenKH,
    diaChi: row.diaChi,
    maSoThue: row.maSoThue,
    email: row.email,
    SDT: row.SDT,
    nguoiDaiDien: row.nguoiDaiDien,
    SDTNDD: row.SDTNDD,
    trangThai: row.trangThai,
    soGiayPhepKinhDoanh: row.soGiayPhepKinhDoanh,
    ngayCapGPKD: dateOrNull(row.ngayCapGPKD),
    ngayHetHanGPKD: dateOrNull(row.ngayHetHanGPKD),
    giayPhep: computeLicenseStatus(row.ngayHetHanGPKD, today),
    xungHo: row.xungHo,
    dienGiai: row.dienGiai,
    soHoChieu: row.soHoChieu,
    ngayCap: dateOrNull(row.ngayCap),
    noiCap: row.noiCap,
    lienHeHoTen: row.lienHeHoTen,
    lienHeChucDanh: row.lienHeChucDanh,
    lienHeDienThoai: row.lienHeDienThoai,
    lienHeEmail: row.lienHeEmail,
    lienHeDiaChi: row.lienHeDiaChi,
    daiDienTheoPhapLuat: row.daiDienTheoPhapLuat,
    hoaDonTenNguoiNhan: row.hoaDonTenNguoiNhan,
    hoaDonDienThoai: row.hoaDonDienThoai,
    hoaDonDiaChi: row.hoaDonDiaChi,
    hoaDonEmail: row.hoaDonEmail,
    nhanVienBanHangId: row.nhanVienBanHangId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
