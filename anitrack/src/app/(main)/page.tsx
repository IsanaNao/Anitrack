"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AnimeEntry, AnimeMeta } from "@/lib/api";
import {
  ApiClientError,
  createAnimeEntry,
  getAnimeEntries,
  getSeasonalRandomPicks,
  getStatsSummary,
} from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { AnimeCard } from "@/components/AnimeCard";
import { AnimeEntryDialog } from "@/components/AnimeEntryDialog";
import { SeasonalPickDetailDialog } from "@/components/SeasonalPickDetailDialog";
import { toast } from "sonner";

export default function DashboardPage() {
  const watchingNowRef = useRef<HTMLDivElement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<AnimeEntry | null>(null);
  const [seasonalPickNonce, setSeasonalPickNonce] = useState(0);
  const [seasonalDetailOpen, setSeasonalDetailOpen] = useState(false);
  const [seasonalDetailMeta, setSeasonalDetailMeta] = useState<AnimeMeta | null>(null);
  const queryClient = useQueryClient();

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

  const seasonalPicks = useQuery({
    queryKey: ["anime-meta", "seasonal-random", seasonalPickNonce],
    queryFn: () => getSeasonalRandomPicks({ limit: 4 }),
  });

  const addFromRecommend = useMutation({
    mutationFn: (vars: { malId: number; title: string }) =>
      createAnimeEntry({ malId: vars.malId, status: "PLANNED" }),
    onSuccess: (entry) => {
      void queryClient.invalidateQueries({ queryKey: ["anime"] });
      setSeasonalDetailOpen(false);
      setSeasonalDetailMeta(null);
      const title =
        entry.animeMeta && typeof entry.animeMeta.title === "string"
          ? entry.animeMeta.title
          : `malId: ${entry.malId}`;
      toast.success("已加入清单", { description: title });
    },
    onError: (e: unknown, vars) => {
      if (
        e instanceof ApiClientError &&
        e.status === 409 &&
        e.details?.some((d) => d.path === "malId")
      ) {
        toast.info("已在清单中", { description: vars.title });
        return;
      }
      const msg = e instanceof Error ? e.message : "添加失败";
      toast.error("添加失败", { description: msg });
    },
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
      <SeasonalPickDetailDialog
        open={seasonalDetailOpen}
        onOpenChange={(v) => {
          setSeasonalDetailOpen(v);
          if (!v) setSeasonalDetailMeta(null);
        }}
        meta={seasonalDetailMeta}
        addPending={addFromRecommend.isPending}
        onAddToList={() => {
          if (!seasonalDetailMeta) return;
          addFromRecommend.mutate({
            malId: seasonalDetailMeta.malId,
            title: seasonalDetailMeta.title,
          });
        }}
      />
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
          <div className="text-sm font-semibold">新番随机推荐</div>
          <button
            type="button"
            disabled={seasonalPicks.isFetching}
            onClick={() => {
              setSeasonalPickNonce((n) => n + 1);
            }}
            className="h-9 rounded-md border border-zinc-200 px-3 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            title="从 Bee 已镜像的当季库中重新抽样（不请求 Jikan）"
          >
            {seasonalPicks.isFetching ? "加载中…" : "换一批"}
          </button>
        </div>
        <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          数据来自 MongoDB <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-900">AnimeMirror</code>{" "}
          中 <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-900">tier=seasonal</code>{" "}
          的已同步条目；读路径不调用 Jikan。
        </div>

        {seasonalPicks.isLoading ? (
          <div className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">加载中…</div>
        ) : seasonalPicks.isError ? (
          <div className="mt-4 text-sm text-red-600 dark:text-red-300">
            加载失败：{seasonalPicks.error instanceof Error ? seasonalPicks.error.message : "unknown error"}
          </div>
        ) : !seasonalPicks.data?.items.length ? (
          <div className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            暂无当季镜像数据。请确认 Bee 已运行（例如环境变量{" "}
            <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-900">SYNC_ENABLED=true</code>
            ）且 <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-900">/seasons/now</code>{" "}
            队列已同步到数据库。
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {seasonalPicks.data.items.map((m) => (
              <div key={m.malId} className="flex flex-col gap-2">
                <button
                  type="button"
                  className="block w-full cursor-pointer rounded-xl text-left outline-none ring-offset-2 transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
                  onClick={() => {
                    setSeasonalDetailMeta(m);
                    setSeasonalDetailOpen(true);
                  }}
                >
                  <AnimeCard
                    title={m.title}
                    imageUrl={m.imageUrl}
                    malId={m.malId}
                    genres={m.genres}
                    totalEpisodes={m.totalEpisodes ?? m.episodes}
                  />
                </button>
                <button
                  type="button"
                  disabled={addFromRecommend.isPending}
                  onClick={() => {
                    addFromRecommend.mutate({ malId: m.malId, title: m.title });
                  }}
                  className="h-9 w-full rounded-md border border-zinc-200 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  加入清单（PLANNED）
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

