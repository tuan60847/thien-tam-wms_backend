import type { BienDongTonKho, Prisma } from '@prisma/client';
import { formatDateOnly } from '../common/clock/vn-date.js';
import { computeStatus, daysLeft } from '../so-lo/so-lo.rules.js';
import type {
  BienDongTonKhoResponseDto,
  TonKhoResponseDto,
} from './dto/ton-kho.dto.js';

export const tonKhoInclude = {
  soLo: {
    include: {
      hangHoa: {
        select: {
          id: true,
          maSP: true,
          tenSP: true,
          isCanGiuLanh: true,
          tyLeQuyDois: {
            where: { soLuongQuyDoi: 1 },
            select: { donViTinh: true },
          },
        },
      },
    },
  },
  viTri: { include: { kho: { select: { id: true, tenKho: true } } } },
} as const satisfies Prisma.TonKhoInclude;

export type TonKhoFull = Prisma.TonKhoGetPayload<{
  include: typeof tonKhoInclude;
}>;

export function toTonKhoResponse(
  row: TonKhoFull,
  today: Date,
  warningDays: number,
): TonKhoResponseDto {
  const { soLo, viTri } = row;
  return {
    id: row.id,
    soLuong: row.soLuong,
    donViCoBan: soLo.hangHoa.tyLeQuyDois[0]?.donViTinh ?? '',
    soLo: {
      id: soLo.id,
      tenLo: soLo.tenLo,
      hanSuDung: formatDateOnly(soLo.hanSuDung),
      trangThai: computeStatus(soLo.hanSuDung, today, warningDays),
      soNgayConLai: daysLeft(soLo.hanSuDung, today),
    },
    hangHoa: {
      id: soLo.hangHoa.id,
      maSP: soLo.hangHoa.maSP,
      tenSP: soLo.hangHoa.tenSP,
    },
    viTri: {
      id: viTri.id,
      tenViTri: viTri.tenViTri,
      isCapDong: viTri.isCapDong,
      kho: viTri.kho,
    },
    updatedAt: row.updatedAt,
  };
}

export const bienDongInclude = {
  soLo: { select: { id: true, tenLo: true } },
  viTri: { select: { id: true, tenViTri: true } },
  createdBy: { select: { id: true, maNV: true, hoTen: true } },
} as const satisfies Prisma.BienDongTonKhoInclude;

export type BienDongFull = BienDongTonKho & {
  soLo: { id: string; tenLo: string };
  viTri: { id: string; tenViTri: string };
  createdBy: { id: string; maNV: string; hoTen: string } | null;
};

export function toBienDongResponse(
  row: BienDongFull,
): BienDongTonKhoResponseDto {
  return {
    id: row.id,
    loai: row.loai,
    soLuongThayDoi: row.soLuongThayDoi,
    soLuongSau: row.soLuongSau,
    soLo: row.soLo,
    viTri: row.viTri,
    thamChieu:
      row.loaiThamChieu && row.thamChieuId
        ? { loai: row.loaiThamChieu, id: row.thamChieuId }
        : null,
    lyDo: row.lyDo,
    nguoiThucHien: row.createdBy,
    createdAt: row.createdAt,
  };
}
