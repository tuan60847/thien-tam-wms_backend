import type { Kho, ViTri } from '@prisma/client';
import type { KhoResponseDto } from './dto/kho.dto.js';
import type { ViTriResponseDto } from './dto/vi-tri.dto.js';

export type KhoWithCount = Kho & { _count: { viTris: number } };
export type ViTriWithKho = ViTri & { kho: { id: string; tenKho: string } };

export function toKhoResponse(
  row: KhoWithCount,
  coTon: boolean,
): KhoResponseDto {
  return {
    id: row.id,
    tenKho: row.tenKho,
    diaChi: row.diaChi,
    trangThai: row.trangThai,
    soViTri: row._count.viTris,
    coTon,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toViTriResponse(
  row: ViTriWithKho,
  coTon: boolean,
): ViTriResponseDto {
  return {
    id: row.id,
    tenViTri: row.tenViTri,
    isCapDong: row.isCapDong,
    ghiChu: row.ghiChu,
    trangThai: row.trangThai,
    kho: { id: row.kho.id, tenKho: row.kho.tenKho },
    coTon,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
