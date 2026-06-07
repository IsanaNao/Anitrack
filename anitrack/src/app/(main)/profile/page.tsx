"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StartMonthPicker } from "@/components/StartMonthPicker";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import type { LifeMonthCell } from "@/lib/api";
import { getHeatmap, getMonthlyActivity, getStatsSummary } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import { en } from "@/i18n/messages/en";
import { zh } from "@/i18n/messages/zh";
import { useAnimeDisplay } from "@/i18n/useAnimeDisplay";

const START_DATE = "2005-05";

dayjs.extend(utc);

function intensityClass(intensity: number) {
  if (!intensity) return "bg-zinc-100 dark:bg-zinc-900";
  if (intensity >= 4) return "bg-emerald-600 dark:bg-emerald-500";
  if (intensity >= 3) return "bg-emerald-500/80 dark:bg-emerald-500/80";
  if (intensity >= 2) return "bg-emerald-500/55 dark:bg-emerald-500/55";
  return "bg-emerald-500/35 dark:bg-emerald-500/35";
}

function parseYYYYMM(v: string) {
  const [y, m] = v.split("-").map((x) => Number(x));
  return { year: y, month: m };
}

/** Pick year labels with enough column spacing so adjacent years don't overlap. */
function computeVisibleYearLabels(
  years: number[],
  startYear: number,
  nowYear: number,
  minColGap = 2,
): number[] {
  const lastYear = years[years.length - 1];
  const candidates: { year: number; priority: number }[] = [];

  for (const y of years) {
    let priority = 0;
    if (y === startYear) priority = 4;
    else if (y === nowYear) priority = 3;
    else if (y === lastYear && y !== nowYear) priority = 2;
    else if (y % 5 === 0) priority = 1;
    else continue;
    candidates.push({ year: y, priority });
  }

  candidates.sort((a, b) => b.priority - a.priority || a.year - b.year);

  const placedIdx: number[] = [];
  const result: number[] = [];

  for (const { year } of candidates) {
    const idx = years.indexOf(year);
    if (placedIdx.some((pi) => Math.abs(pi - idx) < minColGap)) continue;
    placedIdx.push(idx);
    result.push(year);
  }

  return result.sort((a, b) => a - b);
}

const TOOLTIP_W = 220;
const TOOLTIP_H_EST = 88;

type HeatmapGridMetrics = {
  colW: number;
  colGap: number;
  rowLabelW: number;
};

const DESKTOP_HEATMAP: HeatmapGridMetrics = { colW: 16, colGap: 3, rowLabelW: 32 };

function isMobileViewport() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 639px)").matches
  );
}

function computeHeatmapGridMetrics(
  yearCount: number,
  containerWidth = 0,
): HeatmapGridMetrics {
  if (!isMobileViewport()) {
    return DESKTOP_HEATMAP;
  }

  const colGap = 2;
  const rowLabelW = 28;
  if (yearCount <= 0 || containerWidth <= 0) {
    return { colW: 12, colGap, rowLabelW };
  }
  const pad = 24;
  const available = Math.max(260, containerWidth - pad);
  const usable = available - rowLabelW;
  const fitColW = Math.floor((usable - yearCount * colGap) / yearCount);
  const colW = Math.max(11, Math.min(16, fitColW));
  return { colW, colGap, rowLabelW };
}

function computeHeatmapTooltipPos(
  cellEl: HTMLElement,
  gridEl: HTMLElement,
  tooltipH = TOOLTIP_H_EST,
) {
  const cellRect = cellEl.getBoundingClientRect();
  const gridRect = gridEl.getBoundingClientRect();
  const gap = 6;

  let x = cellRect.left - gridRect.left + cellRect.width / 2 - TOOLTIP_W / 2;
  x = Math.max(4, Math.min(x, gridRect.width - TOOLTIP_W - 4));

  let y = cellRect.bottom - gridRect.top + gap;
  if (y + tooltipH > gridRect.height - 4) {
    y = cellRect.top - gridRect.top - tooltipH - gap;
  }
  y = Math.max(4, y);

  return { x, y };
}

