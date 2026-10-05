import { addDays, parseDateOnly } from '../common/clock/vn-date.js';
import { assertCanBuy, assertLicenseDates } from './khach-hang.rules.js';

const today = parseDateOnly('2026-10-01');

describe('assertCanBuy', () => {
  it('hoạt động và giấy phép còn hạn → được mua', () => {
    expect(() =>
      assertCanBuy(
        { trangThai: 'hoat_dong', ngayHetHanGPKD: addDays(today, 90) },
        today,
      ),
    ).not.toThrow();
  });

  it('giấy phép hết hạn đúng hôm nay vẫn được mua (còn dùng hết ngày)', () => {
    expect(() =>
      assertCanBuy({ trangThai: 'hoat_dong', ngayHetHanGPKD: today }, today),
    ).not.toThrow();
  });

  it('giấy phép hết hạn hôm qua → KHACH_HANG_LICENSE_EXPIRED', () => {
    expect(() =>
      assertCanBuy(
        { trangThai: 'hoat_dong', ngayHetHanGPKD: addDays(today, -1) },
        today,
      ),
    ).toThrow(expect.objectContaining({ code: 'KHACH_HANG_LICENSE_EXPIRED' }));
  });

  it('chưa khai báo ngày hết hạn → KHACH_HANG_LICENSE_EXPIRED', () => {
    expect(() =>
      assertCanBuy({ trangThai: 'hoat_dong', ngayHetHanGPKD: null }, today),
    ).toThrow(expect.objectContaining({ code: 'KHACH_HANG_LICENSE_EXPIRED' }));
  });

  it('ngừng hoạt động → KHACH_HANG_INACTIVE (kiểm trước giấy phép)', () => {
    expect(() =>
      assertCanBuy(
        { trangThai: 'ngung_hoat_dong', ngayHetHanGPKD: addDays(today, -10) },
        today,
      ),
    ).toThrow(expect.objectContaining({ code: 'KHACH_HANG_INACTIVE' }));
  });
});

describe('assertLicenseDates', () => {
  it('hết hạn trước ngày cấp → VALIDATION_FAILED', () => {
    expect(() =>
      assertLicenseDates(
        parseDateOnly('2026-05-01'),
        parseDateOnly('2026-04-30'),
      ),
    ).toThrow(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
  });

  it('cùng ngày, sau ngày cấp, hoặc thiếu một trong hai → hợp lệ', () => {
    expect(() =>
      assertLicenseDates(
        parseDateOnly('2026-05-01'),
        parseDateOnly('2026-05-01'),
      ),
    ).not.toThrow();
    expect(() =>
      assertLicenseDates(
        parseDateOnly('2026-05-01'),
        parseDateOnly('2027-05-01'),
      ),
    ).not.toThrow();
    expect(() =>
      assertLicenseDates(null, parseDateOnly('2026-05-01')),
    ).not.toThrow();
    expect(() =>
      assertLicenseDates(parseDateOnly('2026-05-01'), undefined),
    ).not.toThrow();
  });
});
