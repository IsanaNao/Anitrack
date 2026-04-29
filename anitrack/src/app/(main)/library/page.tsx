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

export default function LibraryPage() {
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
    // 当页码变化时，把错误提示清掉，避免 UX 混乱
    setError(null);
  }, [page]);

  useEffect(() => {
    // 状态/排序变化时回到第一页
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
        setError("Jikan 限流（429）。请稍等几十秒再试。");
      } else {
        setError(e instanceof Error ? e.message : "搜索失败");
      }
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    // Debounce auto search: query changes → reset page → auto search
    setSearchPage(1);
  }, [debouncedQuery]);

  useEffect(() => {
    // Auto search when debouncedQuery changes or page changes.
    // If user pressed Enter recently, skip debounce-triggered run.
    const enterAt = enterSearchRef.current;
    if (Date.now() - enterAt < 300) return;
    void onSearch({ page: searchPage });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, searchPage]);

  async function onAdd(malId: number) {
    setError(null);
    setAddingMalId(malId);
    try {
      await createAnimeEntry({ malId });
      toast.success("已添加到清单");
      await qc.invalidateQueries({ queryKey: ["anime"] });
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 409) {
        setError("已在清单中（重复添加）。");
      } else if (e instanceof ApiClientError && e.status === 429) {
        setError("Jikan 限流（429）。请稍等几十秒再试。");
      } else {
        setError(e instanceof Error ? e.message : "添加失败");
      }
    } finally {
      setAddingMalId(null);
    }
  }

  const totalPages = list.data?.totalPages ?? 1;

  return (
    <AppShell>
      <AnimeEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={selectedEntry}
      />
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            className="h-10 w-full rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
            placeholder="搜索番剧（Jikan）…"
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
            {searching ? "搜索中…" : "搜索"}
          </button>
        </div>

        {error ? (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-4">
          <div className="text-sm font-semibold">搜索结果</div>
          <div className="mt-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            {searchResults.length === 0 ? (
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                请输入关键词（支持 500ms 防抖自动搜索，Enter 立即搜索）
              </div>
            ) : (
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
                          alt={m.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{m.title}</div>
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        malId: {m.malId}
                      </div>
                    </div>
                    {myMalIdSet.has(m.malId) ? (
                      <button
                        className="h-9 shrink-0 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-500"
                        disabled
                      >
                        已在清单
                      </button>
                    ) : (
                      <button
                        className="h-9 shrink-0 rounded-md bg-zinc-900 px-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-black dark:hover:bg-white"
                        onClick={() => void onAdd(m.malId)}
                        disabled={addingMalId === m.malId}
                      >
                        {addingMalId === m.malId ? "添加中…" : "添加"}
                      </button>
                    )}
                  </div>
                ))}
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
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">我的清单</div>
          <div className="flex items-center gap-3">
            <SortSelect value={sort} onChange={setSort} />
            <button
              className="h-9 rounded-md border border-zinc-200 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 disabled:opacity-50"
              onClick={() => void list.refetch()}
              disabled={list.isFetching}
            >
              {list.isFetching ? "刷新中…" : "刷新"}
            </button>
          </div>
        </div>

        <div className="mt-3">
          <StatusFilter value={status} onChange={setStatus} />
        </div>

        {list.isLoading ? (
          <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">加载中…</div>
        ) : list.isError ? (
          <div className="mt-3 text-sm text-red-600 dark:text-red-300">
            加载失败：
            {list.error instanceof Error ? list.error.message : "unknown error"}
          </div>
        ) : !list.data ? (
          <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">暂无数据</div>
        ) : list.data.items.length === 0 ? (
          <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400">
            暂无条目
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
                    title={e.animeMeta?.title ?? `malId: ${e.malId}`}
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

