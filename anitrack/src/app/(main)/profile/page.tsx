"use client";

import { useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
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

  const COL_W = 11;
  const ROW_LABEL_W = 26;
  const gridWidthPx = ROW_LABEL_W + years.length * (COL_W + 2);

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

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
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
                className={`size-3 rounded-sm sm:size-3.5 ${intensityClass(i)} ring-1 ring-zinc-200/80 dark:ring-zinc-700`}
              />
            ))}
          </div>
          <span>{t("profile.legendMore")}</span>
        </div>

        <div className="mt-3 grid gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{t("profile.startMonth")}</span>
            <input
              type="month"
              className="h-10 w-full max-w-[220px] rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              min="1900-01"
              max="2100-12"
            />
          </label>

          <div className="w-full max-w-full overflow-hidden rounded-xl border border-zinc-200/80 bg-gradient-to-b from-zinc-50/90 to-white dark:border-zinc-800 dark:from-zinc-900/40 dark:to-zinc-950">
            {years.length > 8 ? (
              <p className="border-b border-zinc-100 px-3 py-1.5 text-[10px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                {t("profile.heatmapScrollHint")}
              </p>
            ) : null}

            {months.length === 0 ? (
              <div className="p-4 text-sm text-zinc-500 dark:text-zinc-400">{t("common.noData")}</div>
            ) : (
              <div
                className="relative max-w-full overflow-x-auto overscroll-x-contain px-2 py-3 [scrollbar-width:thin]"
                style={{
                  WebkitOverflowScrolling: "touch",
                }}
              >
                <div
                  className="inline-block min-w-0"
                  style={{ width: gridWidthPx }}
                >
                  <div
                    className="mb-1.5 grid gap-0.5"
                    style={{
                      gridTemplateColumns: `${ROW_LABEL_W}px repeat(${years.length}, ${COL_W}px)`,
                    }}
                  >
                    <div className="sticky left-0 z-20 bg-gradient-to-r from-zinc-50 via-zinc-50/95 to-transparent dark:from-zinc-900 dark:via-zinc-900/95" />
                    {years.map((y, idx) => {
                      const show =
                        y === startYear ||
                        y === now.year ||
                        y % 5 === 0 ||
                        idx === years.length - 1;
                      return (
                        <div
                          key={y}
                          className="flex h-4 items-end justify-center text-[9px] tabular-nums text-zinc-500 dark:text-zinc-400"
                        >
                          {show ? (
                            <>
                              <span className="font-medium sm:hidden">
                                {String(y).slice(-2)}
                              </span>
                              <span className="hidden font-medium sm:inline">{y}</span>
                            </>
                          ) : (
                            <span className="opacity-30" aria-hidden>
                              ·
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div
                    ref={gridWrapRef}
                    className="relative grid gap-0.5"
                    style={{
                      gridTemplateColumns: `${ROW_LABEL_W}px repeat(${years.length}, ${COL_W}px)`,
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    {Array.from({ length: 12 }).map((_, monthIndex) => {
                      const m = monthIndex + 1;
                      const showMonthLabel = m % 2 === 1;
                      return (
                        <div key={m} className="contents">
                          <div
                            className={
                              "sticky left-0 z-10 flex items-center justify-end bg-gradient-to-r from-zinc-50 via-zinc-50/95 to-transparent pr-1 text-[9px] font-medium text-zinc-500 dark:from-zinc-900 dark:via-zinc-900/95 dark:text-zinc-400"
                            }
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
                                  className="size-[11px] rounded-sm opacity-0"
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
                                className={`size-[11px] rounded-sm ring-1 ring-zinc-200/60 transition-transform hover:scale-110 hover:ring-emerald-400/60 dark:ring-zinc-700 ${cls} ${
                                  isSelected
                                    ? "ring-2 ring-emerald-500 ring-offset-1 ring-offset-zinc-50 dark:ring-offset-zinc-900"
                                    : ""
                                }`}
                                onMouseEnter={(e) => {
                                  const rect = gridWrapRef.current?.getBoundingClientRect();
                                  if (!rect) return;
                                  tooltipPosRef.current = {
                                    x: Math.min(
                                      rect.width - 200,
                                      e.clientX - rect.left + 8,
                                    ),
                                    y: e.clientY - rect.top + 8,
                                  };
                                  setTooltip({
                                    open: true,
                                    month: key,
                                    hasActivity: !isAfterNow && hasActivity,
                                    cell,
                                    x: tooltipPosRef.current.x,
                                    y: tooltipPosRef.current.y,
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
