import { Injectable } from '@nestjs/common';
import { parseDateOnly, toVnDateString } from './vn-date.js';

// Single source of "now"; business logic must not call new Date() directly
// so tests can control time.
@Injectable()
export class ClockService {
  now(): Date {
    return new Date();
  }

  // Today's calendar date in Vietnam, as midnight UTC of that date.
  today(): Date {
    return parseDateOnly(toVnDateString(this.now()));
  }
}
