import { ClockService } from './clock.service.js';

describe('ClockService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('now() trả thời điểm hiện tại', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T03:00:00Z'));
    expect(new ClockService().now().toISOString()).toBe(
      '2026-10-01T03:00:00.000Z',
    );
  });

  it('today() là ngày theo giờ VN (nửa đêm UTC của ngày đó)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T17:30:00Z')); // 00:30 ngày 01/10 giờ VN
    expect(new ClockService().today().toISOString()).toBe(
      '2026-10-01T00:00:00.000Z',
    );
  });

  it('today() chưa sang ngày mới khi còn trước 00:00 giờ VN', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T16:59:00Z'));
    expect(new ClockService().today().toISOString()).toBe(
      '2026-09-30T00:00:00.000Z',
    );
  });
});
