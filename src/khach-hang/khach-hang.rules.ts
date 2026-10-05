import type { TrangThaiKhachHang } from '@prisma/client';
import { AppException } from '../common/errors/app.exception.js';
import { isLicenseExpired } from '../common/license-status.js';

// A customer may buy only while active AND with a business licence valid today.
// A missing expiry date counts as "not declared", i.e. not allowed (Q-KH-2).
export function assertCanBuy(
  khachHang: { trangThai: TrangThaiKhachHang; ngayHetHanGPKD: Date | null },
  today: Date,
): void {
  if (khachHang.trangThai !== 'hoat_dong') {
    throw new AppException('KHACH_HANG_INACTIVE');
  }
  if (isLicenseExpired(khachHang.ngayHetHanGPKD, today)) {
    throw new AppException('KHACH_HANG_LICENSE_EXPIRED');
  }
}

// ngayHetHanGPKD must not precede ngayCapGPKD.
export function assertLicenseDates(
  ngayCap: Date | null | undefined,
  ngayHetHan: Date | null | undefined,
): void {
  if (ngayCap && ngayHetHan && ngayHetHan.getTime() < ngayCap.getTime()) {
    throw new AppException('VALIDATION_FAILED', {
      details: [
        {
          field: 'ngayHetHanGPKD',
          messages: ['Ngày hết hạn không được trước ngày cấp'],
        },
      ],
    });
  }
}
