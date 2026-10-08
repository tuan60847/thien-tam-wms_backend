import type { NhaCungCap, Prisma } from '@prisma/client';
import { formatDateOnly } from '../common/clock/vn-date.js';
import { toChungResponse } from '../common/doi-tac/doi-tac-chung.js';
import { computeLicenseStatus } from '../common/license-status.js';
import type { NhaCungCapResponseDto } from './dto/nha-cung-cap.dto.js';

export type NhaCungCapFull = NhaCungCap & {
  xacMinhBoi: { id: string; maNV: string; hoTen: string } | null;
};

export const nhaCungCapInclude = {
  xacMinhBoi: { select: { id: true, maNV: true, hoTen: true } },
} as const satisfies Prisma.NhaCungCapInclude;

const dateOrNull = (value: Date | null) =>
  value ? formatDateOnly(value) : null;

export function toNhaCungCapResponse(
  row: NhaCungCapFull,
  today: Date,
): NhaCungCapResponseDto {
  return {
    ...toChungResponse(row),
    id: row.id,
    maNCC: row.maNCC,
    tenNCC: row.tenNCC,
    SDT: row.SDT,
    diaChi: row.diaChi,
    tenNguoiPhuTrach: row.tenNguoiPhuTrach,
    sdtNguoiPT: row.sdtNguoiPT,
    ghiChu: row.ghiChu,
    trangThai: row.trangThai,
    trangThaiXacMinh: row.trangThaiXacMinh,
    xacMinhAt: row.xacMinhAt,
    xacMinhBoi: row.xacMinhBoi,
    giayPhep: {
      gpkd: computeLicenseStatus(row.ngayHetHanGPKD, today),
      gcn: computeLicenseStatus(row.ngayHetHanGCNDuoc, today),
    },
    soGiayPhepKinhDoanh: row.soGiayPhepKinhDoanh,
    ngayCapGPKD: dateOrNull(row.ngayCapGPKD),
    noiCapGPKD: row.noiCapGPKD,
    ngayHetHanGPKD: dateOrNull(row.ngayHetHanGPKD),
    soGCNDuDieuKienKinhDoanhDuoc: row.soGCNDuDieuKienKinhDoanhDuoc,
    ngayCapGCNDuoc: dateOrNull(row.ngayCapGCNDuoc),
    noiCapGCNDuoc: row.noiCapGCNDuoc,
    ngayHetHanGCNDuoc: dateOrNull(row.ngayHetHanGCNDuoc),
    maSoThue: row.maSoThue,
    email: row.email,
    nhanVienMuaHangId: row.nhanVienMuaHangId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
