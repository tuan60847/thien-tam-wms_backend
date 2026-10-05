import {
  addDays,
  formatDateOnly,
  parseDateOnly,
  toVnDateString,
} from '../../src/common/clock/vn-date.js';

// Today's Vietnam calendar date shifted by `days`, as YYYY-MM-DD (what the API accepts).
export function vnDate(days = 0): string {
  return formatDateOnly(
    addDays(parseDateOnly(toVnDateString(new Date())), days),
  );
}
