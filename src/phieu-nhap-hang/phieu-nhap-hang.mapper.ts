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
  ChiTietNhapResponseDto,
  PhieuNhapListItemDto,
  PhieuNhapResponseDto,
} from './dto/phieu-nhap.dto.js';
import { paymentStatus } from './phieu-nhap-hang.rules.js';

const userSelect = { select: { id: true, maNV: true, hoTen: true } } as const;

export const phieuNhapListInclude = {
  nhaCungCap: { select: { id: true, maNCC: true, tenNCC: true } },
  createdBy: userSelect,
  chiTietPhieuNhapHangs: { select: { soLuong: true, donGia: true } },
  phieuThanhToans: { select: { soTien: true, huyAt: true } },
} as const satisfies Prisma.PhieuNhapHangInclude;

export const phieuNhapDetailInclude = {
  nhaCungCap: { select: { id: true, maNCC: true, tenNCC: true } },
  createdBy: userSelect,
  xacNhanBoi: userSelect,
  huyBoi: userSelect,
  phuongTienVanChuyen: {
    select: { id: true, bienSo: true, isXeLanh: true },
  },
  chiTietPhieuNhapHangs: {
    orderBy: { maChiTietPhieuNhapHang: 'asc' },
    include: {
      soLo: {
        include: {
          hangHoa: { select: { id: true, maSP: true, tenSP: true } },
        },
      },
      viTri: { include: { kho: { select: { id: true, tenKho: true } } } },
    },
  },
  phieuThanhToans: { orderBy: { createdAt: 'asc' } },
} as const satisfies Prisma.PhieuNhapHangInclude;

export type PhieuNhapListRow = Prisma.PhieuNhapHangGetPayload<{
  include: typeof phieuNhapListInclude;
}>;
export type PhieuNhapDetailRow = Prisma.PhieuNhapHangGetPayload<{
  include: typeof phieuNhapDetailInclude;
}>;

interface Totals {
  tongTien: Prisma.Decimal;
  daThanhToan: Prisma.Decimal;
}

function totalsOf(row: {
  chiTietPhieuNhapHangs: { soLuong: number; donGia: Prisma.Decimal }[];
  phieuThanhToans: { soTien: Prisma.Decimal; huyAt: Date | null }[];
}): Totals {
  return {
    tongTien: computeTotals(row.chiTietPhieuNhapHangs),
    daThanhToan: sumMoney(
      row.phieuThanhToans.filter((t) => !t.huyAt).map((t) => t.soTien),
    ),
  };
}

function toListItem(
  row: PhieuNhapListRow | PhieuNhapDetailRow,
): PhieuNhapListItemDto {
  const { tongTien, daThanhToan } = totalsOf(row);
  const received = row.trangThai === 'da_nhap_kho';
  return {
    id: row.id,
    maPhieuNhapHang: row.maPhieuNhapHang,
    nhaCungCap: row.nhaCungCap,
    trangThai: row.trangThai,
    ngayNhanHang: row.ngayNhanHang ? formatDateOnly(row.ngayNhanHang) : null,
    soDong: row.chiTietPhieuNhapHangs.length,
    tongTien: moneyString(tongTien),
    daThanhToan: moneyString(daThanhToan),
    conNo: moneyString(received ? tongTien.minus(daThanhToan) : ZERO),
    trangThaiThanhToan: paymentStatus(row.trangThai, tongTien, daThanhToan),
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

export const toPhieuNhapListItem = (
  row: PhieuNhapListRow,
): PhieuNhapListItemDto => toListItem(row);

export function toPhieuNhapResponse(
  row: PhieuNhapDetailRow,
  today: Date,
  warningDays: number,
): PhieuNhapResponseDto {
  const chiTiet: ChiTietNhapResponseDto[] = row.chiTietPhieuNhapHangs.map(
    (line) => ({
      id: line.id,
      maChiTietPhieuNhapHang: line.maChiTietPhieuNhapHang,
      soLo: {
        id: line.soLo.id,
        tenLo: line.soLo.tenLo,
        ngaySX: line.soLo.ngaySX ? formatDateOnly(line.soLo.ngaySX) : null,
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
    }),
  );
  return Object.assign(toListItem(row), {
    phuongTienVanChuyen: row.phuongTienVanChuyen,
    ghiChu: row.ghiChu,
    xacNhanAt: row.xacNhanAt,
    xacNhanBoi: row.xacNhanBoi,
    huyAt: row.huyAt,
    huyBoi: row.huyBoi,
    lyDoHuy: row.lyDoHuy,
    chiTiet,
    thanhToan: row.phieuThanhToans.map((t) => ({
      id: t.id,
      maPhieuThanhToan: t.maPhieuThanhToan,
      soTien: moneyString(t.soTien),
      ngayThanhToan: formatDateOnly(t.ngayThanhToan),
      daHuy: t.huyAt !== null,
    })),
    updatedAt: row.updatedAt,
  });
}
