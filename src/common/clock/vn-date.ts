// Business dates follow Asia/Ho_Chi_Minh (UTC+7, no DST); storage and API instants are UTC.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Calendar date (YYYY-MM-DD) in Vietnam for a UTC instant.
export function toVnDateString(instant: Date): string {
  return new Date(instant.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

// Date-only values are stored as midnight UTC of the calendar date.
export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

// [start, endExclusive) UTC instants covering VN calendar days from..to inclusive.
export function vnDayRangeUtc(
  from: string,
  to: string,
): { start: Date; endExclusive: Date } {
  const start = new Date(`${from}T00:00:00+07:00`);
  const endExclusive = new Date(
    new Date(`${to}T00:00:00+07:00`).getTime() + DAY_MS,
  );
  return { start, endExclusive };
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function diffDays(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / DAY_MS);
}
