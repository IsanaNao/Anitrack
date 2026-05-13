import { normalizeBangumiWallClock } from '../bee/bee-mapping.util';

const TZ = 'Europe/Berlin';

/** Bangumi weekday id：1=周一 … 7=周日（与 `/calendar` 桶 id 常见约定一致）。 */
export function bangumiWeekdayFromBerlinInstant(d: Date): number {
  const w = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
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
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function formatWeekdayLongZhBerlin(d: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: TZ,
    weekday: 'long',
  }).format(d);
}

export function formatDateSlashBerlin(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    month: 'numeric',
    day: 'numeric',
  }).format(d);
}

/**
 * 将「东京本地墙钟 + 日历日」解析为绝对时间，再格式化为比勒费尔德所在时区（`Europe/Berlin`）钟面时间。
 * 说明：番组放送表通常以 **Asia/Tokyo** 墙钟为准；此处用 `+09:00` 固定偏移（不含日本历史 DST）。
 */
export function tokyoWallToBerlinClock(
  ymd: string,
  hhmm: string | undefined,
): { clock: string; iso: string } | null {
  const normalized = normalizeBangumiWallClock(hhmm);
  if (!normalized) return null;
  const [hs, ms] = normalized.split(':');
  const hh = Number(hs);
  const mm = Number(ms);
  const [y, mo, da] = ymd.split('-').map((x) => Number(x));
  if (![y, mo, da, hh, mm].every((n) => Number.isFinite(n))) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const isoLocalTokyo = `${String(y).padStart(4, '0')}-${pad(mo)}-${pad(da)}T${pad(hh)}:${pad(mm)}:00+09:00`;
  const t = Date.parse(isoLocalTokyo);
  if (!Number.isFinite(t)) return null;
  const dt = new Date(t);
  const clock = new Intl.DateTimeFormat('de-DE', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(dt);
  return { clock, iso: dt.toISOString() };
}
