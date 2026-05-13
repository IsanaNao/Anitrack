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
 * 解析 Bangumi 墙钟（含深夜档 **25:00 / 26:30** 等「超 24 点」记法）。
 * 返回「当日 0–23 点内的时分」+ **向后推移的日历天数**（东京侧语义）。
 */
export function parseBangumiWallClockWithExtendedHours(
  raw: string | undefined | null,
): { hour: number; minute: number; dayOffset: number } | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  let h: number;
  let m: number;

  const colon = s.match(/^(\d{1,2}):(\d{2})$/);
  if (colon) {
    h = Number(colon[1]);
    m = Number(colon[2]);
  } else if (/^\d{4}$/.test(s)) {
    h = Number(s.slice(0, 2));
    m = Number(s.slice(2, 4));
  } else {
    return null;
  }

  if (
    !Number.isFinite(h) ||
    !Number.isFinite(m) ||
    h < 0 ||
    h > 47 ||
    m < 0 ||
    m > 59
  ) {
    return null;
  }

  const totalMin = h * 60 + m;
  const dayOffset = Math.floor(totalMin / (24 * 60));
  const rem = totalMin % (24 * 60);
  return { hour: Math.floor(rem / 60), minute: rem % 60, dayOffset };
}

/**
 * Bangumi calendar / subject 的 `time`：`"23:30"` / `"2330"` / **`"26:00"`** 等。
 * 返回值用于入库：超 24 点记法保留为 **`26:00`** 形式（两位小时最大 47）。
 */
export function normalizeBangumiWallClock(
  raw: string | undefined | null,
): string | undefined {
  const p = parseBangumiWallClockWithExtendedHours(raw);
  if (!p) return undefined;
  const totalH = p.dayOffset * 24 + p.hour;
  if (totalH > 47 || p.minute > 59) return undefined;
  return `${String(totalH).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}
