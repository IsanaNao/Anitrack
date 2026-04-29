"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import type { LifeMonthCell } from "@/lib/api";
import { getAnimeEntries, getHeatmap } from "@/lib/api";

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

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMonthYear(ym: string) {
  const { year, month } = parseYYYYMM(ym);
  const name = MONTH_LABELS[Math.max(0, Math.min(11, month - 1))] ?? "Month";
  return `${name} ${year}`;
}

function monthKeyUTC(s: string | undefined) {
  if (!s) return null;
  // createdAt/updatedAt are ISO strings; completedAt is YYYY-MM-DD.
  // IMPORTANT: use UTC to match backend aggregation semantics.
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return dayjs.utc(s, "YYYY-MM-DD").format("YYYY-MM");
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return dayjs.utc(s).format("YYYY-MM");
  return dayjs.utc(s).isValid() ? dayjs.utc(s).format("YYYY-MM") : null;
}

export default function ProfilePage() {
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
  const rafRef = useRef<number | null>(null);

  const heatmap = useQuery({
    queryKey: ["stats", "heatmap", { startMonth }],
    queryFn: () => getHeatmap({ start: startMonth }),
  });

  const completedStats = useQuery({
    queryKey: ["anime", "stats", "completed"],
    queryFn: async () => {
      // Fetch all completed entries (paged) to compute totals robustly.
      const pageSize = 100;
      let page = 1;
      let totalPages = 1;
      let totalCompleted = 0;
      let totalEpisodesWatched = 0;

      do {
        const res = await getAnimeEntries({
          status: "COMPLETED",
          page,
          pageSize,
          sort: "updatedAt:desc",
        });
        totalPages = res.totalPages;
        totalCompleted = res.total;
        for (const e of res.items) totalEpisodesWatched += e.episodesWatched ?? 0;
        page += 1;
      } while (page <= totalPages && page <= 50);

      return { totalCompleted, totalEpisodesWatched };
    },
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

  // Load all entries once for activity list filtering.
  const allEntries = useQuery({
    queryKey: ["anime", "stats", "all"],
    queryFn: async () => {
      const pageSize = 100;
      let page = 1;
      let totalPages = 1;
      const items: Awaited<ReturnType<typeof getAnimeEntries>>["items"] = [];
      do {
        const res = await getAnimeEntries({ page, pageSize, sort: "updatedAt:desc" });
        totalPages = res.totalPages;
        items.push(...res.items);
        page += 1;
      } while (page <= totalPages && page <= 50);
      return items;
    },
  });

  const activity = useMemo(() => {
    if (!selectedMonth) return null;
    const items = allEntries.data ?? [];
    const added = items.filter((e) => monthKeyUTC(e.createdAt) === selectedMonth);
    const completed = items.filter(
      (e) => e.status === "COMPLETED" && monthKeyUTC(e.completedAt) === selectedMonth,
    );
    return { added, completed };
  }, [allEntries.data, selectedMonth]);

  useEffect(() => {
    if (!selectedMonth) return;
    if (process.env.NODE_ENV === "production") return;
    const items = allEntries.data ?? [];
    console.log("[profile] selectedMonth=", selectedMonth);
    console.log(
      "[profile] sample dates=",
      items.slice(0, 8).map((e) => ({
        id: e.id,
        status: e.status,
        createdAt: e.createdAt,
        createdKey: monthKeyUTC(e.createdAt),
        completedAt: e.completedAt,
        completedKey: monthKeyUTC(e.completedAt),
      })),
    );
  }, [allEntries.data, selectedMonth]);

  const CELL_SIZE_CLASS = "h-3.5 w-3.5"; // ~14px, close to GitHub density

  function scheduleTooltipUpdate() {
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      setTooltip((t) => {
        if (!t?.open) return t;
        return {
          ...t,
          x: tooltipPosRef.current.x,
          y: tooltipPosRef.current.y,
        };
      });
    });
  }

  useEffect(() => {
    return () => {
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <AppShell>
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-sm font-semibold">统计</div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">总观看部数（COMPLETED）</div>
            <div className="mt-1 text-2xl font-semibold">
              {completedStats.data?.totalCompleted ?? 0}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">已看总集数</div>
            <div className="mt-1 text-2xl font-semibold">
              {completedStats.data?.totalEpisodesWatched ?? 0}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">人生纸格（按月）</div>
          {heatmap.isLoading ? (
            <div className="text-xs text-zinc-500 dark:text-zinc-400">加载中…</div>
          ) : heatmap.isError ? (
            <div className="text-xs text-red-600 dark:text-red-300">加载失败</div>
          ) : null}
        </div>

        <div className="mt-3 grid gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">起始统计时间（YYYY-MM）</span>
            <input
              type="month"
              className="h-10 w-[200px] rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              min="1900-01"
              max="2100-12"
            />
          </label>

          <div className="relative min-h-[260px] rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            {months.length === 0 ? (
              <div className="text-sm text-zinc-500 dark:text-zinc-400">暂无数据</div>
            ) : (
              <div className="grid gap-2">
                {/* X axis: year labels */}
                <div
                  className="grid items-end gap-1"
                  style={{ gridTemplateColumns: `28px repeat(${years.length}, 1fr)` }}
                >
                  <div />
                  {years.map((y, idx) => {
                    const show = y === startYear || y === now.year || y % 5 === 0 || idx === 0;
                    return (
                      <div key={y} className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        {show ? y : ""}
                      </div>
                    );
                  })}
                </div>

                {/* Grid: Y axis months (rows) × years (cols) */}
                <div
                  ref={gridWrapRef}
                  className="grid gap-x-1 gap-y-1"
                  style={{ gridTemplateColumns: `28px repeat(${years.length}, 1fr)` }}
                  onMouseMove={(e) => {
                    if (!tooltip?.open) return;
                    const rect = gridWrapRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    tooltipPosRef.current = {
                      x: e.clientX - rect.left + 12,
                      y: e.clientY - rect.top + 12,
                    };
                    scheduleTooltipUpdate();
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {Array.from({ length: 12 }).map((_, monthIndex) => {
                    const m = monthIndex + 1;
                    const yLabel = m === 1 || m === 4 || m === 7 || m === 10;
                    return (
                      <div key={m} className="contents">
                        <div className="pr-2 text-right text-[10px] text-zinc-500 dark:text-zinc-400">
                          {yLabel ? MONTH_LABELS[monthIndex] : ""}
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
                            // Hide cells before START_DATE in the first year to create the "blank before start" feeling.
                            return <div key={key} className={`${CELL_SIZE_CLASS} opacity-0`} />;
                          }

                          const isSelected = selectedMonth === key;
                          const hasActivity =
                            (cell.addedCount ?? 0) > 0 ||
                            (cell.completedCount ?? 0) > 0 ||
                            (cell.episodeCount ?? 0) > 0;
                          const cls = isAfterNow ? intensityClass(0) : intensityClass(cell.intensity);
                          return (
                            <button
                              key={key}
                              type="button"
                              className={`${CELL_SIZE_CLASS} rounded border border-zinc-200 dark:border-zinc-800 ${cls} ${isSelected ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-white dark:ring-offset-zinc-950" : ""}`}
                              onMouseEnter={(e) => {
                                const rect = gridWrapRef.current?.getBoundingClientRect();
                                if (!rect) return;
                                tooltipPosRef.current = {
                                  x: e.clientX - rect.left + 12,
                                  y: e.clientY - rect.top + 12,
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
                              onClick={() => setSelectedMonth(key)}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Floating tooltip (GitHub-like) */}
            <div className="pointer-events-none absolute inset-0">
              {tooltip?.open ? (
                <div
                  ref={tooltipRef}
                  className="pointer-events-none absolute z-10 w-[240px] rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-lg dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                  style={{
                    left: Math.max(8, tooltip.x),
                    top: Math.max(8, tooltip.y),
                  }}
                >
                  <div className="font-semibold">{formatMonthYear(tooltip.month)}</div>
                  {tooltip.hasActivity ? (
                    <div className="mt-1 text-zinc-600 dark:text-zinc-300">
                      <div>
                        {tooltip.cell.month}: 加入 {tooltip.cell.addedCount}，完成{" "}
                        {tooltip.cell.completedCount}，观看 {tooltip.cell.episodeCount}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 text-zinc-600 dark:text-zinc-300">
                      No activity in {formatMonthYear(tooltip.month)}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* Activity panel (click-to-lock) */}
          {selectedMonth ? (
            <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">Activity for {selectedMonth}</div>
                <button
                  className="h-8 rounded-md border border-zinc-200 px-3 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  type="button"
                  onClick={() => setSelectedMonth(null)}
                >
                  清除选择
                </button>
              </div>

              {allEntries.isLoading ? (
                <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">加载中…</div>
              ) : allEntries.isError ? (
                <div className="mt-3 text-sm text-red-600 dark:text-red-300">加载失败</div>
              ) : !activity ? null : activity.added.length === 0 && activity.completed.length === 0 ? (
                <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                  No recorded activity for this month.
                </div>
              ) : (
                <div className="mt-4 grid gap-4">
                  {/* Timeline list */}
                  <div className="grid gap-2">
                    <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                      ✅ Completed
                    </div>
                    {activity.completed.length === 0 ? (
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">无</div>
                    ) : (
                      <ul className="grid gap-2">
                        {activity.completed.map((e) => (
                          <li key={`c-${e.id}`} className="flex items-start gap-2">
                            <div className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">
                                {e.animeMeta?.title ?? `malId: ${e.malId}`}
                              </div>
                              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                {e.completedAt ? `completedAt: ${e.completedAt}` : ""}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                      📥 Added
                    </div>
                    {activity.added.length === 0 ? (
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">无</div>
                    ) : (
                      <ul className="grid gap-2">
                        {activity.added.map((e) => (
                          <li key={`a-${e.id}`} className="flex items-start gap-2">
                            <div className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">
                                {e.animeMeta?.title ?? `malId: ${e.malId}`}
                              </div>
                              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                {e.createdAt ? `createdAt: ${e.createdAt.slice(0, 10)}` : ""}
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

