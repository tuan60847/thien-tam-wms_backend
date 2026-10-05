import type { NhaCungCap } from '@prisma/client';
import { AppException } from '../common/errors/app.exception.js';
import { isLicenseExpired } from '../common/license-status.js';

type License = Pick<
  NhaCungCap,
  | 'soGiayPhepKinhDoanh'
  | 'ngayCapGPKD'
  | 'noiCapGPKD'
  | 'ngayHetHanGPKD'
  | 'soGCNDuDieuKienKinhDoanhDuoc'
  | 'ngayCapGCNDuoc'
  | 'noiCapGCNDuoc'
  | 'ngayHetHanGCNDuoc'
>;

export const LICENSE_FIELDS = [
  'soGiayPhepKinhDoanh',
  'ngayCapGPKD',
  'noiCapGPKD',
  'ngayHetHanGPKD',
  'soGCNDuDieuKienKinhDoanhDuoc',
  'ngayCapGCNDuoc',
  'noiCapGCNDuoc',
  'ngayHetHanGCNDuoc',
] as const satisfies readonly (keyof License)[];

// What must be on file before a supplier can be verified.
const REQUIRED_FOR_VERIFICATION = [
  'soGiayPhepKinhDoanh',
  'ngayCapGPKD',
  'ngayHetHanGPKD',
  'soGCNDuDieuKienKinhDoanhDuoc',
  'ngayCapGCNDuoc',
  'ngayHetHanGCNDuoc',
] as const satisfies readonly (keyof License)[];

const same = (a: unknown, b: unknown): boolean =>
  a instanceof Date && b instanceof Date
    ? a.getTime() === b.getTime()
    : a === b;

// True when `next` really changes any licence field (undefined = not sent = unchanged).
export function licenseChanged(
  current: License,
  next: Partial<Record<keyof License, string | Date | null | undefined>>,
): boolean {
  return LICENSE_FIELDS.some(
    (field) => next[field] !== undefined && !same(current[field], next[field]),
  );
}

// Both licences must be on file and valid today.
export function assertVerifiable(ncc: License, today: Date): void {
  const missing = REQUIRED_FOR_VERIFICATION.filter((f) => {
    const value = ncc[f];
    return value === null || value === undefined || value === '';
  });
  if (missing.length > 0) {
    throw new AppException('NHA_CUNG_CAP_LICENSE_INCOMPLETE', {
      details: { thieu: missing },
    });
  }
  assertLicensesValid(ncc, today);
}

export function assertLicensesValid(ncc: License, today: Date): void {
  if (
    isLicenseExpired(ncc.ngayHetHanGPKD, today) ||
    isLicenseExpired(ncc.ngayHetHanGCNDuoc, today)
  ) {
    throw new AppException('NHA_CUNG_CAP_LICENSE_EXPIRED');
  }
}

// A supplier may deliver only while active, verified and with both licences valid today.
export function assertCanSupply(
  ncc: License & Pick<NhaCungCap, 'trangThai' | 'trangThaiXacMinh'>,
  today: Date,
): void {
  if (!ncc.trangThai) {
    throw new AppException('NHA_CUNG_CAP_INACTIVE');
  }
  if (ncc.trangThaiXacMinh !== 'da_xac_minh') {
    throw new AppException('NHA_CUNG_CAP_NOT_VERIFIED');
  }
  assertLicensesValid(ncc, today);
}

export function assertDateOrder(
  ngayCap: Date | null | undefined,
  ngayHetHan: Date | null | undefined,
  field: string,
): void {
  if (ngayCap && ngayHetHan && ngayHetHan.getTime() < ngayCap.getTime()) {
    throw new AppException('VALIDATION_FAILED', {
      details: [
        { field, messages: ['Ngày hết hạn không được trước ngày cấp'] },
      ],
    });
  }
}
