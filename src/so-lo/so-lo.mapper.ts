import type { SoLo } from '@prisma/client';
import { formatDateOnly } from '../common/clock/vn-date.js';
import type { SoLoResponseDto } from './dto/so-lo.dto.js';
import { computeStatus, daysLeft } from './so-lo.rules.js';

export type SoLoWithHang = SoLo & {
  hangHoa: { id: string; maSP: string; tenSP: string };
};

export const soLoInclude = {
  hangHoa: { select: { id: true, maSP: true, tenSP: true } },
} as const;

export function toSoLoResponse(
  row: SoLoWithHang,
  today: Date,
  warningDays: number,
): SoLoResponseDto {
  return {
    id: row.id,
    tenLo: row.tenLo,
    ngaySX: row.ngaySX ? formatDateOnly(row.ngaySX) : null,
    hanSuDung: formatDateOnly(row.hanSuDung),
    trangThai: computeStatus(row.hanSuDung, today, warningDays),
    soNgayConLai: daysLeft(row.hanSuDung, today),
    hangHoa: row.hangHoa,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
