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
  score?: number;
}

export interface AnimeEntry {
  id: string;
  userId: string;
  malId: number;
  status: AnimeStatus;
  rating?: number;
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

