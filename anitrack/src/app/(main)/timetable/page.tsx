"use client";

import { useQuery } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
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
import { formatWeekdayBerlin } from "@/lib/formatBerlinDate";
import type { createTranslator } from "@/i18n/translate";

const COL_W = 200;

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
      className="group w-full cursor-pointer rounded-lg px-1.5 py-2 text-left transition-colors hover:bg-pink-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-400 dark:hover:bg-zinc-900/60"
    >
      <div className="mb-1.5 font-mono text-[11px] leading-none tabular-nums text-slate-400 dark:text-zinc-500">
        {hasTime ? (
          <span className="font-medium text-slate-600 dark:text-zinc-300">{it.airTimeLocal}</span>
        ) : (
          <span className="text-slate-300 dark:text-zinc-600">{t("common.tbd")}</span>
        )}
      </div>
      <div className="flex gap-2">
        <div className="h-[54px] w-[38px] shrink-0 overflow-hidden rounded bg-slate-100 ring-1 ring-slate-200/90 dark:bg-zinc-800 dark:ring-zinc-700">
          {it.imageUrl ? (
            <img src={it.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[9px] text-slate-400 dark:text-zinc-600">
              {t("common.noImage")}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-[12px] font-medium leading-snug text-slate-900 dark:text-zinc-100">
            {displayTitle}
          </div>
          <div className="mt-0.5 text-[11px] font-semibold text-[#fb7299] dark:text-rose-400">
            {episodeLabel}
          </div>
          {cd ? (
            <div className="mt-0.5 text-[10px] text-slate-400 dark:text-zinc-500">{cd}</div>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function NowMarker({ time, t }: { time: string; t: ReturnType<typeof createTranslator> }) {
  return (
    <div
      className="my-1 flex items-center gap-1.5 px-1.5"
      aria-label={t("timetable.nowMarker", { time })}
    >
      <span className="text-violet-500 dark:text-violet-400" aria-hidden>
        🕐
      </span>
      <span className="font-mono text-[10px] font-semibold tabular-nums text-violet-600 dark:text-violet-400">
        {t("timetable.nowMarker", { time })}
      </span>
      <div className="h-px flex-1 bg-violet-300/80 dark:bg-violet-800/80" />
    </div>
  );
}

function DayColumn({
  day,
  isToday,
  onSelectItem,
  titleFor,
  t,
  locale,
  colRef,
}: {
  day: TimetableDayApi;
  isToday: boolean;
  onSelectItem: (it: TimetableItemApi) => void;
  titleFor: (it: TimetableItemApi) => string;
  t: ReturnType<typeof createTranslator>;
  locale: "zh" | "en";
  colRef?: (el: HTMLDivElement | null) => void;
}) {
  const emptyLines = t("timetable.emptyDay").split("\n");
  const nowClock = nowClockBerlin();
  const weekdayLabel = formatWeekdayBerlin(day.date, locale);

  return (
    <div
      ref={colRef}
      className={
        "flex shrink-0 snap-center flex-col border-r border-slate-100 last:border-r-0 dark:border-zinc-800 " +
        (isToday ? "bg-violet-50/30 dark:bg-violet-950/10" : "")
      }
      style={{ width: COL_W }}
    >
      <div
        className={
          "sticky top-0 z-[1] border-b border-slate-100 px-3 py-2.5 dark:border-zinc-800 " +
          (isToday
            ? "bg-violet-50/90 dark:bg-violet-950/40"
            : "bg-white/95 dark:bg-zinc-950/95")
        }
      >
        <div className="flex items-baseline gap-1.5">
          <span
            className={
              "font-mono text-[15px] font-bold tabular-nums " +
              (isToday ? "text-violet-700 dark:text-violet-300" : "text-slate-900 dark:text-zinc-100")
            }
          >
            {day.dateLabel}
          </span>
          <span className="text-[12px] text-slate-500 dark:text-zinc-400">{weekdayLabel}</span>
        </div>
        {isToday ? (
          <span className="mt-0.5 inline-block text-[10px] font-medium text-violet-500 dark:text-violet-400">
            {t("timetable.today")}
          </span>
        ) : null}
      </div>

      <div className="flex-1 px-1 py-1">
        {day.items.length === 0 ? (
          <div className="flex min-h-[120px] flex-col items-center justify-center px-2 py-6 text-center text-[11px] leading-relaxed text-slate-400 dark:text-zinc-500">
            {emptyLines.map((line, i) => (
              <span key={i}>
                {line}
                {i < emptyLines.length - 1 ? <br /> : null}
              </span>
            ))}
          </div>
        ) : (
          <DayItems
            day={day}
            isToday={isToday}
            nowClock={nowClock}
            onSelectItem={onSelectItem}
            titleFor={titleFor}
            t={t}
          />
        )}
      </div>
    </div>
  );
}

function DayItems({
  day,
  isToday,
  nowClock,
  onSelectItem,
  titleFor,
  t,
}: {
  day: TimetableDayApi;
  isToday: boolean;
  nowClock: string;
  onSelectItem: (it: TimetableItemApi) => void;
  titleFor: (it: TimetableItemApi) => string;
  t: ReturnType<typeof createTranslator>;
}) {
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

  return <>{rows}</>;
}

function ScrollButton({
  direction,
  onClick,
  label,
}: {
  direction: "left" | "right";
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={
        "absolute top-1/2 z-[5] flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-600 shadow-md backdrop-blur-sm transition hover:bg-white hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 " +
        (direction === "left" ? "left-1" : "right-1")
      }
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
        aria-hidden
      >
        {direction === "left" ? (
          <path d="M15 18l-6-6 6-6" />
        ) : (
          <path d="M9 18l6-6-6-6" />
        )}
      </svg>
    </button>
  );
}

export default function TimetablePage() {
  const { t, locale } = useI18n();
  const { title: pickTitle } = useAnimeDisplay();
  const todayIso = todayYmdBerlin();
  const [previewItem, setPreviewItem] = useState<TimetableItemApi | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [libraryEntry, setLibraryEntry] = useState<AnimeEntry | null>(null);
  const [libraryDialogOpen, setLibraryDialogOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayColRef = useRef<HTMLDivElement | null>(null);

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

  const orderedDays = q.data?.days ?? [];

  const scrollToToday = useCallback(() => {
    const scroll = scrollRef.current;
    const col = todayColRef.current;
    if (!scroll || !col) return;
    const left = col.offsetLeft - scroll.clientWidth / 2 + col.clientWidth / 2;
    scroll.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!orderedDays.length) return;
    const id = window.requestAnimationFrame(scrollToToday);
    return () => window.cancelAnimationFrame(id);
  }, [orderedDays, scrollToToday]);

  const scrollByCols = useCallback((dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * COL_W * 2, behavior: "smooth" });
  }, []);

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
          <div className="relative">
            <ScrollButton
              direction="left"
              onClick={() => scrollByCols(-1)}
              label={t("timetable.scrollLeft")}
            />
            <ScrollButton
              direction="right"
              onClick={() => scrollByCols(1)}
              label={t("timetable.scrollRight")}
            />
            <div
              ref={scrollRef}
              className="flex overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:thin] snap-x snap-mandatory"
              role="list"
              aria-label={t("timetable.pickDay")}
            >
              {orderedDays.map((day) => {
                const isToday = day.date === todayIso;
                return (
                  <DayColumn
                    key={day.date}
                    day={day}
                    isToday={isToday}
                    locale={locale}
                    colRef={isToday ? (el) => { todayColRef.current = el; } : undefined}
                    onSelectItem={(it) => {
                      setPreviewItem(it);
                      setPreviewOpen(true);
                    }}
                    titleFor={titleFor}
                    t={t}
                  />
                );
              })}
            </div>
          </div>
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
