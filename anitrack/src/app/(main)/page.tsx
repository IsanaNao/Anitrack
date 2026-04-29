"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getAnimeEntries } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { AnimeCard } from "@/components/AnimeCard";

export default function DashboardPage() {
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

  return (
    <AppShell>
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-1">
          <div className="text-sm font-semibold">Profile & Stats（占位）</div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            阶段 4：这里将展示个人概览与关键统计（总观看数、平均分等）。
          </div>
        </div>
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
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {recent.data.items.map((e) => (
              <AnimeCard
                key={e.id}
                title={e.animeMeta?.title ?? `malId: ${e.malId}`}
                imageUrl={e.animeMeta?.imageUrl}
                status={e.status}
                malId={e.malId}
                genres={e.animeMeta?.genres}
                totalEpisodes={e.animeMeta?.totalEpisodes ?? e.animeMeta?.episodes}
                episodesWatched={e.episodesWatched}
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-sm font-semibold">Heatmap（占位）</div>
        <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          预留绿墙组件位置，后续接入 <code className="px-1">/api/stats/heatmap</code>。
        </div>
      </section>
    </AppShell>
  );
}

