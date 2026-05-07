"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";

type TimetableItem = {
  id: string;
  time: string; // HH:mm
  title: string;
  episodeLabel: string;
  imageUrl?: string;
};

type TimetableDay = {
  dateLabel: string; // e.g. 5/7
  weekdayLabel: string; // e.g. 周四
  items: TimetableItem[];
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toDateLabel(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const WEEKDAY_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;

function mockTimetable(days = 7): TimetableDay[] {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const out: TimetableDay[] = [];

  const covers = [
    "https://cdn.myanimelist.net/images/anime/1765/135099.jpg",
    "https://cdn.myanimelist.net/images/anime/1223/96541.jpg",
    "https://cdn.myanimelist.net/images/anime/1743/111427.jpg",
    "https://cdn.myanimelist.net/images/anime/1506/112575.jpg",
  ];

  for (let i = 0; i < days; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const dateLabel = toDateLabel(d);
    const weekdayLabel = WEEKDAY_ZH[d.getDay()] ?? "周?";

    const count = 4 + ((i * 3) % 4);
    const items: TimetableItem[] = [];
    for (let k = 0; k < count; k++) {
      const hh = 10 + ((k * 2 + i) % 11);
      const mm = k % 2 === 0 ? 30 : 0;
      items.push({
        id: `${i}-${k}`,
        time: `${pad2(hh)}:${pad2(mm)}`,
        title: `新番标题占位 ${i + 1}-${k + 1}`,
        episodeLabel: `第 ${3 + k} 话`,
        imageUrl: covers[(i + k) % covers.length],
      });
    }

    out.push({ dateLabel, weekdayLabel, items });
  }

  return out;
}

export default function TimetablePage() {
  const [range, setRange] = useState<"7d" | "14d">("7d");
  const days = range === "14d" ? 14 : 7;
  const data = useMemo(() => mockTimetable(days), [days]);

  return (
    <AppShell>
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold">Timetable</div>
            <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              新番时间表（UI 先占位，后续接入 Jikan / 后端聚合）。
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRange("7d")}
              className={`h-9 rounded-md border px-3 text-sm font-medium ${
                range === "7d"
                  ? "border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900"
                  : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              }`}
            >
              7 天
            </button>
            <button
              type="button"
              onClick={() => setRange("14d")}
              className={`h-9 rounded-md border px-3 text-sm font-medium ${
                range === "14d"
                  ? "border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900"
                  : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              }`}
            >
              14 天
            </button>
          </div>
        </div>

        <div className="-mx-4 mt-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
          <div className="flex min-w-max gap-6">
            {data.map((day) => (
              <div key={`${day.dateLabel}-${day.weekdayLabel}`} className="w-[280px] shrink-0">
                <div className="sticky top-[56px] z-[1] rounded-lg border border-zinc-200 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
                  <div className="text-sm font-semibold">
                    {day.dateLabel}
                    <span className="ml-2 text-zinc-500 dark:text-zinc-400">{day.weekdayLabel}</span>
                  </div>
                </div>

                <div className="mt-3 grid gap-3">
                  {day.items.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <div className="w-[44px] shrink-0 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                        {it.time}
                      </div>
                      <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-900">
                        {it.imageUrl ? (
                          <img
                            src={it.imageUrl}
                            alt={it.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{it.title}</div>
                        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {it.episodeLabel}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}

