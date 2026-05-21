"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  ApiClientError,
  type AnimeEntry,
  type AnimeMeta,
  type AnimeStatus,
  type AnimeMetaSearchResponse,
  createAnimeEntry,
  getAnimeEntries,
  searchAnimeMeta,
} from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { AnimeCard } from "@/components/AnimeCard";
import { StatusFilter } from "@/components/StatusFilter";
import { Pagination } from "@/components/Pagination";
import { SortSelect, type SortKey } from "@/components/SortSelect";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { AnimeEntryDialog } from "@/components/AnimeEntryDialog";
import { useI18n } from "@/i18n/I18nProvider";
import { useAnimeDisplay } from "@/i18n/useAnimeDisplay";

export default function LibraryPage() {
  const { t } = useI18n();
  const { title: displayTitle } = useAnimeDisplay();
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [addingMalId, setAddingMalId] = useState<number | null>(null);
  const [searchResults, setSearchResults] = useState<AnimeMeta[]>([]);
  const [searchPagination, setSearchPagination] =
    useState<AnimeMetaSearchResponse["pagination"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<AnimeEntry | null>(null);

  const [searchPage, setSearchPage] = useState(1);
  const searchPageSize = 10;

  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [status, setStatus] = useState<AnimeStatus | "ALL">("ALL");
  const [sort, setSort] = useState<SortKey>("updatedAt:desc");

  const canSearch = useMemo(() => q.trim().length > 0 && !searching, [q, searching]);
  const qTrimmed = q.trim();
  const debouncedQuery = useDebouncedValue(qTrimmed, 500);
  const enterSearchRef = useRef(0);
  const suggestionAppliedRef = useRef(0);

  const list = useQuery({
    queryKey: ["anime", "list", { status, page, pageSize, sort }],
    queryFn: () =>
      getAnimeEntries({
        status: status === "ALL" ? undefined : status,
        page,
        pageSize,
        sort,
      }),
  });

  const myMalIdSet = useMemo(() => {
    const s = new Set<number>();
    for (const e of list.data?.items ?? []) s.add(e.malId);
    return s;
  }, [list.data?.items]);

  useEffect(() => {
    setError(null);
  }, [page]);

  useEffect(() => {
    setPage(1);
  }, [status, sort]);

  async function onSearch(args?: { page?: number; immediate?: boolean }) {
    const query = (args?.immediate ? qTrimmed : debouncedQuery).trim();
    if (!query) {
      setSearchResults([]);
      setSearchPagination(null);
      return;
    }
    setError(null);
    setSearching(true);
    try {
      const res = await searchAnimeMeta({
        q: query,
        page: args?.page ?? searchPage,
        pageSize: searchPageSize,
      });
      setSearchResults(res.items);
      setSearchPagination(res.pagination ?? null);
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 429) {
        setError(t("errors.jikanRateLimit"));
      } else {
        setError(e instanceof Error ? e.message : t("errors.searchFailed"));
      }
    } finally {
      setSearching(false);
    }
  }

  const searchTips = useMemo(() => {
    const raw = qTrimmed.toLowerCase().replace(/\s+/g, " ").trim();
    const isLoveLive = raw.includes("lovelive") || raw.includes("love live");
    if (!raw) return null;

    const resultCount = searchResults.length;
    const shouldNudge = isLoveLive && resultCount > 0 && resultCount < 6;
    if (!shouldNudge) return null;

    const suggestions = [
      "Love Live Superstar",
      "Love Live Sunshine",
      "Love Live Nijigasaki",
      "Love Live School Idol Project",
    ];

    return { show: true, message: t("library.searchTipsMessage"), suggestions };
  }, [qTrimmed, searchResults.length, t]);

  useEffect(() => {
    setSearchPage(1);
  }, [debouncedQuery]);

  useEffect(() => {
    const enterAt = enterSearchRef.current;
    if (Date.now() - enterAt < 300) return;
    const appliedAt = suggestionAppliedRef.current;
    if (Date.now() - appliedAt < 300) return;
    void onSearch({ page: searchPage });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, searchPage]);

  async function onAdd(malId: number) {
    setError(null);
    setAddingMalId(malId);
    try {
      await createAnimeEntry({ malId });
      toast.success(t("toast.addedToLibrary"));
      await qc.invalidateQueries({ queryKey: ["anime"] });
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 409) {
        setError(t("errors.alreadyInList"));
      } else if (e instanceof ApiClientError && e.status === 429) {
        setError(t("errors.jikanRateLimit"));
      } else {
        setError(e instanceof Error ? e.message : t("toast.addFailed"));
      }
    } finally {
      setAddingMalId(null);
    }
  }

  const totalPages = list.data?.totalPages ?? 1;
  const loadErr = (err: unknown) =>
    `${t("common.loadFailed")}: ${err instanceof Error ? err.message : t("common.unknownError")}`;

  return (
    <AppShell>
      <AnimeEntryDialog open={dialogOpen} onOpenChange={setDialogOpen} entry={selectedEntry} />
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            className="h-10 w-full rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
            placeholder={t("library.searchPlaceholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                enterSearchRef.current = Date.now();
                setSearchPage(1);
                void onSearch({ page: 1, immediate: true });
              }
            }}
          />
          <button
            className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-black"
            onClick={() => {
              enterSearchRef.current = Date.now();
              setSearchPage(1);
              void onSearch({ page: 1, immediate: true });
            }}
            disabled={!canSearch}
          >
            {searching ? t("common.searching") : t("common.search")}
          </button>
        </div>

        {error ? (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-4">
          <div className="text-sm font-semibold">{t("library.searchResults")}</div>
          <div className="mt-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            {searchResults.length === 0 ? (
              <div className="text-sm text-zinc-500 dark:text-zinc-400">{t("library.searchHint")}</div>
            ) : (
              <div className="grid gap-3">
                {searchTips?.show ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                    <div className="font-semibold">{t("library.searchTipsTitle")}</div>
                    <div className="mt-1 text-amber-800 dark:text-amber-200">{searchTips.message}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {searchTips.suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className="h-8 rounded-full border border-amber-200 bg-white px-3 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
                          onClick={() => {
                            suggestionAppliedRef.current = Date.now();
                            setQ(s);
                            setSearchPage(1);
                            void onSearch({ page: 1, immediate: true });
                          }}
                          disabled={searching}
                          title={t("library.suggestionTitle")}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {searchResults.map((m) => (
                    <div
                      key={m.malId}
                      className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <div className="h-16 w-12 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-900">
                        {m.imageUrl ? (
                          <img
                            src={m.imageUrl}
                            alt={displayTitle(m, m.malId)}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">
                          {displayTitle(m, m.malId)}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {t("common.malId")}: {m.malId}
                        </div>
                      </div>
                      {myMalIdSet.has(m.malId) ? (
                        <button
                          className="h-9 shrink-0 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-500"
                          disabled
                        >
                          {t("library.inList")}
                        </button>
                      ) : (
                        <button
                          className="h-9 shrink-0 rounded-md bg-zinc-900 px-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-black dark:hover:bg-white"
                          onClick={() => void onAdd(m.malId)}
                          disabled={addingMalId === m.malId}
                        >
                          {addingMalId === m.malId ? t("common.adding") : t("common.add")}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {searchPagination ? (
            <Pagination
              page={searchPagination.current_page ?? searchPage}
              totalPages={searchPagination.last_visible_page ?? 1}
              total={searchPagination.items?.total ?? searchResults.length}
              disabled={searching}
              onPrev={() => setSearchPage((p) => Math.max(1, p - 1))}
              onNext={() =>
                setSearchPage((p) =>
                  Math.min(searchPagination.last_visible_page ?? 1, p + 1),
                )
              }
            />
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold">{t("library.myList")}</div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <SortSelect value={sort} onChange={setSort} />
            <button
              className="h-9 rounded-md border border-zinc-200 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 disabled:opacity-50"
              onClick={() => void list.refetch()}
              disabled={list.isFetching}
            >
              {list.isFetching ? t("common.refreshing") : t("common.refresh")}
            </button>
          </div>
        </div>

        <div className="mt-3">
          <StatusFilter value={status} onChange={setStatus} />
        </div>

        {list.isLoading ? (
          <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{t("common.loading")}</div>
        ) : list.isError ? (
          <div className="mt-3 text-sm text-red-600 dark:text-red-300">{loadErr(list.error)}</div>
        ) : !list.data ? (
          <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{t("common.noData")}</div>
        ) : list.data.items.length === 0 ? (
          <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400">
            {t("common.noEntries")}
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {list.data.items.map((e: AnimeEntry) => (
                <button
                  key={e.id}
                  className="text-left"
                  type="button"
                  onClick={() => {
                    setSelectedEntry(e);
                    setDialogOpen(true);
                  }}
                >
                  <AnimeCard
                    title={
                      e.animeMeta
                        ? displayTitle(e.animeMeta, e.malId)
                        : `malId: ${e.malId}`
                    }
                    imageUrl={e.animeMeta?.imageUrl}
                    status={e.status}
                    malId={e.malId}
                    genres={e.animeMeta?.genres}
                    totalEpisodes={e.animeMeta?.totalEpisodes ?? e.animeMeta?.episodes}
                    episodesWatched={e.episodesWatched}
                  />
                </button>
              ))}
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              total={list.data.total}
              disabled={list.isFetching}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
            />
          </>
        )}
      </section>
    </AppShell>
  );
}
