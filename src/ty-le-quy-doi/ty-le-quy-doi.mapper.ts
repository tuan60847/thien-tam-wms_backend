import type { TyLeQuyDoi } from '@prisma/client';
import type { TyLeQuyDoiResponseDto } from './dto/ty-le-quy-doi-response.dto.js';

export function toTyLeQuyDoiResponse(
  unit: TyLeQuyDoi,
  donViTinhGia: string,
): TyLeQuyDoiResponseDto {
  return {
    id: unit.id,
    hangHoaId: unit.hangHoaId,
    donViTinh: unit.donViTinh,
    soLuongQuyDoi: unit.soLuongQuyDoi,
    laDonViCoBan: unit.soLuongQuyDoi === 1,
    laDonViTinhGia: unit.donViTinh.toLowerCase() === donViTinhGia.toLowerCase(),
  };
}
