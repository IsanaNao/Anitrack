import { Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { ApiErrorException } from '../../shared/http/api-error.filter';
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
      throw new ApiErrorException(
        502,
        'UPSTREAM_ERROR',
        `Bangumi API returned HTTP ${res.status}`,
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