export default function ProfilePage() {
  const { t, locale } = useI18n();
  const { title: displayTitle } = useAnimeDisplay();
  const monthLabels = locale === "en" ? en.months : zh.months;
  const monthShort = monthLabels.short;
  const monthLong = monthLabels.long;

  const formatMonthYear = (ym: string) => {
    const { year, month } = parseYYYYMM(ym);
    const name = monthLong[Math.max(0, Math.min(11, month - 1))] ?? ym;
    return locale === "zh" ? `${year}年${name}` : `${name} ${year}`;
  };

  const [startMonth, setStartMonth] = useState(START_DATE);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const gridWrapRef = useRef<HTMLDivElement | null>(null);
  const heatmapScrollRef = useRef<HTMLDivElement | null>(null);
  const hoverCellRef = useRef<HTMLElement | null>(null);
  const tooltipPosRef = useRef({ x: 0, y: 0 });
  const [tooltip, setTooltip] = useState<{
    open: boolean;
    month: string;
    hasActivity: boolean;
    cell: LifeMonthCell;
    x: number;
    y: number;
  } | null>(null);
  const heatmap = useQuery({
    queryKey: ["stats", "heatmap", { startMonth }],
    queryFn: () => getHeatmap({ start: startMonth }),
  });

  const summary = useQuery({
    queryKey: ["stats", "summary"],
    queryFn: () => getStatsSummary(),
  });

  const months = heatmap.data?.months ?? [];
  const monthByKey = useMemo(() => new Map(months.map((m) => [m.month, m])), [months]);

  const now = useMemo(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, []);

  const { startYear, startMonthNum, years } = useMemo(() => {
    const { year: sy, month: sm } = parseYYYYMM(startMonth);
    const endYear = now.year;
    const ys = Array.from({ length: Math.max(1, endYear - sy + 1) }, (_, i) => sy + i);
    return { startYear: sy, startMonthNum: sm, years: ys };
  }, [startMonth, now.year]);

  const activity = useQuery({
    queryKey: ["stats", "activity", { month: selectedMonth }],
    enabled: Boolean(selectedMonth),
    queryFn: async () => {
      if (!selectedMonth) throw new Error("Missing selectedMonth");
      return getMonthlyActivity({ month: selectedMonth });
    },
  });

  const heatmapReady = months.length > 0;

  const [gridMetrics, setGridMetrics] = useState<HeatmapGridMetrics>(DESKTOP_HEATMAP);

  const { colW: COL_W, colGap: COL_GAP, rowLabelW: ROW_LABEL_W } = gridMetrics;
  const colStep = COL_W + COL_GAP;
  const gridWidthPx = ROW_LABEL_W + years.length * colStep;
  const labelFontPx = COL_W >= 16 ? 11 : 10;
  const yearRowH = COL_W >= 16 ? 18 : 14;

  useLayoutEffect(() => {
    if (!heatmapReady) return;

    const update = () => {
      const el = heatmapScrollRef.current;
      setGridMetrics(computeHeatmapGridMetrics(years.length, el?.clientWidth ?? 0));
    };

    update();
    const raf = requestAnimationFrame(update);

    const el = heatmapScrollRef.current;
    const ro = el ? new ResizeObserver(update) : null;
    if (el && ro) ro.observe(el);
    window.addEventListener("resize", update);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [years.length, heatmapReady]);

  const visibleYearLabels = useMemo(
    () => computeVisibleYearLabels(years, startYear, now.year),
    [years, startYear, now.year],
  );

  useLayoutEffect(() => {
    if (!tooltip?.open || !tooltipRef.current || !gridWrapRef.current || !hoverCellRef.current) {
      return;
    }
    const tipH = tooltipRef.current.offsetHeight;
    const pos = computeHeatmapTooltipPos(hoverCellRef.current, gridWrapRef.current, tipH);
    if (Math.abs(pos.x - tooltip.x) > 0.5 || Math.abs(pos.y - tooltip.y) > 0.5) {
      setTooltip((prev) =>
        prev && prev.month === tooltip.month ? { ...prev, x: pos.x, y: pos.y } : prev,
      );
    }
  }, [tooltip?.open, tooltip?.month, tooltip?.x, tooltip?.y]);

  const loadErr = (err: unknown) =>
    `${t("common.loadFailed")}: ${err instanceof Error ? err.message : t("common.unknownError")}`;

  return (
    <AppShell>
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-sm font-semibold">{t("profile.stats")}</div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">{t("profile.totalCompleted")}</div>
            <div className="mt-1 text-2xl font-semibold">{summary.data?.totalCompleted ?? 0}</div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">{t("profile.totalEpisodes")}</div>
            <div className="mt-1 text-2xl font-semibold">{summary.data?.totalEpisodesWatched ?? 0}</div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold">{t("profile.heatmap")}</div>
          {heatmap.isLoading ? (
            <div className="text-xs text-zinc-500 dark:text-zinc-400">{t("common.loading")}</div>
          ) : heatmap.isError ? (
            <div className="text-xs text-red-600 dark:text-red-300">{t("common.loadFailed")}</div>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <span>{t("profile.legend")}</span>
          <span>{t("profile.legendLess")}</span>
          <div className="flex items-center gap-0.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`size-3 rounded-sm sm:size-4 ${intensityClass(i)} ring-1 ring-zinc-200/80 dark:ring-zinc-700`}
              />
            ))}
          </div>
          <span>{t("profile.legendMore")}</span>
        </div>

        <div className="mt-3 grid gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{t("profile.startMonth")}</span>
            <StartMonthPicker value={startMonth} onChange={setStartMonth} />
          </label>

          <div className="w-full max-w-full rounded-xl border border-zinc-200/80 bg-gradient-to-b from-zinc-50/90 to-white dark:border-zinc-800 dark:from-zinc-900/40 dark:to-zinc-950">
            {years.length > 8 ? (
              <p className="border-b border-zinc-100 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                {t("profile.heatmapScrollHint")}
              </p>
            ) : null}

            {months.length === 0 ? (
              <div className="p-4 text-sm text-zinc-500 dark:text-zinc-400">{t("common.noData")}</div>
            ) : (
              <div
                ref={heatmapScrollRef}
                className="relative max-w-full overflow-x-auto overflow-y-visible overscroll-x-contain px-3 py-2 pb-3 [scrollbar-width:thin]"
                style={{
                  WebkitOverflowScrolling: "touch",
                }}
              >
                <div className="mx-auto w-max max-w-full">
                  <div style={{ width: gridWidthPx }}>
                  <div
                    className="relative mb-1.5"
                    style={{ width: gridWidthPx, height: yearRowH }}
                  >
                    {visibleYearLabels.map((y) => {
                      const idx = years.indexOf(y);
                      const left = ROW_LABEL_W + idx * colStep + COL_W / 2;
                      return (
                        <span
                          key={y}
                          className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap font-medium tabular-nums text-zinc-500 dark:text-zinc-400"
                          style={{ left, fontSize: labelFontPx }}
                        >
                          <span className="sm:hidden">{String(y).slice(-2)}</span>
                          <span className="hidden sm:inline">{y}</span>
                        </span>
                      );
                    })}
                  </div>

                  <div
                    ref={gridWrapRef}
                    className="relative grid"
                    style={{
                      gridTemplateColumns: `${ROW_LABEL_W}px repeat(${years.length}, ${COL_W}px)`,
                      gap: COL_GAP,
                    }}
                    onMouseLeave={() => {
                      hoverCellRef.current = null;
                      setTooltip(null);
                    }}
                  >
                    {Array.from({ length: 12 }).map((_, monthIndex) => {
                      const m = monthIndex + 1;
                      const showMonthLabel = m % 2 === 1;
                      return (
                        <div key={m} className="contents">
                          <div
                            className={
                              "sticky left-0 z-10 flex items-center justify-end bg-gradient-to-r from-zinc-50 via-zinc-50/95 to-transparent pr-1 font-medium text-zinc-500 dark:from-zinc-900 dark:via-zinc-900/95 dark:text-zinc-400"
                            }
                            style={{ fontSize: labelFontPx }}
                          >
                            {showMonthLabel ? monthShort[monthIndex] : ""}
                          </div>
                          {years.map((y) => {
                            const isBeforeStart = y === startYear && m < startMonthNum;
                            const isAfterNow = y === now.year && m > now.month;
                            const key = `${y}-${String(m).padStart(2, "0")}`;
                            const cell = monthByKey.get(key) ?? {
                              month: key,
                              addedCount: 0,
                              completedCount: 0,
                              episodeCount: 0,
                              intensity: 0,
                            };

                            if (isBeforeStart) {
                              return (
                                <div
                                  key={key}
                                  className="rounded-sm opacity-0"
                                  style={{ width: COL_W, height: COL_W }}
                                  aria-hidden
                                />
                              );
                            }

                            const isSelected = selectedMonth === key;
                            const hasActivity =
                              (cell.addedCount ?? 0) > 0 ||
                              (cell.completedCount ?? 0) > 0 ||
                              (cell.episodeCount ?? 0) > 0;
                            const cls = isAfterNow
                              ? intensityClass(0)
                              : intensityClass(cell.intensity);
                            return (
                              <button
                                key={key}
                                type="button"
                                aria-label={formatMonthYear(key)}
                                className={`rounded-sm ring-1 ring-zinc-200/60 transition-transform hover:scale-110 hover:ring-emerald-400/60 dark:ring-zinc-700 ${cls} ${
                                  isSelected
                                    ? "ring-2 ring-emerald-500 ring-offset-1 ring-offset-zinc-50 dark:ring-offset-zinc-900"
                                    : ""
                                }`}
                                style={{ width: COL_W, height: COL_W }}
                                onMouseEnter={(e) => {
                                  const grid = gridWrapRef.current;
                                  if (!grid) return;
                                  hoverCellRef.current = e.currentTarget;
                                  const pos = computeHeatmapTooltipPos(e.currentTarget, grid);
                                  tooltipPosRef.current = pos;
                                  setTooltip({
                                    open: true,
                                    month: key,
                                    hasActivity: !isAfterNow && hasActivity,
                                    cell,
                                    x: pos.x,
                                    y: pos.y,
                                  });
                                }}
                                onClick={() =>
                                  setSelectedMonth((prev) => (prev === key ? null : key))
                                }
                              />
                            );
                          })}
                        </div>
                      );
                    })}

                    {tooltip?.open ? (
                      <div
                        ref={tooltipRef}
                        className="pointer-events-none absolute z-30 hidden w-[220px] rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg sm:block dark:border-zinc-800 dark:bg-zinc-950"
                        style={{
                          left: Math.max(4, tooltip.x),
                          top: Math.max(4, tooltip.y),
                        }}
                      >
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {formatMonthYear(tooltip.month)}
                        </div>
                        {tooltip.hasActivity ? (
                          <div className="mt-1 text-zinc-600 dark:text-zinc-300">
                            {t("profile.tooltipActivity", {
                              month: tooltip.cell.month,
                              added: tooltip.cell.addedCount,
                              completed: tooltip.cell.completedCount,
                              episodes: tooltip.cell.episodeCount,
                            })}
                          </div>
                        ) : (
                          <div className="mt-1 text-zinc-600 dark:text-zinc-300">
                            {t("profile.tooltipNoActivity", {
                              label: formatMonthYear(tooltip.month),
                            })}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
                </div>
              </div>
            )}
          </div>

          {selectedMonth ? (
            <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">
                  {t("profile.activityFor", { month: selectedMonth })}
                </div>
                <button
                  className="h-8 rounded-md border border-zinc-200 px-3 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  type="button"
                  onClick={() => setSelectedMonth(null)}
                >
                  {t("common.clearSelection")}
                </button>
              </div>

              {activity.isLoading ? (
                <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{t("common.loading")}</div>
              ) : activity.isError ? (
                <div className="mt-3 text-sm text-red-600 dark:text-red-300">{loadErr(activity.error)}</div>
              ) : !activity.data ? null : activity.data.added.length === 0 &&
                activity.data.completed.length === 0 ? (
                <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                  {t("profile.noActivityMonth")}
                </div>
              ) : (
                <div className="mt-4 grid gap-4">
                  <div className="grid gap-2">
                    <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                      {t("profile.completedSection")}
                    </div>
                    {activity.data.completed.length === 0 ? (
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">{t("common.none")}</div>
                    ) : (
                      <ul className="grid gap-2">
                        {activity.data.completed.map((e) => (
                          <li key={`c-${e.id}`} className="flex items-start gap-2">
                            <div className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">
                                {e.animeMeta
                                  ? displayTitle(e.animeMeta, e.malId)
                                  : `malId: ${e.malId}`}
                              </div>
                              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                {e.completedAt
                                  ? t("profile.completedAt", { date: e.completedAt })
                                  : ""}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                      {t("profile.addedSection")}
                    </div>
                    {activity.data.added.length === 0 ? (
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">{t("common.none")}</div>
                    ) : (
                      <ul className="grid gap-2">
                        {activity.data.added.map((e) => (
                          <li key={`a-${e.id}`} className="flex items-start gap-2">
                            <div className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">
                                {e.animeMeta
                                  ? displayTitle(e.animeMeta, e.malId)
                                  : `malId: ${e.malId}`}
                              </div>
                              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                {e.createdAt
                                  ? t("profile.createdAt", {
                                      date: e.createdAt.slice(0, 10),
                                    })
                                  : ""}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </section>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
