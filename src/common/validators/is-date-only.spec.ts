import { isDateOnly } from './is-date-only.js';

describe('isDateOnly', () => {
  it.each(['2026-10-01', '2028-02-29', '1999-12-31'])(
    'chấp nhận %s',
    (value) => {
      expect(isDateOnly(value)).toBe(true);
    },
  );

  it.each([
    '2026-13-01',
    '2026-02-30',
    '2027-02-29',
    '2026-1-1',
    '01-10-2026',
    '2026-10-01T00:00:00Z',
    '',
    null,
    20261001,
  ])('từ chối %j', (value) => {
    expect(isDateOnly(value)).toBe(false);
  });
});
