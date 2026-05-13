import type {
  BangumiCalendarDay,
  BangumiCalendarItem,
} from '../bangumi/bangumi.types';

export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function jikanTitlesFromMirrorData(data: unknown): string[] {
  const inner = (data as { data?: unknown })?.data;
  if (!inner || typeof inner !== 'object') return [];
  const o = inner as Record<string, unknown>;
  const out: string[] = [];
  for (const k of ['title', 'title_english', 'title_japanese']) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) out.push(v.trim());
  }
  return Array.from(new Set(out));
}

export function flattenBangumiCalendar(days: BangumiCalendarDay[]) {
  const rows: Array<{ item: BangumiCalendarItem; bucketWeekday?: number }> = [];
  for (const d of days) {
    const wid = d.weekday?.id;
    for (const it of d.items ?? []) {
      rows.push({
        item: it,
        bucketWeekday: typeof wid === 'number' ? wid : it.air_weekday,
      });
    }
  }
  return rows;
}

export function pickBangumiTitleMatch(
  jikanTitles: string[],
  rows: Array<{ item: BangumiCalendarItem; bucketWeekday?: number }>,
): { item: BangumiCalendarItem; bucketWeekday?: number } | null {
  const normed = jikanTitles.map(normalizeTitle).filter(Boolean);
  if (!normed.length) return null;

  let best: {
    item: BangumiCalendarItem;
    score: number;
    bucketWeekday?: number;
  } | null = null;

  for (const row of rows) {
    const names = [row.item.name, row.item.name_cn, row.item.name_en]
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map((x) => normalizeTitle(x));
    for (const jn of normed) {
      for (const bn of names) {
        if (!bn) continue;
        let score = 0;
        if (jn === bn) score = 100;
        else if (jn.includes(bn) || bn.includes(jn)) score = 82;
        else {
          const ja = new Set(jn.split(' ').filter((w) => w.length > 2));
          const bb = new Set(bn.split(' ').filter((w) => w.length > 2));
          let inter = 0;
          for (const w of ja) if (bb.has(w)) inter++;
          if (inter >= 3) score = 70 + Math.min(inter, 10);
        }
        if (score > 0 && (!best || score > best.score)) {
          best = { item: row.item, score, bucketWeekday: row.bucketWeekday };
        }
      }
    }
  }
  return best && best.score >= 70 ? best : null;
}

export function stripHtmlSummary(s: string, maxLen = 800): string {
  const t = s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
}

/**
 * Bangumi calendar / subject 的 `time` 有时是 `"23:30"`，有时是 `"2330"`。
 * 供时间表换算为欧洲本地钟面前使用。
 */
export function normalizeBangumiWallClock(
  raw: string | undefined | null,
): string | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;

  const mColon = s.match(/^(\d{1,2}):(\d{2})$/);
  if (mColon) {
    const hh = Number(mColon[1]);
    const mm = Number(mColon[2]);
    if (
      !Number.isFinite(hh) ||
      !Number.isFinite(mm) ||
      hh < 0 ||
      hh > 23 ||
      mm < 0 ||
      mm > 59
    ) {
      return undefined;
    }
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  const m4 = s.match(/^(\d{2})(\d{2})$/);
  if (m4) {
    const hh = Number(m4[1]);
    const mm = Number(m4[2]);
    if (
      !Number.isFinite(hh) ||
      !Number.isFinite(mm) ||
      hh < 0 ||
      hh > 23 ||
      mm < 0 ||
      mm > 59
    ) {
      return undefined;
    }
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  return undefined;
}
