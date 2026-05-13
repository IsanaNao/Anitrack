import { Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Cache } from 'cache-manager';
import { ApiErrorException } from '../../shared/http/api-error.filter';
import { BeeService } from '../bee/bee.service';
import { AnimeMeta, AnimeMetaDocument } from './schemas/anime-meta.schema';
import type { JikanPagination } from './dto/anime-meta-search.dto';

type JikanAnimeResponse = {
  data?: {
    mal_id?: number;
    title?: string;
    episodes?: number | null;
    score?: number | null;
    images?: { jpg?: { image_url?: string | null } };
    synopsis?: string | null;
    genres?: Array<{ mal_id?: number; name?: string | null }> | null;
  };
};

type JikanSearchResponse = {
  data?: Array<{
    mal_id?: number;
    title?: string;
    episodes?: number | null;
    score?: number | null;
    images?: { jpg?: { image_url?: string | null } };
    synopsis?: string | null;
    genres?: Array<{ mal_id?: number; name?: string | null }> | null;
  }>;
  pagination?: JikanPagination;
};

@Injectable()
export class AnimeMetaService {
  constructor(
    @InjectModel(AnimeMeta.name)
    private readonly model: Model<AnimeMetaDocument>,
    private readonly config: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly bee: BeeService,
  ) {}

  private jikanBaseUrl() {
    return (
      this.config.get<string>('JIKAN_BASE_URL') ?? 'https://api.jikan.moe/v4'
    ).replace(/\/+$/, '');
  }

  private buildQueryVariants(input: string): string[] {
    const q = input.trim();
    if (!q) return [];

    const out: string[] = [];
    const push = (s: string) => {
      const v = s.trim().replace(/\s+/g, ' ');
      if (!v) return;
      if (out.some((x) => x.toLowerCase() === v.toLowerCase())) return;
      out.push(v);
    };

    push(q);

    // If user typed without spaces (common on mobile), try a few lightweight variants.
    if (!/\s/.test(q)) {
      // Replace common separators.
      push(q.replace(/[-_]+/g, ' '));

      // Heuristic for "lovelive" style: insert a space between two alphabetic runs.
      // This is intentionally simple; it just provides better recall for known franchises.
      const alpha = q.replace(/[^a-zA-Z0-9]/g, '');
      if (alpha.length >= 8 && /^[a-zA-Z]+$/.test(alpha)) {
        for (let i = 3; i <= Math.min(alpha.length - 3, 6); i++) {
          push(`${alpha.slice(0, i)} ${alpha.slice(i)}`);
        }
      }
    }

    return out;
  }

  private jikanCacheTtlSeconds() {
    return 24 * 60 * 60; // 24h
  }

  private async cachedJikanJson<T>(url: string): Promise<T> {
    const key = `jikan:${url}`;
    const cached = await this.cache.get<T>(key);
    if (cached) return cached;

    let res: Response;
    try {
      res = await fetch(url, { headers: { accept: 'application/json' } });
    } catch (e: any) {
      throw new ApiErrorException(
        502,
        'UPSTREAM_ERROR',
        `Failed to reach Jikan API: ${e?.message ?? e}`,
      );
    }

    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after');
      const hint = retryAfter ? ` (retry-after=${retryAfter}s)` : '';
      throw new ApiErrorException(
        429,
        'UPSTREAM_RATE_LIMIT',
        `Jikan rate limit exceeded${hint}`,
      );
    }

    if (!res.ok) {
      throw new ApiErrorException(
        502,
        'UPSTREAM_ERROR',
        `Jikan API returned HTTP ${res.status}`,
      );
    }

    let json: T;
    try {
      json = (await res.json()) as T;
    } catch {
      throw new ApiErrorException(
        502,
        'UPSTREAM_ERROR',
        'Jikan API returned invalid JSON',
      );
    }

