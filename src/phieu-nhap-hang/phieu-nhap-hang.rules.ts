import type { TrangThaiPhieuNhap } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { AppException } from '../common/errors/app.exception.js';

export type TrangThaiThanhToan =
  'chua_thanh_toan' | 'thanh_toan_mot_phan' | 'da_thanh_toan';

const TRANSITIONS: Record<TrangThaiPhieuNhap, TrangThaiPhieuNhap[]> = {
  cho_xac_nhan: ['da_nhap_kho', 'da_huy'],
  da_nhap_kho: ['da_huy'],
  da_huy: [],
};

export function canTransition(
  from: TrangThaiPhieuNhap,
  to: TrangThaiPhieuNhap,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(
  from: TrangThaiPhieuNhap,
  to: TrangThaiPhieuNhap,
): void {
  if (!canTransition(from, to)) {
    throw new AppException('PHIEU_NHAP_INVALID_STATE');
  }
}

// Only a draft may be edited or deleted; confirmed / cancelled receipts are immutable.
export function assertEditable(trangThai: TrangThaiPhieuNhap): void {
  if (trangThai !== 'cho_xac_nhan') {
    throw new AppException('PHIEU_NHAP_INVALID_STATE');
  }
}

// Payment status is only meaningful once the goods are received.
export function paymentStatus(
  trangThai: TrangThaiPhieuNhap,
  tongTien: Prisma.Decimal,
  daThanhToan: Prisma.Decimal,
): TrangThaiThanhToan | null {
  if (trangThai !== 'da_nhap_kho') {
    return null;
  }
  if (daThanhToan.gte(tongTien)) {
    return 'da_thanh_toan';
  }
  return daThanhToan.gt(0) ? 'thanh_toan_mot_phan' : 'chua_thanh_toan';
}
