import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { tokyoWallToBerlinClock } from './timetable.util';

dayjs.extend(utc);
dayjs.extend(timezone);

describe('tokyoWallToBerlinClock', () => {
  it('maps 26:00 to next Tokyo calendar day (02:00 +09)', () => {
    const r = tokyoWallToBerlinClock('2026-05-13', '26:00');
    expect(r).not.toBeNull();
    expect(dayjs(r!.iso).tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm')).toBe(
      '2026-05-14 02:00',
    );
  });

  it('parses 2330', () => {
    const r = tokyoWallToBerlinClock('2026-05-13', '2330');
    expect(r).not.toBeNull();
    expect(r!.clock).toMatch(/^\d{2}:\d{2}$/);
  });
});
