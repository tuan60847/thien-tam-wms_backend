import type { Prisma } from '@prisma/client';
import { formatDateOnly } from '../common/clock/vn-date.js';
import { lineAmount, moneyString, ZERO } from '../common/money.js';
import { computeStatus } from '../so-lo/so-lo.rules.js';
import { computeDebt, debtSelect } from './phieu-xuat-hang.debt.js';
import type {
  ChiTietXuatResponseDto,
  PhieuXuatListItemDto,
  PhieuXuatResponseDto,
} from './dto/phieu-xuat.dto.js';
import { receivableStatus } from './phieu-xuat-hang.rules.js';

const userSelect = { select: { id: true, maNV: true, hoTen: true } } as const;
const userSelectKd = {
  select: { id: true, maNV: true, hoTen: true },
} as const;
const khachSelect = { select: { id: true, maKH: true, tenKH: true } } as const;

export const phieuXuatListInclude = {
  khachHang: khachSelect,
  createdBy: userSelect,
  ...debtSelect,
} as const satisfies Prisma.PhieuXuatHangInclude;

export const phieuXuatDetailInclude = {
  khachHang: khachSelect,
  createdBy: userSelect,
  xuatKhoBoi: userSelect,
  huyBoi: userSelect,
  nhanVienBanHang: userSelectKd,
  dieuKhoanThanhToan: {
    select: { id: true, ma: true, ten: true, soNgayDuocNo: true },
  },
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
  doiTrus: {
    orderBy: { createdAt: 'asc' },
    include: {
      phieuThuCongNo: {
        select: {
          id: true,
          maPhieuThuCongNo: true,
          ngayThanhToan: true,
          huyAt: true,
        },
      },
    },
  },
  traLaiHangBans: {
    where: { trangThai: 'da_nhap_kho' },
    select: {
      chiTiets: {
        select: { soLuong: true, donGia: true, tienChietKhau: true },
      },
    },
  },
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
  const debt = computeDebt(row);
  const issued = row.trangThai === 'da_xuat_kho' || row.trangThai === 'da_giao';
  return {
    id: row.id,
    maPhieuXuatHang: row.maPhieuXuatHang,
    khachHang: row.khachHang,
    trangThai: row.trangThai,
    ngayGiaoHang: dateOrNull(row.ngayGiaoHang),
    ngayXuatKho: dateOrNull(row.ngayXuatKho),
    soDong: row.chiTietPhieuXuatHangs.length,
    tongTien: moneyString(debt.tongTien),
    tongTienHang: moneyString(debt.tongTienHang),
    tienChietKhau: moneyString(debt.tienChietKhau),
    tienThueGtgt: moneyString(debt.tienThueGtgt),
    daThu: moneyString(debt.daThu),
    giaTriTraLai: moneyString(debt.giaTriTraLai),
    conNo: moneyString(issued ? debt.conNo : ZERO),
    trangThaiThu: receivableStatus(
      row.trangThai,
      debt.tongTien,
      debt.daThu.plus(debt.giaTriTraLai),
    ),
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
      laHangKhuyenMai: line.laHangKhuyenMai,
      tyLeChietKhau: moneyString(line.tyLeChietKhau),
      tienChietKhau: moneyString(line.tienChietKhau),
      thueSuatGtgt: moneyString(line.thueSuatGtgt),
      tienThueGtgt: moneyString(line.tienThueGtgt),
      canhBao: outOfFefo.has(line.id) ? ['KHONG_THEO_FEFO'] : [],
    }),
  );
  return Object.assign(toListItem(row), {
    diaChiGiaoHang: row.diaChiGiaoHang,
    ghiChu: row.ghiChu,
    phuongTienVanChuyen: row.phuongTienVanChuyen,
    ngayGiaoThucTe: dateOrNull(row.ngayGiaoThucTe),
    hinhThucThanhToan: row.hinhThucThanhToan,
    phuongThucThu: row.phuongThucThu,
    tinhTrangNo: row.tinhTrangNo,
    soNgayDuocNo: row.soNgayDuocNo,
    hanThanhToan: dateOrNull(row.hanThanhToan),
    thamChieu: row.thamChieu,
    lapKemHoaDon: row.lapKemHoaDon,
    daLapHoaDon: row.daLapHoaDon,
    dieuKhoanKhac: row.dieuKhoanKhac,
    tenMatHangChung: row.tenMatHangChung,
    nguoiLienHe: row.nguoiLienHe,
    khachSnapshot: {
      ten: row.khachTenSnapshot,
      maSoThue: row.khachMaSoThueSnapshot,
      diaChi: row.khachDiaChiSnapshot,
    },
    nhanVienBanHang: row.nhanVienBanHang,
    dieuKhoanThanhToan: row.dieuKhoanThanhToan,
    baoGiaId: row.baoGiaId,
    xuatKhoBoi: row.xuatKhoBoi,
    huyAt: row.huyAt,
    huyBoi: row.huyBoi,
    lyDoHuy: row.lyDoHuy,
    chiTiet,
    // One entry per application of a receipt to this order.
    thuTien: row.doiTrus.map((d) => ({
      id: d.phieuThuCongNo.id,
      maPhieuThuCongNo: d.phieuThuCongNo.maPhieuThuCongNo,
      soTien: moneyString(d.soTienDoiTru),
      ngayThanhToan: formatDateOnly(d.phieuThuCongNo.ngayThanhToan),
      daHuy: d.daBoDoiTru || d.phieuThuCongNo.huyAt !== null,
    })),
    updatedAt: row.updatedAt,
  });
}
