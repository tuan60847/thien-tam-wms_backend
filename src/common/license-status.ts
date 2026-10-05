import { diffDays } from './clock/vn-date.js';

export type LicenseStatus =
  'con_han' | 'sap_het_han' | 'het_han' | 'chua_khai_bao';

export const LICENSE_WARNING_DAYS = 30;

// A licence valid through date D is still usable during D itself; it is expired from D+1.
// `today` is the Vietnam calendar date as midnight UTC (see ClockService.today()).
export function computeLicenseStatus(
  ngayHetHan: Date | null | undefined,
  today: Date,
): LicenseStatus {
  if (!ngayHetHan) {
    return 'chua_khai_bao';
  }
  if (ngayHetHan.getTime() < today.getTime()) {
    return 'het_han';
  }
  return diffDays(ngayHetHan, today) <= LICENSE_WARNING_DAYS
    ? 'sap_het_han'
    : 'con_han';
}

export function isLicenseExpired(
  ngayHetHan: Date | null | undefined,
  today: Date,
): boolean {
  return !ngayHetHan || ngayHetHan.getTime() < today.getTime();
}
