"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AnimeEntryDialog } from "@/components/AnimeEntryDialog";
import { TimetableItemDetailDialog } from "@/components/TimetableItemDetailDialog";
import type { AnimeEntry } from "@/lib/api";
import {
  getTimetable,
  type TimetableDayApi,
  type TimetableItemApi,
} from "@/lib/api";

/** B 站式 `M-D`（去前导零可选） */
function formatMdShort(isoDate: string): string {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(m) || !Number.isFinite(d)) return isoDate;
  return `${m}-${d}`;
}

function todayYmdBerlin(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function countdownLabel(iso?: string): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const diff = t - Date.now();
  if (diff <= 0) return "已开播";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h >= 72) return `${Math.ceil(h / 24)} 天后`;
  if (h > 0) return `${h}小时${m}分`;
  if (m > 0) return `${m}分钟后`;
  return "即将播出";
}

function TimetableRow({ it, onSelect }: { it: TimetableItemApi; onSelect: (it: TimetableItemApi) => void }) {
  const cd = countdownLabel(it.nextAirAtIso);
  const hasTime = Boolean(it.airTimeLocal?.trim());

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- 排障：确认原始播出串与柏林钟面
      console.log("[Timetable]", "Original Time:", it.airTime, "Local:", it.airTimeLocal, "malId:", it.malId);
    }
  }, [it.airTime, it.airTimeLocal, it.malId]);

  return (
    <button
      type="button"
      onClick={() => onSelect(it)}
      className="group flex w-full cursor-pointer items-center gap-2.5 border-b border-pink-50/90 py-2.5 pr-0.5 text-left transition-colors hover:bg-pink-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 dark:border-zinc-800/90 dark:hover:bg-zinc-900/50"
    >
      <div className="w-11 shrink-0 text-right font-mono text-[12px] leading-tight tabular-nums text-slate-400 dark:text-zinc-500">
        {hasTime ? (
          <span className="text-slate-500 dark:text-zinc-400">{it.airTimeLocal}</span>
        ) : (
          <span className="text-slate-300 dark:text-zinc-600">TBD</span>
        )}
      </div>
      <div className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-200/90 dark:bg-zinc-800 dark:ring-zinc-700">
        {it.imageUrl ? (
          <img
            src={it.imageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400 dark:text-zinc-600">
            无封面
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium leading-snug text-slate-900 dark:text-zinc-100">
          {it.title}
        </div>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[12px] font-semibold text-[#fb7299] dark:text-rose-400">
            {it.episodeLabel}
          </span>
          {cd ? (
            <span className="text-[11px] text-slate-400 dark:text-zinc-500">{cd}</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function DayColumn({
  day,
  isToday,
  onSelectItem,
}: {
  day: TimetableDayApi;
  isToday: boolean;
  onSelectItem: (it: TimetableItemApi) => void;
}) {
  return (
    <div className="w-[200px] shrink-0 sm:w-[220px]">
      <div
        className={`mb-2 flex flex-col items-center gap-0.5 rounded-xl px-2 py-2.5 text-center ${
          isToday
            ? "bg-sky-50 ring-1 ring-sky-100 dark:bg-sky-950/35 dark:ring-sky-900/80"
            : "bg-slate-50/80 dark:bg-zinc-900/40"
        }`}
      >
        <span className="text-base leading-none opacity-90" aria-hidden>
          📺
        </span>
        <span className="font-mono text-[15px] font-semibold tracking-tight text-slate-800 dark:text-zinc-100">
          {formatMdShort(day.date)}
        </span>
        <span className="text-[12px] text-slate-500 dark:text-zinc-400">{day.weekdayLabel}</span>
      </div>

      {day.items.length === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl bg-gradient-to-b from-slate-50 to-white px-3 py-8 text-center text-[12px] leading-relaxed text-slate-400 dark:from-zinc-900 dark:to-zinc-950 dark:text-zinc-500">
          本日暂无
          <br />
          已映射条目
        </div>
      ) : (
        <div className="rounded-xl bg-white/60 dark:bg-transparent">
          {day.items.map((it) => (
            <TimetableRow key={`${day.date}-${it.malId}`} it={it} onSelect={onSelectItem} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TimetablePage() {
  const [range, setRange] = useState<"7d" | "14d">("7d");
  const [previewItem, setPreviewItem] = useState<TimetableItemApi | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [libraryEntry, setLibraryEntry] = useState<AnimeEntry | null>(null);
  const [libraryDialogOpen, setLibraryDialogOpen] = useState(false);
  const daysCount = range === "14d" ? 14 : 7;
  const scrollRef = useRef<HTMLDivElement>(null);

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const q = useQuery({
    queryKey: ["anime-meta", "timetable", daysCount],
    queryFn: () => getTimetable({ days: daysCount }),
  });

  const todayIso = todayYmdBerlin();

  const scrollBy = useCallback((delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  }, []);

  return (
    <AppShell>
      <TimetableItemDetailDialog
        open={previewOpen}
        onOpenChange={(v) => {
          setPreviewOpen(v);
          if (!v) setPreviewItem(null);
        }}
        item={previewItem}
        onOpenLibraryEntry={(entry) => {
          setLibraryEntry(entry);
          setLibraryDialogOpen(true);
        }}
      />
      <AnimeEntryDialog
        open={libraryDialogOpen}
        onOpenChange={(v) => {
          setLibraryDialogOpen(v);
          if (!v) setLibraryEntry(null);
        }}
        entry={libraryEntry}
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-end gap-6 text-sm">
            <span className="border-b-2 border-sky-400 pb-0.5 font-semibold text-slate-800 dark:border-sky-500 dark:text-zinc-100">
              新番时间表
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 p-0.5 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setRange("7d")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                range === "7d"
                  ? "bg-white text-sky-600 shadow-sm dark:bg-zinc-800 dark:text-sky-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              7 天
            </button>
            <button
              type="button"
              onClick={() => setRange("14d")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                range === "14d"
                  ? "bg-white text-sky-600 shadow-sm dark:bg-zinc-800 dark:text-sky-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              14 天
            </button>
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            aria-label="向左滚动"
            onClick={() => scrollBy(-320)}
            className="absolute left-1 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-lg text-slate-500 shadow-sm hover:bg-slate-50 md:flex dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="向右滚动"
            onClick={() => scrollBy(320)}
            className="absolute right-1 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-lg text-slate-500 shadow-sm hover:bg-slate-50 md:flex dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ›
          </button>

          {q.isLoading ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-zinc-400">加载中…</div>
          ) : q.isError ? (
            <div className="px-4 py-10 text-center text-sm text-red-600 dark:text-red-300">
              加载失败：{q.error instanceof Error ? q.error.message : "unknown"}
            </div>
          ) : !q.data?.days.length ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-zinc-400">暂无数据</div>
          ) : (
            <div
              ref={scrollRef}
              className="overflow-x-auto scroll-smooth px-3 pb-4 pt-3 sm:px-10 [scrollbar-width:thin]"
            >
              <div className="inline-flex min-h-[280px] items-stretch divide-x divide-dashed divide-slate-200 dark:divide-zinc-800">
                {q.data.days.map((day) => (
                  <DayColumn
                    key={day.date}
                    day={day}
                    isToday={day.date === todayIso}
                    onSelectItem={(it) => {
                      setPreviewItem(it);
                      setPreviewOpen(true);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="border-t border-slate-100 px-4 py-2.5 text-center text-[11px] leading-relaxed text-slate-400 dark:border-zinc-800 dark:text-zinc-500">
          数据来自已映射 Bangumi 的当季镜像 · 时间已换算为{" "}
          <span className="font-medium text-slate-500 dark:text-zinc-400">
            {q.data?.timezone ?? "Europe/Berlin"}
          </span>{" "}
          （德国中部时区）· 点击条目可查看简介并加入追番清单
        </p>
      </div>
    </AppShell>
  );
}
