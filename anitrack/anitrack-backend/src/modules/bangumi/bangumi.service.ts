import { Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { ApiErrorException } from '../../shared/http/api-error.filter';
import { normalizeTitle } from '../bee/bee-mapping.util';
import type { BangumiCalendarDay } from './bangumi.types';

const CALENDAR_URL = 'https://api.bgm.tv/calendar';

@Injectable()
export class BangumiService {
  constructor(
    private readonly config: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private userAgent() {
    return (
      this.config.get<string>('BANGUMI_USER_AGENT') ??
      this.config.get<string>('JIKAN_USER_AGENT') ??
      'AnitrackBangumi/1.0 (+https://example.local; contact=dev)'
    ).trim();
  }

  private cacheTtlMs() {
    return 24 * 60 * 60 * 1000;
  }

  private bangumiBackoffUntilMs = 0;

  private async fetchJson<T>(url: string): Promise<T> {
    if (Date.now() < this.bangumiBackoffUntilMs) {
      throw new ApiErrorException(
        429,
        'UPSTREAM_RATE_LIMIT',
        'Bangumi temporarily skipped (local backoff)',
      );
    }

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          accept: 'application/json',
          'user-agent': this.userAgent(),
        },
      });
    } catch (e: any) {
      throw new ApiErrorException(
        502,
        'UPSTREAM_ERROR',
        `Failed to reach Bangumi API: ${e?.message ?? e}`,
      );
    }

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const waitSec = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 900;
      this.bangumiBackoffUntilMs = Date.now() + waitSec * 1000;
      throw new ApiErrorException(
        429,
        'UPSTREAM_RATE_LIMIT',
        `Bangumi rate limit exceeded (retry after ~${waitSec}s)`,
      );
    }

    if (!res.ok) {
      let detail = '';
      try {
        const text = await res.text();
        detail = text ? ` — ${text.slice(0, 200)}` : '';
      } catch {
        /* ignore */
      }
      throw new ApiErrorException(
        res.status === 429 ? 429 : 502,
        res.status === 429 ? 'UPSTREAM_RATE_LIMIT' : 'UPSTREAM_ERROR',
        `Bangumi API ${url} returned HTTP ${res.status}${detail}`,
      );
    }

    try {
      return (await res.json()) as T;
    } catch {
      throw new ApiErrorException(
        502,
        'UPSTREAM_ERROR',
        'Bangumi API returned invalid JSON',
      );
    }
  }

  private async fetchJsonPost<T>(url: string, body: unknown): Promise<T> {
    if (Date.now() < this.bangumiBackoffUntilMs) {
      throw new ApiErrorException(
        429,
        'UPSTREAM_RATE_LIMIT',
        'Bangumi temporarily skipped (local backoff)',
      );
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'user-agent': this.userAgent(),
        },
        body: JSON.stringify(body),
      });
    } catch (e: any) {
      throw new ApiErrorException(
        502,
        'UPSTREAM_ERROR',
        `Failed to reach Bangumi API: ${e?.message ?? e}`,
      );
    }

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const waitSec = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 900;
      this.bangumiBackoffUntilMs = Date.now() + waitSec * 1000;
      throw new ApiErrorException(
        429,
        'UPSTREAM_RATE_LIMIT',
        `Bangumi rate limit exceeded (retry after ~${waitSec}s)`,
      );
    }

    if (!res.ok) {
      let detail = '';
      try {
        const text = await res.text();
        detail = text ? ` — ${text.slice(0, 200)}` : '';
      } catch {
        /* ignore */
      }
      throw new ApiErrorException(
        res.status === 429 ? 429 : 502,
        res.status === 429 ? 'UPSTREAM_RATE_LIMIT' : 'UPSTREAM_ERROR',
        `Bangumi API POST ${url} returned HTTP ${res.status}${detail}`,
      );
    }

    try {
      return (await res.json()) as T;
    } catch {
      throw new ApiErrorException(
        502,
        'UPSTREAM_ERROR',
        'Bangumi API returned invalid JSON',
      );
    }
  }

  /** 24h 缓存，与 Jikan CacheModule 策略对齐（按 URL 键控）。 */
  async getCalendarCached(): Promise<BangumiCalendarDay[]> {
    const key = 'bangumi:calendar';
    const cached = await this.cache.get<BangumiCalendarDay[]>(key);
    if (cached) return cached;

    const json = await this.fetchJson<unknown>(CALENDAR_URL);
    const arr = Array.isArray(json) ? json : [];
    await this.cache.set(key, arr, this.cacheTtlMs());
    return arr as BangumiCalendarDay[];
  }

  /**
   * Bangumi v0 条目搜索（动画 type=2），24h 缓存。
   * 用于非当季番剧（清单条目）建立 MAL ↔ BGM 映射。
   */
  async searchSubjectsCached(
    keyword: string,
    limit = 8,
  ): Promise<
    Array<{ id: number; name?: string; name_cn?: string; name_en?: string }>
  > {
    const q = String(keyword ?? '').trim();
    if (!q) return [];
    const capped = Math.min(20, Math.max(1, limit));
    const url = 'https://api.bgm.tv/v0/search/subjects';
    const key = `bangumi:search:post:${normalizeTitle(q)}:${capped}`;
    const cached = await this.cache.get<
      Array<{ id: number; name?: string; name_cn?: string; name_en?: string }>
    >(key);
    if (cached) return cached;

    const json = (await this.fetchJsonPost<{ data?: unknown[] }>(url, {
      keyword: q,
      filter: { type: [2] },
      limit: capped,
    })) as { data?: unknown[] };
    const items = (json?.data ?? [])
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const o = row as Record<string, unknown>;
        const id = Number(o.id);
        if (!Number.isFinite(id) || id <= 0) return null;
        return {
          id,
          name: typeof o.name === 'string' ? o.name : undefined,
          name_cn: typeof o.name_cn === 'string' ? o.name_cn : undefined,
          name_en: typeof o.name_en === 'string' ? o.name_en : undefined,
        };
      })
      .filter((v): v is NonNullable<typeof v> => Boolean(v));

    await this.cache.set(key, items, this.cacheTtlMs());
    return items;
  }

  async getSubjectV0Cached(subjectId: number): Promise<Record<string, unknown>> {
    if (!Number.isFinite(subjectId) || subjectId <= 0) {
      throw new ApiErrorException(400, 'VALIDATION_ERROR', 'Invalid Bangumi subject id');
    }
    const url = `https://api.bgm.tv/v0/subjects/${encodeURIComponent(String(subjectId))}`;
    const key = `bangumi:subject:${subjectId}`;
    const cached = await this.cache.get<Record<string, unknown>>(key);
    if (cached) return cached;

    const json = (await this.fetchJson<unknown>(url)) as Record<string, unknown>;
    await this.cache.set(key, json, this.cacheTtlMs());
    return json;
  }
}