    await this.cache.set(key, json, this.jikanCacheTtlSeconds() * 1000);
    return json;
  }

  private async jikanSearchOnce(args: {
    q: string;
    page: number;
    limit: number;
  }) {
    const baseUrl = this.jikanBaseUrl();
    const url = `${baseUrl}/anime?q=${encodeURIComponent(args.q)}&page=${encodeURIComponent(String(args.page))}&limit=${encodeURIComponent(String(args.limit))}&sfw=true`;
    return this.cachedJikanJson<JikanSearchResponse>(url);
  }

  async findByMalIds(malIds: number[]) {
    if (!malIds.length) return [];
    const docs = await this.model.find({ malId: { $in: malIds } });
    return docs.map((d) => d.toJSON());
  }

  private normalizeGenres(
    genres: Array<{ name?: string | null }> | null | undefined,
  ): string[] | undefined {
    const names = (genres ?? [])
      .map((g) => (g?.name ?? '').trim())
      .filter((s) => Boolean(s));
    if (!names.length) return undefined;
    // preserve order, dedupe
    const seen = new Set<string>();
    const out: string[] = [];
    for (const n of names) {
      if (seen.has(n)) continue;
      seen.add(n);
      out.push(n);
    }
    return out;
  }

  async searchAndUpsert(
    q: string,
    opts?: { page?: number; pageSize?: number },
  ) {
    const page = Math.max(1, Number(opts?.page ?? 1) || 1);
    const limit = Math.max(1, Math.min(25, Number(opts?.pageSize ?? 10) || 10));
    const variants = this.buildQueryVariants(q);

    // Strategy:
    // - Always try the original query first.
    // - If results are sparse AND we have variants, try one more best-effort query and merge.
    const first = await this.jikanSearchOnce({
      q: variants[0] ?? q,
      page,
      limit,
    });
    let json: JikanSearchResponse = first;

    const firstCount = (first?.data ?? []).length;
    if (
      variants.length > 1 &&
      firstCount < Math.max(3, Math.floor(limit / 3))
    ) {
      // Second attempt: pick the first variant that differs from the original.
      const secondQ = variants
        .slice(1)
        .find((v) => v.toLowerCase() !== (variants[0] ?? q).toLowerCase());
      if (secondQ) {
        const second = await this.jikanSearchOnce({ q: secondQ, page, limit });
        json = {
          pagination: first.pagination ?? second.pagination,
          data: [...(first.data ?? []), ...(second.data ?? [])],
        };
      }
    }

    const items = (json?.data ?? [])
      .map((d) => {
        const malId = Number(d?.mal_id);
        const title = (d?.title ?? '').trim();
        if (!Number.isFinite(malId) || malId <= 0 || !title) return null;
        const totalEpisodes = d?.episodes ?? undefined;
        const genres = this.normalizeGenres(d?.genres ?? undefined);
        return {
          malId,
          title,
          imageUrl: d?.images?.jpg?.image_url ?? undefined,
          episodes: totalEpisodes,
          totalEpisodes,
          score: d?.score ?? undefined,
          synopsis: typeof d?.synopsis === 'string' ? d.synopsis : undefined,
          genres,
        };
      })
      .filter((v): v is NonNullable<typeof v> => Boolean(v));

    const pagination: JikanPagination = json?.pagination ?? {
      current_page: page,
      last_visible_page: page,
      has_next_page: false,
      items: { count: items.length, per_page: limit, total: items.length },
    };

    if (!items.length) {
      return { items: [], pagination };
    }

    // De-dup by malId (keep first occurrence order for UX).
    const seen = new Set<number>();
    const uniqueItems = items.filter((i) => {
      if (seen.has(i.malId)) return false;
      seen.add(i.malId);
      return true;
    });

    // Atomic-ish bulk upsert: one ordered bulkWrite for the returned list.
    await this.model.bulkWrite(
      uniqueItems.map((m) => ({
        updateOne: {
          filter: { malId: m.malId },
          update: { $set: m },
          upsert: true,
        },
      })),
      { ordered: true },
    );

    const malIds = uniqueItems.map((i) => i.malId);
    const cachedDocs = await this.model.find({ malId: { $in: malIds } });
    const byMalId = new Map<number, any>(
      cachedDocs.map((d) => [d.malId, d.toJSON()]),
    );

    // Keep Jikan's order for UX.
    return {
      items: uniqueItems.map((i) => byMalId.get(i.malId) ?? i),
      pagination,
    };
  }

  async getOrFetchByMalId(malId: number) {
    const existing = await this.model.findOne({ malId });
    if (existing) return existing.toJSON();

    // Mirror-first: if Bee has synced this title recently, prefer local Mongo mirror.
    const mirrored = await this.bee.getFreshMirror(malId);
    const mirroredData: any = (mirrored as any)?.data?.data ?? null;
    if (mirroredData && typeof mirroredData === 'object') {
      const title = String(mirroredData?.title ?? '').trim();
      if (title) {
        const totalEpisodes = mirroredData?.episodes ?? undefined;
        const genres = this.normalizeGenres(mirroredData?.genres ?? undefined);
        const created = await this.model.create({
          malId,
          title,
          imageUrl: mirroredData?.images?.jpg?.image_url ?? undefined,
          episodes: totalEpisodes,
          totalEpisodes,
          score: mirroredData?.score ?? undefined,
          synopsis:
            typeof mirroredData?.synopsis === 'string'
              ? mirroredData.synopsis
              : undefined,
          genres,
        });
        return created.toJSON();
      }
    }

    const baseUrl = this.jikanBaseUrl();
    const url = `${baseUrl}/anime/${encodeURIComponent(String(malId))}?sfw=true`;
    const json = await this.cachedJikanJson<JikanAnimeResponse>(url);

    const data = json?.data;
    const title = (data?.title ?? '').trim();
    if (!title) {
      throw new ApiErrorException(
        502,
        'UPSTREAM_ERROR',
        'Jikan API response missing title',
      );
    }

    const totalEpisodes = data?.episodes ?? undefined;
    const genres = this.normalizeGenres(data?.genres ?? undefined);
    const created = await this.model.create({
      malId,
      title,
      imageUrl: data?.images?.jpg?.image_url ?? undefined,
      episodes: totalEpisodes,
      totalEpisodes,
      score: data?.score ?? undefined,
      synopsis: typeof data?.synopsis === 'string' ? data.synopsis : undefined,
      genres,
    });

    // Passive enqueue for mirror (general), so restart/resume will eventually cover it.
    void this.bee.enqueueGeneral(malId);

    return created.toJSON();
  }

  /**
   * Dashboard / discovery: random **seasonal** titles from `AnimeMirror` (Bee), no Jikan calls.
   */
  async randomSeasonalFromMirror(limit: number) {
    const raw = await this.bee.sampleSeasonalMirrorDocs(limit);
    const items = raw
      .map((row) => {
        const inner = (row as { data?: { data?: Record<string, unknown> } })?.data
          ?.data as Record<string, unknown> | undefined;
        if (!inner || typeof inner !== 'object') return null;
        const malId = Number(row.malId);
        const title = String(inner.title ?? '').trim();
        if (!Number.isFinite(malId) || malId <= 0 || !title) return null;
        const images = inner.images as
          | { jpg?: { image_url?: string | null } }
          | undefined;
        const totalEpisodes = inner.episodes as number | null | undefined;
        const genres = this.normalizeGenres(
          inner.genres as Array<{ name?: string | null }> | null | undefined,
        );
        return {
          malId,
          title,
          imageUrl: images?.jpg?.image_url ?? undefined,
          episodes: totalEpisodes ?? undefined,
          totalEpisodes: totalEpisodes ?? undefined,
          score: (inner.score as number | null | undefined) ?? undefined,
          synopsis:
            typeof inner.synopsis === 'string' ? inner.synopsis : undefined,
          genres,
        };
      })
      .filter((v): v is NonNullable<typeof v> => Boolean(v));
    return { items };
  }
}
