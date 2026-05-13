import {
  normalizeBangumiWallClock,
  parseBangumiWallClockWithExtendedHours,
} from './bee-mapping.util';

describe('parseBangumiWallClockWithExtendedHours', () => {
  it('parses 23:30', () => {
    expect(parseBangumiWallClockWithExtendedHours('23:30')).toEqual({
      hour: 23,
      minute: 30,
      dayOffset: 0,
    });
  });

  it('parses 2330', () => {
    expect(parseBangumiWallClockWithExtendedHours('2330')).toEqual({
      hour: 23,
      minute: 30,
      dayOffset: 0,
    });
  });

  it('folds 25:00 to next day 01:00', () => {
    expect(parseBangumiWallClockWithExtendedHours('25:00')).toEqual({
      hour: 1,
      minute: 0,
      dayOffset: 1,
    });
  });

  it('folds 26:00 to next day 02:00', () => {
    expect(parseBangumiWallClockWithExtendedHours('26:00')).toEqual({
      hour: 2,
      minute: 0,
      dayOffset: 1,
    });
  });

  it('folds 26:30', () => {
    expect(parseBangumiWallClockWithExtendedHours('26:30')).toEqual({
      hour: 2,
      minute: 30,
      dayOffset: 1,
    });
  });

  it('rejects invalid minute', () => {
    expect(parseBangumiWallClockWithExtendedHours('12:99')).toBeNull();
  });
});

describe('normalizeBangumiWallClock', () => {
  it('round-trips extended notation', () => {
    expect(normalizeBangumiWallClock('26:00')).toBe('26:00');
    expect(normalizeBangumiWallClock('2330')).toBe('23:30');
  });
});
