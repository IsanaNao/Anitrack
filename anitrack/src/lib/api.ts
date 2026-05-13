export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: { path: string; reason: string }[];
  };
};

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: { path: string; reason: string }[];

  constructor(args: {
    code: string;
    message: string;
    status: number;
    details?: { path: string; reason: string }[];
  }) {
    super(args.message);
    this.name = "ApiClientError";
    this.code = args.code;
    this.status = args.status;
    this.details = args.details;
  }
}

function isApiErrorBody(v: unknown): v is ApiErrorBody {
  if (!v || typeof v !== "object") return false;
  const anyV = v as any;
  return (
    anyV.error &&
    typeof anyV.error === "object" &&
    typeof anyV.error.code === "string" &&
    typeof anyV.error.message === "string"
  );
}

export async function fetcher<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    if (isApiErrorBody(json)) {
      throw new ApiClientError({
        code: json.error.code,
        message: json.error.message,
        status: res.status,
        details: json.error.details,
      });
    }

    throw new ApiClientError({
      code: "HTTP_ERROR",
      message: `Request failed (${res.status})`,
      status: res.status,
    });
  }

  if (isApiErrorBody(json)) {
    throw new ApiClientError({
      code: json.error.code,
      message: json.error.message,
      status: res.status,
      details: json.error.details,
    });
  }

  return json as T;
}

export type AnimeStatus =
  | "PLANNED"
  | "WATCHING"
  | "ON_HOLD"
  | "DROPPED"
  | "COMPLETED";

export interface AnimeMeta {
  malId: number;
  title: string;
  imageUrl?: string;
  episodes?: number;
  totalEpisodes?: number;
  score?: number;
  synopsis?: string;
  genres?: string[];
}

export type JikanPagination = {
  last_visible_page?: number;
  has_next_page?: boolean;
  current_page?: number;
  items?: {
    count?: number;
    total?: number;
    per_page?: number;
  };
};

export type AnimeMetaSearchResponse = {
  items: AnimeMeta[];
  pagination: JikanPagination;
};

export type AnimeMetaSeasonalRandomResponse = {
  items: AnimeMeta[];
};

export type TimetableItemApi = {
  malId: number;
  bgmId: number;
  /** 英文优先（来自 Bangumi `name_en` / Jikan `title_english` 等），供时间表页展示 */
  title: string;
  titleJp?: string;
  titleEn?: string;
  imageUrl?: string;
  airTimeLocal?: string;
  nextAirAtIso?: string;
  /** Jikan 简介，多为英文 */
  synopsisEn?: string;
  /** 以假名为主的简介（来自 Jikan synopsis 启发式分类） */
  synopsisJa?: string;
  episodeLabel: string;
};

export type TimetableDayApi = {
  date: string;
  dateLabel: string;
  weekdayLabel: string;
  items: TimetableItemApi[];
};

export type TimetableResponse = {
  timezone: string;
  days: TimetableDayApi[];
};

export interface AnimeEntry {
  id: string;
  userId: string;
  malId: number;
  status: AnimeStatus;
  rating?: number;
  episodesWatched?: number;
  notes?: string;
  startedAt?: string;
  completedAt?: string;
  completedDates: string[];
  animeMeta: AnimeMeta;
  createdAt: string;
  updatedAt: string;
}

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export async function getAnimeEntries(params?: {
  status?: AnimeStatus;
  page?: number;
  pageSize?: number;
  sort?: string;
}): Promise<Paginated<AnimeEntry>> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params?.sort) qs.set("sort", params.sort);

  const suffix = qs.size ? `?${qs.toString()}` : "";
  return fetcher<Paginated<AnimeEntry>>(`/anime${suffix}`);
}

export async function getSeasonalRandomPicks(params?: {
  limit?: number;
}): Promise<AnimeMetaSeasonalRandomResponse> {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set("limit", String(params.limit));
  const suffix = qs.size ? `?${qs.toString()}` : "";
  return fetcher<AnimeMetaSeasonalRandomResponse>(
    `/anime-meta/seasonal-random${suffix}`,
  );
}

export async function getTimetable(params?: {
  days?: number;
}): Promise<TimetableResponse> {
  const qs = new URLSearchParams();
  if (params?.days != null) qs.set("days", String(params.days));
  const suffix = qs.size ? `?${qs.toString()}` : "";
  return fetcher<TimetableResponse>(`/anime-meta/timetable${suffix}`);
}

export async function searchAnimeMeta(params: {
  q: string;
  page?: number;
  pageSize?: number;
}): Promise<AnimeMetaSearchResponse> {
  const qs = new URLSearchParams();
  qs.set("q", params.q);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  return fetcher<AnimeMetaSearchResponse>(`/anime-meta/search?${qs.toString()}`);
}

export async function createAnimeEntry(args: {
  malId: number;
  status?: AnimeStatus;
}): Promise<AnimeEntry> {
  return fetcher<AnimeEntry>(`/anime`, {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export async function patchAnimeEntry(
  id: string,
  patch: Partial<Pick<AnimeEntry, "status" | "rating" | "episodesWatched" | "notes">>,
): Promise<AnimeEntry> {
  return fetcher<AnimeEntry>(`/anime/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteAnimeEntry(id: string): Promise<void> {
  await fetcher<void>(`/anime/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export type LifeMonthCell = {
  month: string; // YYYY-MM
  addedCount: number;
  completedCount: number;
  episodeCount: number;
  intensity: number; // 0-4
};

export type LifeMonthHeatmapResponse = {
  start: string; // YYYY-MM
  end: string; // YYYY-MM
  months: LifeMonthCell[];
};

export async function getHeatmap(params?: {
  start?: string; // YYYY-MM
  end?: string; // YYYY-MM
  tz?: string;
}): Promise<LifeMonthHeatmapResponse> {
  const qs = new URLSearchParams();
  if (params?.start) qs.set("start", params.start);
  if (params?.end) qs.set("end", params.end);
  if (params?.tz) qs.set("tz", params.tz);
  const suffix = qs.size ? `?${qs.toString()}` : "";
  return fetcher<LifeMonthHeatmapResponse>(`/stats/heatmap${suffix}`);
}

export type MonthlyActivityResponse = {
  month: string; // YYYY-MM
  added: AnimeEntry[];
  completed: AnimeEntry[];
};

export async function getMonthlyActivity(params: {
  month: string; // YYYY-MM
}): Promise<MonthlyActivityResponse> {
  const qs = new URLSearchParams();
  qs.set("month", params.month);
  return fetcher<MonthlyActivityResponse>(`/stats/activity?${qs.toString()}`);
}

export type StatsSummaryResponse = {
  total: number;
  totalCompleted: number;
  totalWatching: number;
  avgRating: number | null;
  ratedCount: number;
  totalEpisodesWatched: number;
};

export async function getStatsSummary(): Promise<StatsSummaryResponse> {
  return fetcher<StatsSummaryResponse>(`/stats/summary`);
}

