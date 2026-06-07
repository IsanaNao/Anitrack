/** Weekday short label for a Berlin calendar date (YYYY-MM-DD). */
export function formatWeekdayBerlin(dateYmd: string, locale: "zh" | "en"): string {
  const [y, m, d] = dateYmd.split("-").map(Number);
  if (!y || !m || !d) return dateYmd;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    weekday: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));
}
