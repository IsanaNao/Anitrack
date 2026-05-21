"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
import { useI18n } from "@/i18n/I18nProvider";
import { useAnimeDisplay } from "@/i18n/useAnimeDisplay";

export default function DashboardPage() {
  const { t } = useI18n();
  const { title: displayTitle } = useAnimeDisplay();
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
      const meta = entry.animeMeta;
      const label = meta
        ? displayTitle(meta, entry.malId)
        : `malId: ${entry.malId}`;
      toast.success(t("toast.addedToList"), { description: label });
    },
    onError: (e: unknown, vars) => {
      if (
        e instanceof ApiClientError &&
        e.status === 409 &&
        e.details?.some((d) => d.path === "malId")
      ) {
        toast.info(t("toast.alreadyInList"), { description: vars.title });
        return;
      }
      const msg = e instanceof Error ? e.message : t("common.unknownError");
      toast.error(t("toast.addFailed"), { description: msg });
    },
  });

  useEffect(() => {
    const el = watchingNowRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!watchingNowRef.current) return;
      const canScroll = el.scrollWidth > el.clientWidth;
      if (!canScroll) return;

      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel as EventListener);
  }, []);

  const loadErr = (err: unknown) =>
    `${t("common.loadFailed")}: ${err instanceof Error ? err.message : t("common.unknownError")}`;

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
            title: displayTitle(seasonalDetailMeta, seasonalDetailMeta.malId),
          });
        }}
      />
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold">{t("dashboard.profileStats")}</div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {t("dashboard.quickOverview", { count: summary.data?.ratedCount ?? 0 })}
            </div>
          </div>
          <Link
            href="/profile"
            className="h-9 w-fit shrink-0 rounded-md border border-zinc-200 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            {t("common.enterProfile")}
          </Link>
        </div>

        {summary.isLoading ? (
          <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{t("common.loading")}</div>
        ) : summary.isError ? (
          <div className="mt-3 text-sm text-red-600 dark:text-red-300">{loadErr(summary.error)}</div>
        ) : !summary.data ? (
          <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{t("common.noData")}</div>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-3">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2.5 text-center dark:border-zinc-800 dark:bg-zinc-900/30 sm:px-4 sm:py-4 sm:text-left">
              <div className="text-[10px] leading-tight text-zinc-500 dark:text-zinc-400 sm:text-xs">
                {t("dashboard.totalEntries")}
              </div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums sm:mt-1 sm:text-2xl">
                {summary.data.total}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2.5 text-center dark:border-zinc-800 dark:bg-zinc-900/30 sm:px-4 sm:py-4 sm:text-left">
              <div className="text-[10px] leading-tight text-zinc-500 dark:text-zinc-400 sm:text-xs">
                {t("dashboard.completed")}
              </div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums sm:mt-1 sm:text-2xl">
                {summary.data.totalCompleted}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2.5 text-center dark:border-zinc-800 dark:bg-zinc-900/30 sm:px-4 sm:py-4 sm:text-left">
              <div className="text-[10px] leading-tight text-zinc-500 dark:text-zinc-400 sm:text-xs">
                {t("dashboard.avgRating")}
              </div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums sm:mt-1 sm:text-2xl">
                {summary.data.avgRating != null ? summary.data.avgRating : "—"}
              </div>
              <div className="mt-0.5 text-[10px] leading-tight text-zinc-500 dark:text-zinc-400 sm:mt-1 sm:text-xs">
                {t("dashboard.watchingCount", { count: summary.data.totalWatching })}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold">{t("dashboard.watchingFeatured")}</div>
          <Link
            href="/library"
            className="h-9 rounded-md border border-zinc-200 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            {t("common.viewMore")}
          </Link>
        </div>

        {recent.isLoading ? (
          <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{t("common.loading")}</div>
        ) : recent.isError ? (
          <div className="mt-3 text-sm text-red-600 dark:text-red-300">{loadErr(recent.error)}</div>
        ) : !recent.data ? (
          <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{t("common.noData")}</div>
        ) : recent.data.items.length === 0 ? (
          <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{t("common.noEntries")}</div>
        ) : (
          <div
            ref={watchingNowRef}
            className="-mx-4 mt-4 overflow-x-auto overscroll-x-contain px-4 pb-2 [scrollbar-width:thin]"
          >
            <div className="inline-grid w-max grid-flow-col grid-rows-2 gap-x-3 gap-y-3 [grid-auto-columns:min(10.5rem,calc((min(100vw-2.5rem,68rem)-0.75rem)/2))] md:flex md:w-auto md:flex-row md:gap-4">
              {recent.data.items.map((e) => (
                <div
                  key={e.id}
                  className="h-full min-w-0 md:w-[11.5rem] md:shrink-0 lg:w-[13.5rem]"
                >
                  <button
                    className="block w-full text-left"
                    type="button"
                    onClick={() => {
                      setSelectedEntry(e);
                      setDialogOpen(true);
                    }}
                  >
                    <AnimeCard
                      density="compact"
                      title={
                        e.animeMeta
                          ? displayTitle(e.animeMeta, e.malId)
                          : `malId: ${e.malId}`
                      }
                      imageUrl={e.animeMeta?.imageUrl}
                      status={e.status}
                      malId={e.malId}
                      genres={e.animeMeta?.genres}
                      totalEpisodes={
                        e.animeMeta?.totalEpisodes ?? e.animeMeta?.episodes
                      }
                      episodesWatched={e.episodesWatched}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold">{t("dashboard.seasonalPicks")}</div>
          <button
            type="button"
            disabled={seasonalPicks.isFetching}
            onClick={() => setSeasonalPickNonce((n) => n + 1)}
            className="h-9 rounded-md border border-zinc-200 px-3 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            title={t("dashboard.shuffleTitle")}
          >
            {seasonalPicks.isFetching ? t("common.loading") : t("dashboard.shuffle")}
          </button>
        </div>
        <p
          className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400"
          translate="no"
        >
          {t("dashboard.seasonalSource")}
        </p>

        {seasonalPicks.isLoading ? (
          <div className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">{t("common.loading")}</div>
        ) : seasonalPicks.isError ? (
          <div className="mt-4 text-sm text-red-600 dark:text-red-300">{loadErr(seasonalPicks.error)}</div>
        ) : !seasonalPicks.data?.items.length ? (
          <div className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">{t("dashboard.seasonalEmpty")}</div>
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
                    density="compact"
                    title={displayTitle(m, m.malId)}
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
                    addFromRecommend.mutate({
                      malId: m.malId,
                      title: displayTitle(m, m.malId),
                    });
                  }}
                  className="h-9 w-full rounded-md border border-zinc-200 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  {t("dashboard.addPlanned")}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
