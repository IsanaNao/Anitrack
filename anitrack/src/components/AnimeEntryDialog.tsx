"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AnimeEntry, AnimeStatus } from "@/lib/api";
import { deleteAnimeEntry, patchAnimeEntry } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import { useAnimeDisplay } from "@/i18n/useAnimeDisplay";

const StatusOptions: AnimeStatus[] = [
  "PLANNED",
  "WATCHING",
  "ON_HOLD",
  "DROPPED",
  "COMPLETED",
];

function clampInt(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.trunc(v)));
}

export function AnimeEntryDialog({
  open,
  onOpenChange,
  entry,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entry: AnimeEntry | null;
}) {
  const { t } = useI18n();
  const { title: displayTitle, synopsis: displaySynopsis } = useAnimeDisplay();
  const qc = useQueryClient();

  const actualOpen = open && Boolean(entry);

  const totalEpisodes =
    entry?.animeMeta?.totalEpisodes ?? entry?.animeMeta?.episodes ?? undefined;

  const [status, setStatus] = useState<AnimeStatus>("PLANNED");
  const [rating, setRating] = useState<number | "">("");
  const [episodesWatched, setEpisodesWatched] = useState(0);

  const genres = useMemo(() => (entry?.animeMeta?.genres ?? []).slice(0, 12), [entry]);

  useEffect(() => {
    if (!entry) return;
    setStatus(entry.status);
    setRating(typeof entry.rating === "number" ? entry.rating : "");
    setEpisodesWatched(typeof entry.episodesWatched === "number" ? entry.episodesWatched : 0);
  }, [entry]);

  useEffect(() => {
    if (!entry) return;
    if (typeof totalEpisodes === "number" && totalEpisodes > 0) {
      if (episodesWatched === totalEpisodes && status !== "COMPLETED") {
        toast.message(t("toast.episodesReachedTotal"), {
          description: t("toast.suggestCompleted"),
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodesWatched, totalEpisodes]);

  const mutatePatch = useMutation({
    mutationFn: async () => {
      if (!entry) throw new Error("Missing entry");
      const patch: Record<string, unknown> = {
        status,
        episodesWatched,
      };
      if (rating !== "") {
        patch.rating = clampInt(rating, 0, 10);
      }
      return patchAnimeEntry(entry.id, patch as Parameters<typeof patchAnimeEntry>[1]);
    },
    onSuccess: async () => {
      toast.success(t("toast.saved"));
      await qc.invalidateQueries({ queryKey: ["anime"] });
    },
    onError: (e) => {
      toast.error(t("toast.saveFailed"), {
        description: e instanceof Error ? e.message : t("common.unknownError"),
      });
    },
  });

  const mutateDelete = useMutation({
    mutationFn: async () => {
      if (!entry) throw new Error("Missing entry");
      await deleteAnimeEntry(entry.id);
    },
    onSuccess: async () => {
      toast.success(t("toast.deleted"));
      await qc.invalidateQueries({ queryKey: ["anime"] });
      onOpenChange(false);
    },
    onError: (e) => {
      toast.error(t("toast.deleteFailed"), {
        description: e instanceof Error ? e.message : t("common.unknownError"),
      });
    },
  });

  if (!entry) {
    return (
      <Dialog.Root
        open={false}
        onOpenChange={(v) => {
          if (!v) onOpenChange(false);
        }}
      />
    );
  }

  const meta = entry.animeMeta;
  const title = meta ? displayTitle(meta, entry.malId) : `malId: ${entry.malId}`;
  const synopsis = meta ? displaySynopsis(meta) : "";

  const maxWatched =
    typeof totalEpisodes === "number" && totalEpisodes > 0 ? totalEpisodes : 100000;

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
          <Dialog.Content className="fixed left-1/2 top-1/2 w-[min(92vw,720px)] max-h-[min(88vh,720px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <Dialog.Title className="sr-only">{title}</Dialog.Title>
            <Dialog.Description className="sr-only">{t("entryDialog.srDescription")}</Dialog.Description>

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate text-base font-semibold">{title}</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {genres.slice(0, 6).map((g) => (
                    <span
                      key={g}
                      className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>
              <Dialog.Close asChild>
                <button className="h-9 rounded-md border border-zinc-200 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
                  {t("common.close")}
                </button>
              </Dialog.Close>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm text-zinc-600 dark:text-zinc-300">{t("entryDialog.status")}</span>
                <select
                  className="h-10 rounded-md border border-zinc-200 bg-transparent px-2 text-sm outline-none dark:border-zinc-800"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AnimeStatus)}
                >
                  {StatusOptions.map((s) => (
                    <option key={s} value={s}>
                      {t(`status.${s}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-sm text-zinc-600 dark:text-zinc-300">{t("entryDialog.rating")}</span>
                <input
                  className="h-10 rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none dark:border-zinc-800"
                  value={rating}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") setRating("");
                    else setRating(Number(raw));
                  }}
                  inputMode="numeric"
                  placeholder={t("entryDialog.unrated")}
                />
              </label>

              <div className="grid gap-1 sm:col-span-2">
                <span className="text-sm text-zinc-600 dark:text-zinc-300">
                  {t("entryDialog.episodesWatched")}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="h-10 w-10 rounded-md border border-zinc-200 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 disabled:opacity-50"
                    onClick={() => setEpisodesWatched((v) => clampInt(v - 1, 0, maxWatched))}
                    disabled={episodesWatched <= 0}
                  >
                    -
                  </button>
                  <input
                    className="h-10 w-24 rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none dark:border-zinc-800"
                    value={episodesWatched}
                    onChange={(e) =>
                      setEpisodesWatched(clampInt(Number(e.target.value), 0, maxWatched))
                    }
                    inputMode="numeric"
                  />
                  <button
                    className="h-10 w-10 rounded-md border border-zinc-200 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 disabled:opacity-50"
                    onClick={() => setEpisodesWatched((v) => clampInt(v + 1, 0, maxWatched))}
                    disabled={episodesWatched >= maxWatched}
                  >
                    +
                  </button>
                  {typeof totalEpisodes === "number" ? (
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">/ {totalEpisodes}</div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-sm font-semibold">{t("common.synopsis")}</div>
              <div className="mt-2 max-h-40 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-200">
                {synopsis ? synopsis : <span className="text-zinc-400">{t("common.noSynopsis")}</span>}
              </div>
            </div>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                className="h-10 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/50"
                onClick={() => mutateDelete.mutate()}
                disabled={mutateDelete.isPending || mutatePatch.isPending}
              >
                {mutateDelete.isPending ? t("common.deleting") : t("common.delete")}
              </button>

              <div className="flex items-center gap-2 sm:justify-end">
                <button
                  className="h-10 rounded-md border border-zinc-200 px-4 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  onClick={() => onOpenChange(false)}
                  disabled={mutateDelete.isPending || mutatePatch.isPending}
                >
                  {t("common.cancel")}
                </button>
                <button
                  className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-black dark:hover:bg-white"
                  onClick={() => mutatePatch.mutate()}
                  disabled={mutateDelete.isPending || mutatePatch.isPending}
                >
                  {mutatePatch.isPending ? t("common.saving") : t("common.save")}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      ) : null}
    </Dialog.Root>
  );
}
