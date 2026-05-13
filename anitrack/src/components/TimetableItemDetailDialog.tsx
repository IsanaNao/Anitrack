"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AnimeEntry, TimetableItemApi } from "@/lib/api";
import {
  ApiClientError,
  createAnimeEntry,
  getAnimeEntries,
} from "@/lib/api";

const STATUS_LABEL: Record<string, string> = {
  PLANNED: "计划收看",
  WATCHING: "正在追番",
  ON_HOLD: "搁置",
  DROPPED: "弃番",
  COMPLETED: "已看完",
};

function countdownLabel(iso?: string): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const diff = t - Date.now();
  if (diff <= 0) return "已开播";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h >= 72) return `${Math.ceil(h / 24)} 天后`;
  if (h > 0) return `${h}小时${m}分`;
  if (m > 0) return `${m}分钟后`;
  return "即将播出";
}

export function TimetableItemDetailDialog({
  open,
  onOpenChange,
  item,
  onOpenLibraryEntry,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: TimetableItemApi | null;
  onOpenLibraryEntry: (entry: AnimeEntry) => void;
}) {
  const qc = useQueryClient();
  const actualOpen = open && Boolean(item);

  const listQ = useQuery({
    queryKey: ["anime", "timetable-dialog", item?.malId],
    queryFn: () => getAnimeEntries({ page: 1, pageSize: 500, sort: "updatedAt:desc" }),
    enabled: actualOpen && item != null,
  });

  const existing = useMemo(() => {
    if (!item || !listQ.data?.items.length) return undefined;
    return listQ.data.items.find((e) => e.malId === item.malId);
  }, [item, listQ.data?.items]);

  const addMut = useMutation({
    mutationFn: (status: "PLANNED" | "WATCHING") => {
      if (!item) throw new Error("Missing item");
      return createAnimeEntry({ malId: item.malId, status });
    },
    onSuccess: async (entry) => {
      toast.success("已加入追番清单", { description: entry.animeMeta?.title ?? item?.title });
      await qc.invalidateQueries({ queryKey: ["anime"] });
    },
    onError: (e: unknown) => {
      if (
        e instanceof ApiClientError &&
        e.status === 409 &&
        e.details?.some((d) => d.path === "malId")
      ) {
        toast.info("已在清单中", { description: item?.title });
        void qc.invalidateQueries({ queryKey: ["anime"] });
        return;
      }
      toast.error("加入失败", {
        description: e instanceof Error ? e.message : "unknown",
      });
    },
  });

  if (!item) {
    return (
      <Dialog.Root
        open={false}
        onOpenChange={(v) => {
          if (!v) onOpenChange(false);
        }}
      />
    );
  }

  const cd = countdownLabel(item.nextAirAtIso);
  const synopsisEn = (item.synopsisEn ?? "").trim();
  const synopsisJa = (item.synopsisJa ?? "").trim();
  const synopsisBody = synopsisEn || synopsisJa;
  const primaryTitle = item.title;
  const subTitle =
    item.titleJp?.trim() && item.titleJp.trim() !== primaryTitle.trim()
      ? item.titleJp.trim()
      : "";

  return (
    <Dialog.Root
      open={actualOpen}
      onOpenChange={(v) => {
        if (!v) onOpenChange(false);
      }}
    >
      {actualOpen ? (
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-[min(92vw,560px)] max-h-[min(88vh,720px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <Dialog.Title className="sr-only">{primaryTitle}</Dialog.Title>
            <Dialog.Description className="sr-only">
              查看新番时间表条目详情，并选择是否加入追番清单。
            </Dialog.Description>

            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 gap-3">
                <div className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200 dark:bg-zinc-800 dark:ring-zinc-700">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] text-slate-400 dark:text-zinc-600">
                      无封面
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-base font-semibold leading-snug text-slate-900 dark:text-zinc-100">
                    {primaryTitle}
                  </div>
                  {subTitle ? (
                    <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-zinc-400">
                      {subTitle}
                    </div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-zinc-400">
                    <span className="font-semibold text-[#fb7299] dark:text-rose-400">
                      {item.episodeLabel}
                    </span>
                    {item.airTimeLocal?.trim() ? (
                      <span>Local {item.airTimeLocal}</span>
                    ) : (
                      <span>Air time TBD</span>
                    )}
                    {cd ? <span>{cd}</span> : null}
                  </div>
                </div>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="shrink-0 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  关闭
                </button>
              </Dialog.Close>
            </div>

            <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-500">
              MAL #{item.malId}
              {item.bgmId ? ` · Bangumi #${item.bgmId}` : null}
            </div>

            <div className="mt-4">
              <div className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Synopsis</div>
              <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                {synopsisBody ? (
                  synopsisBody
                ) : (
                  <span className="text-slate-400 dark:text-zinc-600">No synopsis</span>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-zinc-800">
              {listQ.isLoading ? (
                <p className="text-sm text-slate-500 dark:text-zinc-400">正在检查你的清单…</p>
              ) : existing ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-700 dark:text-zinc-300">
                    已在清单：
                    <span className="ml-1 font-medium text-slate-900 dark:text-zinc-100">
                      {STATUS_LABEL[existing.status] ?? existing.status}
                    </span>
                  </p>
                  <button
                    type="button"
                    className="h-10 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-white"
                    onClick={() => {
                      onOpenLibraryEntry(existing);
                      onOpenChange(false);
                    }}
                  >
                    编辑进度与状态
                  </button>
                </div>
              ) : (
                <div>
                  <p className="mb-3 text-sm text-slate-600 dark:text-zinc-400">加入追番清单（可随时在「我的清单」中修改）</p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      disabled={addMut.isPending}
                      className="h-10 rounded-md border border-slate-200 px-4 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                      onClick={() => addMut.mutate("PLANNED")}
                    >
                      {addMut.isPending ? "提交中…" : "计划收看"}
                    </button>
                    <button
                      type="button"
                      disabled={addMut.isPending}
                      className="h-10 rounded-md bg-[#fb7299] px-4 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50 dark:bg-rose-500 dark:hover:bg-rose-400"
                      onClick={() => addMut.mutate("WATCHING")}
                    >
                      {addMut.isPending ? "提交中…" : "正在追番"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      ) : null}
    </Dialog.Root>
  );
}
