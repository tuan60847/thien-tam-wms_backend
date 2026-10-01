import {
  addDays,
  diffDays,
  formatDateOnly,
  parseDateOnly,
  toVnDateString,
  vnDayRangeUtc,
} from './vn-date.js';

describe('vn-date', () => {
  it.each([
    ['2026-09-30T16:59:59.999Z', '2026-09-30'],
    ['2026-09-30T17:00:00.000Z', '2026-10-01'],
    ['2026-10-01T00:00:00.000Z', '2026-10-01'],
    ['2026-12-31T17:00:00.000Z', '2027-01-01'],
  ])('toVnDateString(%s) = %s (ngày theo giờ Việt Nam)', (iso, expected) => {
    expect(toVnDateString(new Date(iso))).toBe(expected);
  });

  it('parseDateOnly / formatDateOnly khứ hồi, lưu là nửa đêm UTC', () => {
    const date = parseDateOnly('2027-03-31');
    expect(date.toISOString()).toBe('2027-03-31T00:00:00.000Z');
    expect(formatDateOnly(date)).toBe('2027-03-31');
  });

  it('vnDayRangeUtc bao gồm cả ngày cuối theo giờ VN', () => {
    const { start, endExclusive } = vnDayRangeUtc('2026-10-01', '2026-10-02');
    expect(start.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(endExclusive.toISOString()).toBe('2026-10-02T17:00:00.000Z');
  });

  it('vnDayRangeUtc một ngày: 23:30 VN thuộc ngày đó, 00:00 VN hôm sau thì không', () => {
    const { start, endExclusive } = vnDayRangeUtc('2026-10-01', '2026-10-01');
    const inside = new Date('2026-10-01T16:30:00Z');
    const nextDay = new Date('2026-10-01T17:00:00Z');
    expect(inside >= start && inside < endExclusive).toBe(true);
    expect(nextDay < endExclusive).toBe(false);
  });

  it('addDays / diffDays', () => {
    const base = parseDateOnly('2026-10-01');
    expect(formatDateOnly(addDays(base, 90))).toBe('2026-12-30');
    expect(diffDays(addDays(base, 31), base)).toBe(31);
    expect(diffDays(base, addDays(base, 5))).toBe(-5);
  });
});
