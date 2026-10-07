import type { Prisma } from '@prisma/client';
import { formatDateOnly } from '../common/clock/vn-date.js';
import {
  computeTotals,
  lineAmount,
  moneyString,
  sumMoney,
  ZERO,
} from '../common/money.js';
import { computeStatus } from '../so-lo/so-lo.rules.js';
import type {
  ChiTietXuatResponseDto,
  PhieuXuatListItemDto,
  PhieuXuatResponseDto,
} from './dto/phieu-xuat.dto.js';
import { receivableStatus } from './phieu-xuat-hang.rules.js';

const userSelect = { select: { id: true, maNV: true, hoTen: true } } as const;
const khachSelect = { select: { id: true, maKH: true, tenKH: true } } as const;

export const phieuXuatListInclude = {
  khachHang: khachSelect,
  createdBy: userSelect,
  chiTietPhieuXuatHangs: { select: { soLuong: true, donGia: true } },
  phieuThuCongNos: { select: { soTien: true, huyAt: true } },
} as const satisfies Prisma.PhieuXuatHangInclude;

export const phieuXuatDetailInclude = {
  khachHang: khachSelect,
  createdBy: userSelect,
  xuatKhoBoi: userSelect,
  huyBoi: userSelect,
  phuongTienVanChuyen: {
    select: { id: true, bienSo: true, isXeLanh: true },
  },
  chiTietPhieuXuatHangs: {
    orderBy: { maChiTietPhieuXuatHang: 'asc' },
    include: {
      soLo: {
        include: {
          hangHoa: { select: { id: true, maSP: true, tenSP: true } },
        },
      },
      viTri: { include: { kho: { select: { id: true, tenKho: true } } } },
    },
  },
  phieuThuCongNos: { orderBy: { createdAt: 'asc' } },
} as const satisfies Prisma.PhieuXuatHangInclude;

export type PhieuXuatListRow = Prisma.PhieuXuatHangGetPayload<{
  include: typeof phieuXuatListInclude;
}>;
export type PhieuXuatDetailRow = Prisma.PhieuXuatHangGetPayload<{
  include: typeof phieuXuatDetailInclude;
}>;

const dateOrNull = (value: Date | null) =>
  value ? formatDateOnly(value) : null;

function toListItem(
  row: PhieuXuatListRow | PhieuXuatDetailRow,
): PhieuXuatListItemDto {
  const tongTien = computeTotals(row.chiTietPhieuXuatHangs);
  const daThu = sumMoney(
    row.phieuThuCongNos.filter((t) => !t.huyAt).map((t) => t.soTien),
  );
  const issued = row.trangThai === 'da_xuat_kho' || row.trangThai === 'da_giao';
  return {
    id: row.id,
    maPhieuXuatHang: row.maPhieuXuatHang,
    khachHang: row.khachHang,
    trangThai: row.trangThai,
    ngayGiaoHang: dateOrNull(row.ngayGiaoHang),
    ngayXuatKho: dateOrNull(row.ngayXuatKho),
    soDong: row.chiTietPhieuXuatHangs.length,
    tongTien: moneyString(tongTien),
    daThu: moneyString(daThu),
    conNo: moneyString(issued ? tongTien.minus(daThu) : ZERO),
    trangThaiThu: receivableStatus(row.trangThai, tongTien, daThu),
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

export const toPhieuXuatListItem = (
  row: PhieuXuatListRow,
): PhieuXuatListItemDto => toListItem(row);

// `outOfFefo` holds the ids of lines that break FEFO (computed by the service).
export function toPhieuXuatResponse(
  row: PhieuXuatDetailRow,
  today: Date,
  warningDays: number,
  outOfFefo: Set<string>,
): PhieuXuatResponseDto {
  const chiTiet: ChiTietXuatResponseDto[] = row.chiTietPhieuXuatHangs.map(
    (line) => ({
      id: line.id,
      maChiTietPhieuXuatHang: line.maChiTietPhieuXuatHang,
      soLo: {
        id: line.soLo.id,
        tenLo: line.soLo.tenLo,
        hanSuDung: formatDateOnly(line.soLo.hanSuDung),
        trangThai: computeStatus(line.soLo.hanSuDung, today, warningDays),
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
      thanhTien: moneyString(lineAmount(line)),
      canhBao: outOfFefo.has(line.id) ? ['KHONG_THEO_FEFO'] : [],
    }),
  );
  return Object.assign(toListItem(row), {
    diaChiGiaoHang: row.diaChiGiaoHang,
    ghiChu: row.ghiChu,
    phuongTienVanChuyen: row.phuongTienVanChuyen,
    ngayGiaoThucTe: dateOrNull(row.ngayGiaoThucTe),
    xuatKhoBoi: row.xuatKhoBoi,
    huyAt: row.huyAt,
    huyBoi: row.huyBoi,
    lyDoHuy: row.lyDoHuy,
    chiTiet,
    thuTien: row.phieuThuCongNos.map((t) => ({
      id: t.id,
      maPhieuThuCongNo: t.maPhieuThuCongNo,
      soTien: moneyString(t.soTien),
      ngayThanhToan: formatDateOnly(t.ngayThanhToan),
      daHuy: t.huyAt !== null,
    })),
    updatedAt: row.updatedAt,
  });
}
