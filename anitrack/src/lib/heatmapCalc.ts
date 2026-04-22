/**
 * Heatmap 纯逻辑（Blueprint §3.7、§5.2）：强度映射 + 日历周（周一起）补全。
 * completedDates 为 YYYY-MM-DD 字符串；from/to 为同一格式的闭区间。
 */

export type HeatmapIntensity = 0 | 1 | 2 | 3 | 4;

export type HeatmapDay = {
  date: string;
  intensity: HeatmapIntensity;
  count: number;
};

export type HeatmapWeek = {
  weekStart: string;
  days: HeatmapDay[];
};

/** Blueprint §5.2：固定阈值映射 */
export function calculateIntensity(count: number): HeatmapIntensity {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (n === 0) return 0;
  if (n === 1) return 1;
  if (n === 2) return 2;
  if (n <= 4) return 3;
  return 4;
}

/** 使用 UTC 日历分量做加减，避免与「墙上日期字符串」混用 DST 时刻 */
export function addCalendarDaysUTC(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

/** 包含该日期的自然周的周一（UTC 周历，与 Blueprint 示例一致：周一是 weekStart） */
export function mondayOnOrBeforeUTC(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0 Sun .. 6 Sat
  const daysSinceMonday = (dow + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - daysSinceMonday);
  return dt.toISOString().slice(0, 10);
}

/** 用于默认 `to`：指定 IANA 时区下的「今天」日历日 */
export function getTodayInTimeZone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function compareYMD(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function listDaysInclusive(from: string, to: string): string[] {
  const out: string[] = [];
  if (compareYMD(from, to) > 0) return out;
  let cur = from;
  while (compareYMD(cur, to) <= 0) {
    out.push(cur);
    cur = addCalendarDaysUTC(cur, 1);
  }
  return out;
}

/**
 * 生成 Blueprint §3.7 的 weeks：从「包含 from 的那周周一」到「包含 to 的那周周日」，
 * 区间内日期用 countsByDate；区间外（首尾周补齐部分）count=0、intensity=0。
 */
export function buildHeatmapWeeks(
  from: string,
  to: string,
  countsByDate: ReadonlyMap<string, number>,
): HeatmapWeek[] {
  if (compareYMD(from, to) > 0) return [];

  const weeks: HeatmapWeek[] = [];
  let weekStart = mondayOnOrBeforeUTC(from);
  const lastWeekStart = mondayOnOrBeforeUTC(to);

  while (compareYMD(weekStart, lastWeekStart) <= 0) {
    const days: HeatmapDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addCalendarDaysUTC(weekStart, i);
      const inRange = compareYMD(date, from) >= 0 && compareYMD(date, to) <= 0;
      const count = inRange ? (countsByDate.get(date) ?? 0) : 0;
      days.push({
        date,
        count,
        intensity: calculateIntensity(count),
      });
    }
    weeks.push({ weekStart, days });
    weekStart = addCalendarDaysUTC(weekStart, 7);
  }

  return weeks;
}
