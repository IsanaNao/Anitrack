export type MonthlyHeatmapIntensity = 0 | 1 | 2 | 3 | 4;

/**
 * Map monthly activity weight to intensity 0–4.
 * Weight = addedCount + completedCount (episodeCount is display-only).
 */
export function calculateMonthlyIntensity(args: {
  addedCount: number;
  completedCount: number;
}): MonthlyHeatmapIntensity {
  const added = Number.isFinite(args.addedCount)
    ? Math.max(0, Math.trunc(args.addedCount))
    : 0;
  const completed = Number.isFinite(args.completedCount)
    ? Math.max(0, Math.trunc(args.completedCount))
    : 0;
  const score = added + completed;
  if (score <= 0) return 0;
  if (score === 1) return 1;
  if (score <= 4) return 2;
  if (score <= 8) return 3;
  return 4;
}
