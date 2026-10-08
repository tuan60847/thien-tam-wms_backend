import type { Prisma } from '@prisma/client';
import { formatDateOnly } from '../common/clock/vn-date.js';
import { moneyString } from '../common/money.js';
import type {
  ChiTietTraLaiResponseDto,
  TraLaiListItemDto,
  TraLaiResponseDto,
} from './dto/tra-lai.dto.js';
import { lineValue, totalValue } from './tra-lai-hang-ban.rules.js';

export const traLaiListInclude = {
  khachHang: { select: { id: true, maKH: true, tenKH: true } },
  phieuXuatHang: { select: { id: true, maPhieuXuatHang: true } },
  chiTiets: {
    select: { soLuong: true, donGia: true, tienChietKhau: true },
  },
} as const satisfies Prisma.TraLaiHangBanInclude;

export const traLaiDetailInclude = {
  khachHang: { select: { id: true, maKH: true, tenKH: true } },
  phieuXuatHang: { select: { id: true, maPhieuXuatHang: true } },
  chiTiets: {
    orderBy: { maChiTiet: 'asc' },
    include: {
      soLo: {
        include: {
          hangHoa: { select: { id: true, maSP: true, tenSP: true } },
        },
      },
      viTri: { include: { kho: { select: { id: true, tenKho: true } } } },
    },
  },
} as const satisfies Prisma.TraLaiHangBanInclude;

export type TraLaiListRow = Prisma.TraLaiHangBanGetPayload<{
  include: typeof traLaiListInclude;
}>;
export type TraLaiDetailRow = Prisma.TraLaiHangBanGetPayload<{
  include: typeof traLaiDetailInclude;
}>;

function toListItem(row: TraLaiListRow | TraLaiDetailRow): TraLaiListItemDto {
  return {
    id: row.id,
    maTraLai: row.maTraLai,
    trangThai: row.trangThai,
    ngayTraLai: formatDateOnly(row.ngayTraLai),
    khachHang: row.khachHang,
    phieuXuat: row.phieuXuatHang,
    soDong: row.chiTiets.length,
    giaTri: moneyString(totalValue(row.chiTiets)),
    createdAt: row.createdAt,
  };
}

export const toTraLaiListItem = (row: TraLaiListRow): TraLaiListItemDto =>
  toListItem(row);

export function toTraLaiResponse(row: TraLaiDetailRow): TraLaiResponseDto {
  const chiTiet: ChiTietTraLaiResponseDto[] = row.chiTiets.map((line) => ({
    id: line.id,
    maChiTiet: line.maChiTiet,
    chiTietPhieuXuatHangId: line.chiTietPhieuXuatHangId,
    soLo: {
      id: line.soLo.id,
      tenLo: line.soLo.tenLo,
      hanSuDung: formatDateOnly(line.soLo.hanSuDung),
      hangHoa: line.soLo.hangHoa,
    },
    viTri: {
      id: line.viTri.id,
      tenViTri: line.viTri.tenViTri,
      kho: line.viTri.kho,
    },
    donViTinh: line.donViTinh,
    heSoQuyDoi: line.heSoQuyDoi,
    soLuong: line.soLuong,
    soLuongCoBan: line.soLuongCoBan,
    donGia: moneyString(line.donGia),
    tyLeChietKhau: moneyString(line.tyLeChietKhau),
    tienChietKhau: moneyString(line.tienChietKhau),
    thanhTien: moneyString(lineValue(line)),
  }));
  return Object.assign(toListItem(row), {
    lyDo: row.lyDo,
    ghiChu: row.ghiChu,
    xacNhanAt: row.xacNhanAt,
    huyAt: row.huyAt,
    lyDoHuy: row.lyDoHuy,
    chiTiet,
    updatedAt: row.updatedAt,
  });
}
