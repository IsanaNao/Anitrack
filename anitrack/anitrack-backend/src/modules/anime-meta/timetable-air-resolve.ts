import { normalizeBangumiWallClock } from '../bee/bee-mapping.util';

/**
 * Bangumi `air_date` 若含时刻（ISO / `YYYY-MM-DDTHH:mm`），提取 `HH:mm` 供时间表兜底。
 */
export function tryExtractClockFromAirDateString(airDate: string): string | undefined {
  const s = airDate.trim();
  if (!s) return undefined;
  if (s.includes('T')) {
    const m = s.match(/T(\d{1,2}):(\d{2})/);
    if (m) {
      const hh = Number(m[1]);
      const mm = Number(m[2]);
      if (
        Number.isFinite(hh) &&
        Number.isFinite(mm) &&
        hh >= 0 &&
        hh <= 47 &&
        mm >= 0 &&
        mm <= 59
      ) {
        return normalizeBangumiWallClock(`${hh}:${String(mm).padStart(2, '0')}`);
      }
    }
  }
  return undefined;
}

/**
 * Jikan `broadcast.time` 或 `broadcast.string` 中的 `HH:mm`。
 */
export function extractJikanBroadcastTime(
  inner: Record<string, unknown> | undefined,
): string | undefined {
  if (!inner) return undefined;
  const br = inner.broadcast;
  if (!br || typeof br !== 'object') return undefined;
  const o = br as Record<string, unknown>;
  const time = typeof o.time === 'string' ? o.time.trim() : '';
  if (time) return normalizeBangumiWallClock(time) ?? time;
  const str = typeof o.string === 'string' ? o.string : '';
  const m = str.match(/(\d{1,2}):(\d{2})/);
  if (m) {
    const cand = `${Number(m[1])}:${String(m[2]).padStart(2, '0')}`;
    return normalizeBangumiWallClock(cand) ?? cand;
  }
  return undefined;
}

/** Jikan v4 `broadcast.day` 常见英文；与 Bangumi 对齐：1=周一 … 7=周日。 */
const JIKAN_DAY_TO_BANGUMI_WEEKDAY: Record<string, number> = {
  mondays: 1,
  monday: 1,
  tuesdays: 2,
  tuesday: 2,
  wednesdays: 3,
  wednesday: 3,
  thursdays: 4,
  thursday: 4,
  fridays: 5,
  friday: 5,
  saturdays: 6,
  saturday: 6,
  sundays: 7,
  sunday: 7,
  月曜日: 1,
  火曜日: 2,
  水曜日: 3,
  木曜日: 4,
  金曜日: 5,
  土曜日: 6,
  日曜日: 7,
};

/**
 * 从 Jikan 条目解析「放送星期」（Bangumi 同构 1–7）。`Unknown` / 未放送 / 缺失 → `undefined`。
 */
export function extractJikanBroadcastWeekday(
  inner: Record<string, unknown> | undefined,
): number | undefined {
  if (!inner) return undefined;
  const br = inner.broadcast;
  if (!br || typeof br !== 'object') return undefined;
  const o = br as Record<string, unknown>;
  const day = typeof o.day === 'string' ? o.day.trim() : '';
  if (day) {
    const k = day.toLowerCase();
    if (!k || k === 'unknown' || k.includes('not scheduled')) return undefined;
    if (k in JIKAN_DAY_TO_BANGUMI_WEEKDAY) return JIKAN_DAY_TO_BANGUMI_WEEKDAY[k];
    if (day in JIKAN_DAY_TO_BANGUMI_WEEKDAY) return JIKAN_DAY_TO_BANGUMI_WEEKDAY[day];
  }
  const str = typeof o.string === 'string' ? o.string : '';
  if (str) {
    const low = str.toLowerCase();
    for (const [key, num] of Object.entries(JIKAN_DAY_TO_BANGUMI_WEEKDAY)) {
      if (key.length >= 6 && low.includes(key)) return num;
    }
  }
  return undefined;
}

/**
 * 时间表分桶用星期：**优先**已映射的 `bangumi.weekday`，否则回退 Jikan `broadcast.day`。
 * （搜索能见到的番剧在当季镜像里常有 Jikan `data`，但可能尚未匹配 Bangumi → 无 `bgmId`。）
 */
export function resolveTimetableWeekdayBangumi(args: {
  bangumi?: { weekday?: unknown } | null;
  jikanInner?: Record<string, unknown> | null;
}): number | undefined {
  const wd = args.bangumi?.weekday;
  if (typeof wd === 'number' && wd >= 1 && wd <= 7) return Math.trunc(wd);
  return extractJikanBroadcastWeekday(args.jikanInner ?? undefined);
}

export function resolveTimetableAirTimeRaw(args: {
  bangumi?: Record<string, unknown> | null;
  jikanInner?: Record<string, unknown> | null;
}): string | undefined {
  const bg = args.bangumi;
  if (bg && typeof bg.airTime === 'string' && bg.airTime.trim()) {
    return bg.airTime.trim();
  }
  const airDate =
    (bg && typeof bg.airDate === 'string' && bg.airDate.trim()) ||
    (bg && typeof bg.air_date === 'string' && String(bg.air_date).trim()) ||
    '';
  if (airDate) {
    const fromDate = tryExtractClockFromAirDateString(airDate);
    if (fromDate) return fromDate;
  }
  return extractJikanBroadcastTime(args.jikanInner ?? undefined);
}
