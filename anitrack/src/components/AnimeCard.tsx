import type { AnimeEntry } from "@/lib/api";

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
}: {
  title: string;
  imageUrl?: string;
  status: AnimeEntry["status"];
  malId: number;
  genres?: string[];
  totalEpisodes?: number;
  episodesWatched?: number;
}) {
  const tags = (genres ?? []).slice(0, 3);
  const total = typeof totalEpisodes === "number" ? totalEpisodes : undefined;
  const watched = typeof episodesWatched === "number" ? episodesWatched : undefined;
  const progress =
    total != null && total > 0
      ? Math.max(0, Math.min(100, Math.round(((watched ?? 0) / total) * 100)))
      : null;

  return (
    <div className="aspect-[2/3] w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="h-48 w-full bg-zinc-100 dark:bg-zinc-900">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-48 w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
            No image
          </div>
        )}
      </div>
      <div className="flex h-[calc(100%-12rem)] flex-col gap-2 p-3">
        <div className="line-clamp-2 text-sm font-semibold leading-5">
          {title}
        </div>
        {progress != null ? (
          <div className="grid gap-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              进度 {progress}%（{watched ?? 0}/{total}）
            </div>
          </div>
        ) : null}
        {tags.length ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                title={t}
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
              status,
            )}`}
          >
            {status}
          </span>
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
            malId: {malId}
          </span>
        </div>
      </div>
    </div>
  );
}

