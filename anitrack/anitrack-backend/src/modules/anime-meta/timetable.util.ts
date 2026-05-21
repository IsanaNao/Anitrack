import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { parseBangumiWallClockWithExtendedHours } from '../bee/bee-mapping.util';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ_BERLIN = 'Europe/Berlin';
/** 番组表记法：东京墙钟（与 Bangumi / 日本电视业界一致） */
const TZ_TOKYO = 'Asia/Tokyo';

/** Bangumi weekday id：1=周一 … 7=周日（与 `/calendar` 桶 id 常见约定一致）。 */
export function bangumiWeekdayFromBerlinInstant(d: Date): number {
  const w = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_BERLIN,
    weekday: 'short',
  }).format(d);
  const map: Record<string, number> = {
    Sun: 7,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[w] ?? 0;
}

export function formatYmdBerlin(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_BERLIN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function formatWeekdayLongZhBerlin(d: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: TZ_BERLIN,
    weekday: 'long',
  }).format(d);
}

export function formatDateSlashBerlin(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_BERLIN,
    month: 'numeric',
    day: 'numeric',
  }).format(d);
}

/** 柏林日历日正午 instant，用于按日偏移生成时间表列（避免 DST 边界错位）。 */
export function berlinInstantAtDayOffset(offsetDays: number, from = new Date()): Date {
  const anchor = dayjs(from).tz(TZ_BERLIN).startOf('day').add(12, 'hour');
  return anchor.add(offsetDays, 'day').toDate();
}

export function formatWeekdayShortZhBerlin(d: Date): string {
  const long = formatWeekdayLongZhBerlin(d);
  return long.startsWith('星期') ? `周${long.slice(2)}` : long;
}

/**
 * 将「东京本地墙钟 + 日历日」解析为绝对时间，再格式化为 `Europe/Berlin` 钟面时间。
 * 使用 dayjs `Asia/Tokyo` → `Europe/Berlin`（含 DST）；支持 **25:00 / 26:00** 等超 24 点记法。
 */
export function tokyoWallToBerlinClock(
  ymd: string,
  hhmmRaw: string | undefined,
): { clock: string; iso: string } | null {
  if (!hhmmRaw?.trim()) return null;

  const parsed = parseBangumiWallClockWithExtendedHours(hhmmRaw);
  if (!parsed) return null;

  const [y, mo, da] = ymd.split('-').map((x) => Number(x));
  if (![y, mo, da].every((n) => Number.isFinite(n))) return null;

  const pad = (n: number) => String(n).padStart(2, '0');
  const base = dayjs.tz(
    `${String(y).padStart(4, '0')}-${pad(mo)}-${pad(da)} 00:00:00`,
    'YYYY-MM-DD HH:mm:ss',
    TZ_TOKYO,
  );
  if (!base.isValid()) return null;

  const wall = base
    .add(parsed.dayOffset, 'day')
    .hour(parsed.hour)
    .minute(parsed.minute)
    .second(0)
    .millisecond(0);

  const clock = wall.tz(TZ_BERLIN).format('HH:mm');
  const iso = wall.toISOString();
  return { clock, iso };
}
