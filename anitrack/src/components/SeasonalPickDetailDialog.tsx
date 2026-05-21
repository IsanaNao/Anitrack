"use client";

import * as Dialog from "@radix-ui/react-dialog";

import type { AnimeMeta } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import { useAnimeDisplay } from "@/i18n/useAnimeDisplay";

function synopsisPlain(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function SeasonalPickDetailDialog({
  open,
  onOpenChange,
  meta,
  onAddToList,
  addPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  meta: AnimeMeta | null;
  onAddToList: () => void;
  addPending: boolean;
}) {
  const { t } = useI18n();
  const { title: displayTitle, synopsis: displaySynopsis } = useAnimeDisplay();
  const actualOpen = open && Boolean(meta);

  if (!meta) {
    return (
      <Dialog.Root
        open={false}
        onOpenChange={(v) => {
          if (!v) onOpenChange(false);
        }}
      />
    );
  }

  const title = displayTitle(meta, meta.malId);
  const body = synopsisPlain(displaySynopsis(meta));

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
          <Dialog.Content className="fixed left-1/2 top-1/2 w-[min(92vw,520px)] max-h-[min(88vh,680px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <Dialog.Title className="sr-only">{title}</Dialog.Title>
            <Dialog.Description className="sr-only">{t("seasonalDialog.srDescription")}</Dialog.Description>

            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 gap-3">
                <div className="h-[100px] w-[72px] shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
                  {meta.imageUrl ? (
                    <img src={meta.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-400">
                      {t("common.noImage")}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
                    {title}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                    {typeof meta.score === "number" && Number.isFinite(meta.score) ? (
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-medium dark:bg-zinc-900">
                        MAL {meta.score.toFixed(2)}
                      </span>
                    ) : null}
                    {typeof (meta.totalEpisodes ?? meta.episodes) === "number" ? (
                      <span>
                        {t("seasonalDialog.episodes", {
                          count: meta.totalEpisodes ?? meta.episodes ?? 0,
                        })}
                      </span>
                    ) : null}
                    <span className="font-mono text-zinc-500">
                      {t("common.malId")}: {meta.malId}
                    </span>
                  </div>
                  {(meta.genres ?? []).length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(meta.genres ?? []).slice(0, 8).map((g) => (
                        <span
                          key={g}
                          className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="shrink-0 rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  {t("common.close")}
                </button>
              </Dialog.Close>
            </div>

            <div className="mt-4">
              <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {t("common.synopsis")}
              </div>
              <div className="mt-2 max-h-52 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
                {body ? body : <span className="text-zinc-400 dark:text-zinc-600">{t("common.noSynopsis")}</span>}
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:justify-end dark:border-zinc-800">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="h-10 rounded-md border border-zinc-200 px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  {t("common.close")}
                </button>
              </Dialog.Close>
              <button
                type="button"
                disabled={addPending}
                onClick={() => onAddToList()}
                className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-black dark:hover:bg-white"
              >
                {addPending ? t("seasonalDialog.adding") : t("seasonalDialog.addPlanned")}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      ) : null}
    </Dialog.Root>
  );
}
