import { addDays, parseDateOnly } from './clock/vn-date.js';
import {
  computeLicenseStatus,
  isLicenseExpired,
  LICENSE_WARNING_DAYS,
} from './license-status.js';

const today = parseDateOnly('2026-10-01');

describe('computeLicenseStatus', () => {
  it('chưa khai báo ngày hết hạn', () => {
    expect(computeLicenseStatus(null, today)).toBe('chua_khai_bao');
    expect(computeLicenseStatus(undefined, today)).toBe('chua_khai_bao');
  });

  it.each([
    ['hôm qua', -1, 'het_han'],
    ['hôm nay (còn dùng hết ngày)', 0, 'sap_het_han'],
    ['còn 30 ngày (đúng ngưỡng)', LICENSE_WARNING_DAYS, 'sap_het_han'],
    ['còn 31 ngày', LICENSE_WARNING_DAYS + 1, 'con_han'],
    ['còn 365 ngày', 365, 'con_han'],
  ])('%s → %s', (_name, offset, expected) => {
    expect(computeLicenseStatus(addDays(today, offset), today)).toBe(expected);
  });
});

describe('isLicenseExpired', () => {
  it('hết hạn khi thiếu ngày hoặc ngày đã qua; hôm nay thì chưa hết', () => {
    expect(isLicenseExpired(null, today)).toBe(true);
    expect(isLicenseExpired(addDays(today, -1), today)).toBe(true);
    expect(isLicenseExpired(today, today)).toBe(false);
    expect(isLicenseExpired(addDays(today, 5), today)).toBe(false);
  });
});
