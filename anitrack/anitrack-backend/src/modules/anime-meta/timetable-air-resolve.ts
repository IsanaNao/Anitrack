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
