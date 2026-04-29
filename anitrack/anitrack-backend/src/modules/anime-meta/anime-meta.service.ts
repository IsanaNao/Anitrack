import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiErrorException } from '../../shared/http/api-error.filter';
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
    @InjectModel(AnimeMeta.name) private readonly model: Model<AnimeMetaDocument>,
    private readonly config: ConfigService,
  ) {}

  private jikanBaseUrl() {
    return (this.config.get<string>('JIKAN_BASE_URL') ?? 'https://api.jikan.moe/v4').replace(/\/+$/, '');
  }

  async findByMalIds(malIds: number[]) {
    if (!malIds.length) return [];
    const docs = await this.model.find({ malId: { $in: malIds } });
    return docs.map((d) => d.toJSON());
  }

  private normalizeGenres(genres: Array<{ name?: string | null }> | null | undefined): string[] | undefined {
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

  async searchAndUpsert(q: string, opts?: { page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(opts?.page ?? 1) || 1);
    const limit = Math.max(1, Math.min(25, Number(opts?.pageSize ?? 10) || 10));
    const baseUrl = this.jikanBaseUrl();
    const url = `${baseUrl}/anime?q=${encodeURIComponent(q)}&page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}`;

    let res: Response;
    try {
      res = await fetch(url, { headers: { accept: 'application/json' } });
    } catch (e: any) {
      throw new ApiErrorException(502, 'UPSTREAM_ERROR', `Failed to reach Jikan API: ${e?.message ?? e}`);
    }

    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after');
      const hint = retryAfter ? ` (retry-after=${retryAfter}s)` : '';
      throw new ApiErrorException(429, 'UPSTREAM_RATE_LIMIT', `Jikan rate limit exceeded${hint}`);
    }

    if (!res.ok) {
      throw new ApiErrorException(502, 'UPSTREAM_ERROR', `Jikan API returned HTTP ${res.status}`);
    }

    let json: JikanSearchResponse;
    try {
      json = (await res.json()) as JikanSearchResponse;
    } catch {
      throw new ApiErrorException(502, 'UPSTREAM_ERROR', 'Jikan API returned invalid JSON');
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
    const byMalId = new Map<number, any>(cachedDocs.map((d) => [d.malId, d.toJSON()]));

    // Keep Jikan's order for UX.
    return { items: uniqueItems.map((i) => byMalId.get(i.malId) ?? i), pagination };
  }

  async getOrFetchByMalId(malId: number) {
    const existing = await this.model.findOne({ malId });
    if (existing) return existing.toJSON();

    const baseUrl = this.jikanBaseUrl();
    const url = `${baseUrl}/anime/${encodeURIComponent(String(malId))}`;

    let res: Response;
    try {
      res = await fetch(url, {
        headers: { accept: 'application/json' },
      });
    } catch (e: any) {
      throw new ApiErrorException(502, 'UPSTREAM_ERROR', `Failed to reach Jikan API: ${e?.message ?? e}`);
    }

    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after');
      const hint = retryAfter ? ` (retry-after=${retryAfter}s)` : '';
      throw new ApiErrorException(429, 'UPSTREAM_RATE_LIMIT', `Jikan rate limit exceeded${hint}`);
    }

    if (!res.ok) {
      throw new ApiErrorException(502, 'UPSTREAM_ERROR', `Jikan API returned HTTP ${res.status}`);
    }

    let json: JikanAnimeResponse;
    try {
      json = (await res.json()) as JikanAnimeResponse;
    } catch {
      throw new ApiErrorException(502, 'UPSTREAM_ERROR', 'Jikan API returned invalid JSON');
    }

    const data = json?.data;
    const title = (data?.title ?? '').trim();
    if (!title) {
      throw new ApiErrorException(502, 'UPSTREAM_ERROR', 'Jikan API response missing title');
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
    return created.toJSON();
  }
}

