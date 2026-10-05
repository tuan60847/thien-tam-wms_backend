import type { KhachHang } from '@prisma/client';
import { formatDateOnly } from '../common/clock/vn-date.js';
import { computeLicenseStatus } from '../common/license-status.js';
import type { KhachHangResponseDto } from './dto/khach-hang.dto.js';

const dateOrNull = (value: Date | null) =>
  value ? formatDateOnly(value) : null;

export function toKhachHangResponse(
  row: KhachHang,
  today: Date,
): KhachHangResponseDto {
  return {
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
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
