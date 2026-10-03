import type { LoaiHang } from '@prisma/client';
import type { LoaiHangResponseDto } from './dto/loai-hang-response.dto.js';

export type LoaiHangWithCount = LoaiHang & { _count: { hangHoas: number } };

export function toLoaiHangResponse(
  row: LoaiHangWithCount,
): LoaiHangResponseDto {
  return {
    id: row.id,
    tenLoaiHang: row.tenLoaiHang,
    ghiChu: row.ghiChu,
    trangThai: row.trangThai,
    soHangHoa: row._count.hangHoas,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
