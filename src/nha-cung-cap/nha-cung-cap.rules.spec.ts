import { addDays, parseDateOnly } from '../common/clock/vn-date.js';
import {
  assertCanSupply,
  assertDateOrder,
  assertVerifiable,
  licenseChanged,
} from './nha-cung-cap.rules.js';

const today = parseDateOnly('2026-10-01');
const future = addDays(today, 365);

const fullLicense = {
  soGiayPhepKinhDoanh: 'GP-1',
  ngayCapGPKD: addDays(today, -400),
  noiCapGPKD: 'Sở KH&ĐT',
  ngayHetHanGPKD: future,
  soGCNDuDieuKienKinhDoanhDuoc: 'GCN-1',
  ngayCapGCNDuoc: addDays(today, -400),
  noiCapGCNDuoc: 'Sở Y tế',
  ngayHetHanGCNDuoc: future,
};

describe('assertVerifiable', () => {
  it('đủ hồ sơ và còn hạn → hợp lệ', () => {
    expect(() => assertVerifiable(fullLicense, today)).not.toThrow();
  });

  it.each([
    'soGiayPhepKinhDoanh',
    'ngayCapGPKD',
    'ngayHetHanGPKD',
    'soGCNDuDieuKienKinhDoanhDuoc',
    'ngayCapGCNDuoc',
    'ngayHetHanGCNDuoc',
  ] as const)(
    'thiếu %s → NHA_CUNG_CAP_LICENSE_INCOMPLETE và liệt kê trường thiếu',
    (field) => {
      expect(() =>
        assertVerifiable({ ...fullLicense, [field]: null }, today),
      ).toThrow(
        expect.objectContaining({
          code: 'NHA_CUNG_CAP_LICENSE_INCOMPLETE',
          details: { thieu: [field] },
        }),
      );
    },
  );

  it('nơi cấp không bắt buộc để xác minh', () => {
    expect(() =>
      assertVerifiable(
        { ...fullLicense, noiCapGPKD: null, noiCapGCNDuoc: null },
        today,
      ),
    ).not.toThrow();
  });

  it('số giấy phép chỉ có chuỗi rỗng được coi là thiếu', () => {
    expect(() =>
      assertVerifiable({ ...fullLicense, soGiayPhepKinhDoanh: '' }, today),
    ).toThrow(
      expect.objectContaining({ code: 'NHA_CUNG_CAP_LICENSE_INCOMPLETE' }),
    );
  });

  it('GPKD hoặc GCN hết hạn → NHA_CUNG_CAP_LICENSE_EXPIRED', () => {
    const yesterday = addDays(today, -1);
    expect(() =>
      assertVerifiable({ ...fullLicense, ngayHetHanGPKD: yesterday }, today),
    ).toThrow(
      expect.objectContaining({ code: 'NHA_CUNG_CAP_LICENSE_EXPIRED' }),
    );
    expect(() =>
      assertVerifiable({ ...fullLicense, ngayHetHanGCNDuoc: yesterday }, today),
    ).toThrow(
      expect.objectContaining({ code: 'NHA_CUNG_CAP_LICENSE_EXPIRED' }),
    );
  });

  it('hết hạn đúng hôm nay vẫn hợp lệ', () => {
    expect(() =>
      assertVerifiable(
        { ...fullLicense, ngayHetHanGPKD: today, ngayHetHanGCNDuoc: today },
        today,
      ),
    ).not.toThrow();
  });
});

describe('assertCanSupply (bảng chân trị)', () => {
  const ok = {
    ...fullLicense,
    trangThai: true,
    trangThaiXacMinh: 'da_xac_minh' as const,
  };

  it('hoạt động + đã xác minh + hai giấy phép còn hạn → được cung cấp', () => {
    expect(() => assertCanSupply(ok, today)).not.toThrow();
  });

  it('ngừng hoạt động → NHA_CUNG_CAP_INACTIVE (kiểm đầu tiên)', () => {
    expect(() =>
      assertCanSupply(
        { ...ok, trangThai: false, trangThaiXacMinh: 'chua_xac_minh' },
        today,
      ),
    ).toThrow(expect.objectContaining({ code: 'NHA_CUNG_CAP_INACTIVE' }));
  });

  it.each(['chua_xac_minh', 'tu_choi'] as const)(
    'chưa xác minh (%s) → NHA_CUNG_CAP_NOT_VERIFIED',
    (status) => {
      expect(() =>
        assertCanSupply({ ...ok, trangThaiXacMinh: status }, today),
      ).toThrow(expect.objectContaining({ code: 'NHA_CUNG_CAP_NOT_VERIFIED' }));
    },
  );

  it('giấy phép hết hạn sau khi đã xác minh → NHA_CUNG_CAP_LICENSE_EXPIRED', () => {
    expect(() =>
      assertCanSupply({ ...ok, ngayHetHanGCNDuoc: addDays(today, -1) }, today),
    ).toThrow(
      expect.objectContaining({ code: 'NHA_CUNG_CAP_LICENSE_EXPIRED' }),
    );
  });

  it('ngày hết hạn bị xóa (null) được coi là hết hạn', () => {
    expect(() =>
      assertCanSupply({ ...ok, ngayHetHanGPKD: null }, today),
    ).toThrow(
      expect.objectContaining({ code: 'NHA_CUNG_CAP_LICENSE_EXPIRED' }),
    );
  });
});

describe('licenseChanged', () => {
  it('không gửi trường nào → không đổi', () => {
    expect(licenseChanged(fullLicense, {})).toBe(false);
  });

  it('gửi lại đúng giá trị hiện tại (chuỗi và Date) → không đổi', () => {
    expect(
      licenseChanged(fullLicense, {
        soGiayPhepKinhDoanh: 'GP-1',
        ngayHetHanGPKD: new Date(future.getTime()),
      }),
    ).toBe(false);
  });

  it('đổi bất kỳ trường giấy phép nào → có đổi', () => {
    expect(licenseChanged(fullLicense, { soGiayPhepKinhDoanh: 'GP-2' })).toBe(
      true,
    );
    expect(
      licenseChanged(fullLicense, { ngayHetHanGCNDuoc: addDays(future, 1) }),
    ).toBe(true);
    expect(licenseChanged(fullLicense, { noiCapGPKD: null })).toBe(true);
  });
});

describe('assertDateOrder', () => {
  it('hết hạn trước ngày cấp → VALIDATION_FAILED chỉ đúng field', () => {
    expect(() =>
      assertDateOrder(
        parseDateOnly('2026-05-02'),
        parseDateOnly('2026-05-01'),
        'ngayHetHanGCNDuoc',
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'VALIDATION_FAILED',
        details: [expect.objectContaining({ field: 'ngayHetHanGCNDuoc' })],
      }),
    );
  });

  it('cùng ngày hoặc thiếu một đầu → hợp lệ', () => {
    expect(() =>
      assertDateOrder(
        parseDateOnly('2026-05-01'),
        parseDateOnly('2026-05-01'),
        'f',
      ),
    ).not.toThrow();
    expect(() =>
      assertDateOrder(null, parseDateOnly('2026-05-01'), 'f'),
    ).not.toThrow();
  });
});
