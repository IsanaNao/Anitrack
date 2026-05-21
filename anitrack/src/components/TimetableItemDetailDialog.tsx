"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AnimeEntry, TimetableItemApi } from "@/lib/api";
import {
  ApiClientError,
  createAnimeEntry,
  getAnimeEntries,
} from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import { useAnimeDisplay } from "@/i18n/useAnimeDisplay";
import type { createTranslator } from "@/i18n/translate";

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
  const { t } = useI18n();
  const { title: pickTitle, subtitle: pickSubtitle, synopsis: pickSynopsis } = useAnimeDisplay();
  const qc = useQueryClient();
  const actualOpen = open && Boolean(item);

  useEffect(() => {
    if (!actualOpen || !item) return;
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- 排障
      console.log("[TimetableDialog]", "Original Time:", item.airTime, "Local:", item.airTimeLocal, "malId:", item.malId);
    }
  }, [actualOpen, item]);

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
      const label = entry.animeMeta
        ? pickTitle(entry.animeMeta, entry.malId)
        : item?.title ?? "";
      toast.success(t("toast.addedToWatchlist"), { description: label });
      await qc.invalidateQueries({ queryKey: ["anime"] });
    },
    onError: (e: unknown) => {
      if (
        e instanceof ApiClientError &&
        e.status === 409 &&
        e.details?.some((d) => d.path === "malId")
      ) {
        toast.info(t("toast.alreadyInList"), {
          description: item ? pickTitle(item, item.malId) : "",
        });
        void qc.invalidateQueries({ queryKey: ["anime"] });
        return;
      }
      toast.error(t("toast.addFailed"), {
        description: e instanceof Error ? e.message : t("common.unknownError"),
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

  const cd = countdownLabel(item.nextAirAtIso, t);
  const primaryTitle = pickTitle(item, item.malId);
  const subTitle = pickSubtitle(item, primaryTitle);
  const synopsisBody = pickSynopsis(item);
  const episodeLabel =
    item.episodeLabel === "Seasonal" ? t("timetable.episodeSeasonal") : item.episodeLabel;

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
            <Dialog.Description className="sr-only">{t("timetable.dialog.srDescription")}</Dialog.Description>

            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 gap-3">
                <div className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200 dark:bg-zinc-800 dark:ring-zinc-700">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] text-slate-400 dark:text-zinc-600">
                      {t("common.noImage")}
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
                    <span className="font-semibold text-[#fb7299] dark:text-rose-400">{episodeLabel}</span>
                    {item.airTimeLocal?.trim() ? (
                      <span>{t("timetable.localTime", { time: item.airTimeLocal })}</span>
                    ) : (
                      <span>{t("timetable.airTimeTbd")}</span>
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
                  {t("common.close")}
                </button>
              </Dialog.Close>
            </div>

            <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-500">
              {t("timetable.dialog.malBgm", {
                malId: item.malId,
                bgm: item.bgmId ? ` · Bangumi #${item.bgmId}` : "",
              })}
            </div>

            <div className="mt-4">
              <div className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                {t("timetable.dialog.synopsis")}
              </div>
              <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                {synopsisBody ? (
                  synopsisBody
                ) : (
                  <span className="text-slate-400 dark:text-zinc-600">{t("timetable.dialog.noSynopsis")}</span>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-zinc-800">
              {listQ.isLoading ? (
                <p className="text-sm text-slate-500 dark:text-zinc-400">{t("timetable.dialog.checkingList")}</p>
              ) : existing ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-700 dark:text-zinc-300">
                    {t("timetable.dialog.inList")}
                    <span className="ml-1 font-medium text-slate-900 dark:text-zinc-100">
                      {t(`status.label.${existing.status}`)}
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
                    {t("timetable.dialog.editEntry")}
                  </button>
                </div>
              ) : (
                <div>
                  <p className="mb-3 text-sm text-slate-600 dark:text-zinc-400">{t("timetable.dialog.addHint")}</p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      disabled={addMut.isPending}
                      className="h-10 rounded-md border border-slate-200 px-4 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                      onClick={() => addMut.mutate("PLANNED")}
                    >
                      {addMut.isPending ? t("timetable.dialog.submitting") : t("status.label.PLANNED")}
                    </button>
                    <button
                      type="button"
                      disabled={addMut.isPending}
                      className="h-10 rounded-md bg-[#fb7299] px-4 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50 dark:bg-rose-500 dark:hover:bg-rose-400"
                      onClick={() => addMut.mutate("WATCHING")}
                    >
                      {addMut.isPending ? t("timetable.dialog.submitting") : t("status.label.WATCHING")}
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
