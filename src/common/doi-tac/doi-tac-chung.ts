import type { LoaiChuThe, Prisma } from '@prisma/client';
import { moneyString } from '../money.js';
import type {
  DoiTacChungDto,
  DoiTacChungResponseDto,
} from './doi-tac-chung.dto.js';

interface ChungRow {
  loaiChuThe: LoaiChuThe;
  soCCCD: string | null;
  dtCoDinh: string | null;
  fax: string | null;
  website: string | null;
  soNgayDuocNo: number | null;
  soNoToiDa: Prisma.Decimal;
  quocGia: string;
  tinhTp: string | null;
  quanHuyen: string | null;
  xaPhuong: string | null;
  nhomDoiTacId: string | null;
  dieuKhoanThanhToanId: string | null;
}

// Plain-object view of the DTO class, so results can be spread safely.
type Plain<T> = { [K in keyof T]: T[K] };

export const toChungResponse = (
  row: ChungRow,
): Plain<DoiTacChungResponseDto> => ({
  loaiChuThe: row.loaiChuThe,
  soCCCD: row.soCCCD,
  dtCoDinh: row.dtCoDinh,
  fax: row.fax,
  website: row.website,
  soNgayDuocNo: row.soNgayDuocNo,
  soNoToiDa: moneyString(row.soNoToiDa),
  quocGia: row.quocGia,
  tinhTp: row.tinhTp,
  quanHuyen: row.quanHuyen,
  xaPhuong: row.xaPhuong,
  nhomDoiTacId: row.nhomDoiTacId,
  dieuKhoanThanhToanId: row.dieuKhoanThanhToanId,
});

// Prisma data for the shared fields. `undefined` keeps the stored value (update);
// create passes the same object and the column defaults apply.
export const chungData = (dto: DoiTacChungDto) => ({
  loaiChuThe: dto.loaiChuThe,
  soCCCD: dto.soCCCD,
  dtCoDinh: dto.dtCoDinh,
  fax: dto.fax,
  website: dto.website,
  soNgayDuocNo: dto.soNgayDuocNo,
  soNoToiDa: dto.soNoToiDa,
  quocGia: dto.quocGia,
  tinhTp: dto.tinhTp,
  quanHuyen: dto.quanHuyen,
  xaPhuong: dto.xaPhuong,
  nhomDoiTacId: dto.nhomDoiTacId,
  dieuKhoanThanhToanId: dto.dieuKhoanThanhToanId,
});
