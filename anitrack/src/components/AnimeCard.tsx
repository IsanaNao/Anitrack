"use client";

import type { AnimeEntry, AnimeStatus } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";

function statusBadgeClass(status: AnimeEntry["status"]) {
  switch (status) {
    case "WATCHING":
      return "bg-green-100 text-green-600";
    case "COMPLETED":
      return "bg-blue-100 text-blue-600";
    case "DROPPED":
      return "bg-red-100 text-red-600";
    case "PLANNED":
    default:
      return "bg-slate-100 text-slate-500";
  }
}

export function AnimeCard({
  title,
  imageUrl,
  status,
  malId,
  genres,
  totalEpisodes,
  episodesWatched,
  density = "comfortable",
}: {
  title: string;
  imageUrl?: string;
  /** 未传入时不展示追番状态徽章（例如镜像推荐卡片） */
  status?: AnimeStatus;
  malId: number;
  genres?: string[];
  totalEpisodes?: number;
  episodesWatched?: number;
  /** 仪表盘窄格/双列网格用紧凑布局，保证标题与进度可见 */
  density?: "comfortable" | "compact";
}) {
  const { t } = useI18n();
  const compact = density === "compact";
  const tags = (genres ?? []).slice(0, compact ? 1 : 3);
  const total = typeof totalEpisodes === "number" ? totalEpisodes : undefined;
  const watched = typeof episodesWatched === "number" ? episodesWatched : undefined;
  const progress =
    total != null && total > 0
      ? Math.max(0, Math.min(100, Math.round(((watched ?? 0) / total) * 100)))
      : null;

  const statusLabel = status ? t(`status.${status}`) : null;

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div
        className={
          compact
            ? "relative w-full shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-900 aspect-[4/5] max-h-[5.75rem] sm:max-h-[6.5rem]"
            : "relative w-full shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-900 aspect-[3/4] max-h-44 sm:max-h-48"
        }
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full min-h-[5rem] w-full items-center justify-center text-xs text-zinc-400">
            {t("common.noImage")}
          </div>
        )}
      </div>

      <div
        className={
          compact
            ? "flex min-h-[5.25rem] flex-1 flex-col gap-1 p-2"
            : "flex flex-1 flex-col gap-2 p-3"
        }
      >
        <h3
          className={
            compact
              ? "line-clamp-2 min-h-[2.25rem] text-[11px] font-semibold leading-tight text-zinc-900 dark:text-zinc-100"
              : "line-clamp-2 text-sm font-semibold leading-5 text-zinc-900 dark:text-zinc-100"
          }
          title={title}
        >
          {title}
        </h3>

        {progress != null ? (
          <div className="grid shrink-0 gap-0.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-[10px] leading-tight text-zinc-500 dark:text-zinc-400 sm:text-[11px]">
              {t("card.progress", {
                percent: progress,
                watched: watched ?? 0,
                total: total ?? 0,
              })}
            </div>
          </div>
        ) : null}

        {!compact && tags.length ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex max-w-full truncate rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                title={tag}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {!compact ? (
          <div className="mt-auto flex flex-wrap gap-2">
            {status && statusLabel ? (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
                  status,
                )}`}
              >
                {statusLabel}
              </span>
            ) : null}
            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              {t("common.malId")}: {malId}
            </span>
          </div>
        ) : status && statusLabel ? (
          <span
            className={`mt-auto inline-flex w-fit items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusBadgeClass(
              status,
            )}`}
          >
            {statusLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}
