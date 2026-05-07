"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AnimeEntry } from "@/lib/api";
import { getAnimeEntries, getStatsSummary } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { AnimeCard } from "@/components/AnimeCard";
import { AnimeEntryDialog } from "@/components/AnimeEntryDialog";

export default function DashboardPage() {
  const watchingNowRef = useRef<HTMLDivElement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<AnimeEntry | null>(null);

  const summary = useQuery({
    queryKey: ["anime", "dashboard", "summary"],
    queryFn: () => getStatsSummary(),
  });

  const recent = useQuery({
    queryKey: ["anime", "dashboard", { status: "WATCHING", page: 1, pageSize: 8, sort: "updatedAt:desc" }],
    queryFn: () =>
      getAnimeEntries({
        status: "WATCHING",
        page: 1,
        pageSize: 8,
        sort: "updatedAt:desc",
      }),
  });

  useEffect(() => {
    const el = watchingNowRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!watchingNowRef.current) return;
      const canScroll = el.scrollWidth > el.clientWidth;
      if (!canScroll) return;

      // When the cursor is over this container, convert vertical wheel to horizontal scrolling
      // and prevent the outer page from scrolling.
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel as any);
  }, []);

  return (
    <AppShell>
      <AnimeEntryDialog open={dialogOpen} onOpenChange={setDialogOpen} entry={selectedEntry} />
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Profile & Stats</div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              快速概览（评分样本：{summary.data?.ratedCount ?? 0}）
            </div>
          </div>
          <Link
            href="/profile"
            className="h-9 rounded-md border border-zinc-200 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            进入 Profile
          </Link>
        </div>

        {summary.isLoading ? (
          <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">加载中…</div>
        ) : summary.isError ? (
          <div className="mt-3 text-sm text-red-600 dark:text-red-300">
            加载失败：{summary.error instanceof Error ? summary.error.message : "unknown error"}
          </div>
        ) : !summary.data ? (
          <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">暂无数据</div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">清单总数</div>
              <div className="mt-1 text-2xl font-semibold">{summary.data.total}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">已完成（COMPLETED）</div>
              <div className="mt-1 text-2xl font-semibold">{summary.data.totalCompleted}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">平均评分（样本）</div>
              <div className="mt-1 text-2xl font-semibold">
                {summary.data.avgRating != null ? summary.data.avgRating : "—"}
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                正在观看：{summary.data.totalWatching}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">正在观看（精选）</div>
          <Link
            href="/library"
            className="h-9 rounded-md border border-zinc-200 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            查看更多
          </Link>
        </div>

        {recent.isLoading ? (
          <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">加载中…</div>
        ) : recent.isError ? (
          <div className="mt-3 text-sm text-red-600 dark:text-red-300">
            加载失败：{recent.error instanceof Error ? recent.error.message : "unknown error"}
          </div>
        ) : !recent.data ? (
          <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">暂无数据</div>
        ) : recent.data.items.length === 0 ? (
          <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">暂无条目</div>
        ) : (
          <div
            ref={watchingNowRef}
            className="-mx-4 mt-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]"
          >
            {recent.data.items.map((e) => (
              <div key={e.id} className="w-[220px] shrink-0">
                <button
                  className="block w-full text-left"
                  type="button"
                  onClick={() => {
                    setSelectedEntry(e);
                    setDialogOpen(true);
                  }}
                >
                  <AnimeCard
                    title={e.animeMeta?.title ?? `malId: ${e.malId}`}
                    imageUrl={e.animeMeta?.imageUrl}
                    status={e.status}
                    malId={e.malId}
                    genres={e.animeMeta?.genres}
                    totalEpisodes={e.animeMeta?.totalEpisodes ?? e.animeMeta?.episodes}
                    episodesWatched={e.episodesWatched}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">新番随机推荐（占位）</div>
          <button
            type="button"
            disabled
            className="h-9 rounded-md border border-zinc-200 px-3 text-sm font-medium text-zinc-400 dark:border-zinc-800 dark:text-zinc-500"
            title="后续将接入推荐接口"
          >
            换一批
          </button>
        </div>
        <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          这里将展示每日随机推荐的新番（后续接入 Jikan 随机 + Library 标签）。
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] w-full rounded-xl border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/30"
            />
          ))}
        </div>
      </section>
    </AppShell>
  );
}

