import type { Prisma } from '@prisma/client';
import type {
  HangHoaListItemDto,
  HangHoaResponseDto,
} from './dto/hang-hoa-response.dto.js';
import { canSeeCost } from './hang-hoa.rules.js';

export type HangHoaFull = Prisma.HangHoaGetPayload<{
  include: { loaiHang: true; tyLeQuyDois: true };
}>;

export const hangHoaInclude = {
  loaiHang: true,
  tyLeQuyDois: { orderBy: { soLuongQuyDoi: 'asc' } },
} as const satisfies Prisma.HangHoaInclude;

const money = (value: Prisma.Decimal) => value.toFixed(2);

// Plain-object view of a DTO class, so results can be spread safely.
type Plain<T> = { [K in keyof T]: T[K] };

export function toHangHoaListItem(
  row: HangHoaFull,
  viewerRole: string | null | undefined,
): Plain<HangHoaListItemDto> {
  const base = row.tyLeQuyDois.find((u) => u.soLuongQuyDoi === 1);
  const item: Plain<HangHoaListItemDto> = {
    id: row.id,
    maSP: row.maSP,
    tenSP: row.tenSP,
    quyCach: row.quyCach,
    loaiHang: { id: row.loaiHang.id, tenLoaiHang: row.loaiHang.tenLoaiHang },
    donViCoBan: base?.donViTinh ?? row.donViTinhGia,
    donViTinhGia: row.donViTinhGia,
    giaHienThi: money(row.giaHienThi),
    isKeDon: row.isKeDon,
    isCanGiuLanh: row.isCanGiuLanh,
    loaiKiemSoat: row.loaiKiemSoat,
    trangThai: row.trangThai,
  };
  // Omitted (not null) so the keys do not reveal that a cost exists.
  if (canSeeCost(viewerRole)) {
    item.giaNhap = money(row.giaNhap);
    item.giaToiThieu = money(row.giaToiThieu);
  }
  return item;
}

export function toHangHoaResponse(
  row: HangHoaFull,
  viewerRole: string | null | undefined,
): HangHoaResponseDto {
  return {
    ...toHangHoaListItem(row, viewerRole),
    soDangKy: row.soDangKy,
    ghiChu: row.ghiChu,
    tyLeQuyDoi: row.tyLeQuyDois.map((u) => ({
      id: u.id,
      donViTinh: u.donViTinh,
      soLuongQuyDoi: u.soLuongQuyDoi,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
