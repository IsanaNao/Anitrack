"use client";

import { useQuery } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { AppShell } from "@/components/AppShell";
import { AnimeEntryDialog } from "@/components/AnimeEntryDialog";
import { TimetableItemDetailDialog } from "@/components/TimetableItemDetailDialog";
import type { AnimeEntry } from "@/lib/api";
import {
  getTimetable,
  TIMETABLE_WINDOW_DAYS,
  type TimetableDayApi,
  type TimetableItemApi,
} from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import { useAnimeDisplay } from "@/i18n/useAnimeDisplay";
import type { createTranslator } from "@/i18n/translate";

function todayYmdBerlin(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function nowClockBerlin(): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function countdownLabel(
  iso: string | undefined,
  t: ReturnType<typeof createTranslator>,
): string | null {
  if (!iso) return null;
  const target = Date.parse(iso);
  if (!Number.isFinite(target)) return null;
  const diff = target - Date.now();
  if (diff <= 0) return t("timetable.aired");
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h >= 72) return t("timetable.inDays", { days: Math.ceil(h / 24) });
  if (h > 0) return t("timetable.inHours", { hours: h, minutes: m });
  if (m > 0) return t("timetable.inMinutes", { minutes: m });
  return t("timetable.airingSoon");
}

function TimetableRow({
  it,
  onSelect,
  displayTitle,
  t,
}: {
  it: TimetableItemApi;
  onSelect: (it: TimetableItemApi) => void;
  displayTitle: string;
  t: ReturnType<typeof createTranslator>;
}) {
  const cd = countdownLabel(it.nextAirAtIso, t);
  const hasTime = Boolean(it.airTimeLocal?.trim());
  const episodeLabel =
    it.episodeLabel === "Seasonal" ? t("timetable.episodeSeasonal") : it.episodeLabel;

  return (
    <button
      type="button"
      onClick={() => onSelect(it)}
      className="group flex w-full cursor-pointer items-center gap-2.5 border-b border-pink-50/90 py-3 pr-0.5 text-left transition-colors hover:bg-pink-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 dark:border-zinc-800/90 dark:hover:bg-zinc-900/50"
    >
      <div className="w-11 shrink-0 text-right font-mono text-[12px] leading-tight tabular-nums text-slate-400 dark:text-zinc-500">
        {hasTime ? (
          <span className="text-slate-600 dark:text-zinc-300">{it.airTimeLocal}</span>
        ) : (
          <span className="text-slate-300 dark:text-zinc-600">{t("common.tbd")}</span>
        )}
      </div>
      <div className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-200/90 dark:bg-zinc-800 dark:ring-zinc-700">
        {it.imageUrl ? (
          <img src={it.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400 dark:text-zinc-600">
            {t("common.noImage")}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium leading-snug text-slate-900 dark:text-zinc-100">
          {displayTitle}
        </div>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[12px] font-semibold text-[#fb7299] dark:text-rose-400">
            {episodeLabel}
          </span>
          {cd ? (
            <span className="text-[11px] text-slate-400 dark:text-zinc-500">{cd}</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function NowMarker({ time, t }: { time: string; t: ReturnType<typeof createTranslator> }) {
  return (
    <div
      className="flex items-center gap-2 border-b border-violet-200/80 py-2 dark:border-violet-900/60"
      aria-label={t("timetable.nowMarker", { time })}
    >
      <span className="text-violet-500 dark:text-violet-400" aria-hidden>
        🕐
      </span>
      <span className="font-mono text-[12px] font-semibold tabular-nums text-violet-600 dark:text-violet-400">
        {t("timetable.nowMarker", { time })}
      </span>
      <div className="h-px flex-1 bg-violet-300/80 dark:bg-violet-800/80" />
    </div>
  );
}

function DaySchedule({
  day,
  isToday,
  onSelectItem,
  titleFor,
  t,
}: {
  day: TimetableDayApi;
  isToday: boolean;
  onSelectItem: (it: TimetableItemApi) => void;
  titleFor: (it: TimetableItemApi) => string;
  t: ReturnType<typeof createTranslator>;
}) {
  const emptyLines = t("timetable.emptyDay").split("\n");
  const nowClock = nowClockBerlin();

  if (day.items.length === 0) {
    return (
      <div className="flex min-h-[180px] flex-col items-center justify-center px-4 py-10 text-center text-[13px] leading-relaxed text-slate-400 dark:text-zinc-500">
        {emptyLines.map((line, i) => (
          <span key={i}>
            {line}
            {i < emptyLines.length - 1 ? <br /> : null}
          </span>
        ))}
      </div>
    );
  }

  const rows: ReactNode[] = [];
  let nowInserted = false;

  for (const it of day.items) {
    const clock = it.airTimeLocal?.trim() ?? "";
    if (isToday && !nowInserted && clock && clock.localeCompare(nowClock) > 0) {
      rows.push(<NowMarker key="now-marker" time={nowClock} t={t} />);
      nowInserted = true;
    }
    rows.push(
      <TimetableRow
        key={`${day.date}-${it.malId}`}
        it={it}
        onSelect={onSelectItem}
        displayTitle={titleFor(it)}
        t={t}
      />,
    );
  }

  if (isToday && !nowInserted) {
    rows.push(<NowMarker key="now-marker-end" time={nowClock} t={t} />);
  }

  return <div className="rounded-xl bg-white dark:bg-transparent">{rows}</div>;
}

export default function TimetablePage() {
  const { t } = useI18n();
  const { title: pickTitle } = useAnimeDisplay();
  const todayIso = todayYmdBerlin();
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [previewItem, setPreviewItem] = useState<TimetableItemApi | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [libraryEntry, setLibraryEntry] = useState<AnimeEntry | null>(null);
  const [libraryDialogOpen, setLibraryDialogOpen] = useState(false);
  const dateStripRef = useRef<HTMLDivElement>(null);
  const dateBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const q = useQuery({
    queryKey: ["anime-meta", "timetable", TIMETABLE_WINDOW_DAYS],
    queryFn: () =>
      getTimetable({
        pastDays: TIMETABLE_WINDOW_DAYS,
        futureDays: TIMETABLE_WINDOW_DAYS,
      }),
  });

  const dayByDate = useMemo(() => {
    const m = new Map<string, TimetableDayApi>();
    for (const d of q.data?.days ?? []) m.set(d.date, d);
    return m;
  }, [q.data?.days]);

  const orderedDays = q.data?.days ?? [];

  useEffect(() => {
    if (!orderedDays.length) return;
    if (!dayByDate.has(selectedDate)) {
      const fallback =
        orderedDays.find((d) => d.date === todayIso)?.date ?? orderedDays[0]?.date;
      if (fallback) setSelectedDate(fallback);
    }
  }, [orderedDays, dayByDate, selectedDate, todayIso]);

  const scrollDateIntoView = useCallback((date: string) => {
    const btn = dateBtnRefs.current.get(date);
    const strip = dateStripRef.current;
    if (!btn || !strip) return;
    const left = btn.offsetLeft - strip.clientWidth / 2 + btn.clientWidth / 2;
    strip.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!q.data?.days.length) return;
    scrollDateIntoView(selectedDate);
  }, [q.data?.days, selectedDate, scrollDateIntoView]);

  const selectedDay = dayByDate.get(selectedDate);
  const titleFor = (it: TimetableItemApi) => pickTitle(it, it.malId);

  const loadErr = (err: unknown) =>
    `${t("common.loadFailed")}: ${err instanceof Error ? err.message : t("common.unknownError")}`;

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
        <div className="border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
          <h1 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
            {t("timetable.title")}
          </h1>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
            {t("timetable.dateRangeHint", { weeks: 2 })}
          </p>
        </div>

        {q.isLoading ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-zinc-400">
            {t("common.loading")}
          </div>
        ) : q.isError ? (
          <div className="px-4 py-10 text-center text-sm text-red-600 dark:text-red-300">
            {loadErr(q.error)}
          </div>
        ) : !orderedDays.length ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-zinc-400">
            {t("common.noData")}
          </div>
        ) : (
          <>
            <div
              ref={dateStripRef}
              className="flex gap-1 overflow-x-auto overscroll-x-contain border-b border-slate-100 px-2 py-2 [scrollbar-width:thin] dark:border-zinc-800"
              role="tablist"
              aria-label={t("timetable.pickDay")}
            >
              {orderedDays.map((day) => {
                const active = day.date === selectedDate;
                const isToday = day.date === todayIso;
                return (
                  <button
                    key={day.date}
                    ref={(el) => {
                      if (el) dateBtnRefs.current.set(day.date, el);
                      else dateBtnRefs.current.delete(day.date);
                    }}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedDate(day.date)}
                    className={
                      "flex min-w-[3.25rem] shrink-0 flex-col items-center rounded-lg px-2.5 py-2 transition-colors " +
                      (active
                        ? "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
                        : "text-slate-600 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-900")
                    }
                  >
                    <span
                      className={
                        "font-mono text-[13px] font-semibold tabular-nums " +
                        (active ? "text-violet-700 dark:text-violet-300" : "")
                      }
                    >
                      {day.dateLabel}
                    </span>
                    <span className="mt-0.5 text-[11px]">{day.weekdayLabel}</span>
                    {isToday ? (
                      <span className="mt-1 text-[10px] font-medium text-violet-500 dark:text-violet-400">
                        {t("timetable.today")}
                      </span>
                    ) : (
                      <span className="mt-1 h-[14px]" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>

            {selectedDay ? (
              <DaySchedule
                day={selectedDay}
                isToday={selectedDay.date === todayIso}
                onSelectItem={(it) => {
                  setPreviewItem(it);
                  setPreviewOpen(true);
                }}
                titleFor={titleFor}
                t={t}
              />
            ) : null}
          </>
        )}

        <p className="border-t border-slate-100 px-4 py-2.5 text-center text-[11px] leading-relaxed text-slate-400 dark:border-zinc-800 dark:text-zinc-500">
          {t("timetable.footer", {
            timezone: q.data?.timezone ?? "Europe/Berlin",
          })}
        </p>
      </div>
    </AppShell>
  );
}
