"use client";

import { AppShell } from "@/components/AppShell";
import { useQuery } from "@tanstack/react-query";
import Heatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";

import { getAnimeEntries, getHeatmap } from "@/lib/api";

export default function ProfilePage() {
  const heatmap = useQuery({
    queryKey: ["stats", "heatmap"],
    queryFn: () => getHeatmap(),
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

  const heatmapValues = heatmap.data ?? [];

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
          <div className="text-sm font-semibold">活跃度热图</div>
          {heatmap.isLoading ? (
            <div className="text-xs text-zinc-500 dark:text-zinc-400">加载中…</div>
          ) : heatmap.isError ? (
            <div className="text-xs text-red-600 dark:text-red-300">加载失败</div>
          ) : null}
        </div>

        <div className="mt-3 overflow-x-auto">
          <div className="min-w-[700px]">
            <Heatmap
              startDate={new Date(new Date().getTime() - 365 * 24 * 60 * 60 * 1000)}
              endDate={new Date()}
              values={heatmapValues}
              classForValue={(v) => {
                const c = v?.count ?? 0;
                if (!c) return "color-empty";
                if (c >= 5) return "color-github-4";
                if (c >= 3) return "color-github-3";
                if (c >= 2) return "color-github-2";
                return "color-github-1";
              }}
              showWeekdayLabels
            />
          </div>
        </div>
      </section>
    </AppShell>
  );
}

