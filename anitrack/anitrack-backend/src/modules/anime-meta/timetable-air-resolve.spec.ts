import {
  extractJikanBroadcastWeekday,
  resolveTimetableWeekdayBangumi,
} from './timetable-air-resolve';

describe('extractJikanBroadcastWeekday', () => {
  it('maps Saturdays to 6', () => {
    expect(
      extractJikanBroadcastWeekday({
        broadcast: { day: 'Saturdays', time: '22:30' },
      } as Record<string, unknown>),
    ).toBe(6);
  });

  it('maps 土曜日 to 6', () => {
    expect(
      extractJikanBroadcastWeekday({
        broadcast: { day: '土曜日', time: '22:30' },
      } as Record<string, unknown>),
    ).toBe(6);
  });

  it('returns undefined for Unknown', () => {
    expect(
      extractJikanBroadcastWeekday({
        broadcast: { day: 'Unknown', time: '' },
      } as Record<string, unknown>),
    ).toBeUndefined();
  });

  it('parses weekday from broadcast.string when day missing', () => {
    expect(
      extractJikanBroadcastWeekday({
        broadcast: { day: null, string: 'Saturdays at 22:30 (JST)' },
      } as Record<string, unknown>),
    ).toBe(6);
  });
});

describe('resolveTimetableWeekdayBangumi', () => {
  it('prefers bangumi.weekday over Jikan', () => {
    expect(
      resolveTimetableWeekdayBangumi({
        bangumi: { weekday: 3 },
        jikanInner: { broadcast: { day: 'Saturdays' } } as Record<string, unknown>,
      }),
    ).toBe(3);
  });

  it('falls back to Jikan when bangumi weekday missing', () => {
    expect(
      resolveTimetableWeekdayBangumi({
        bangumi: {},
        jikanInner: { broadcast: { day: 'Saturdays' } } as Record<string, unknown>,
      }),
    ).toBe(6);
  });
});
