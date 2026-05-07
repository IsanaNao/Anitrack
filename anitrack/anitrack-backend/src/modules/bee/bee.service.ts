import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiErrorException } from '../../shared/http/api-error.filter';
import { AnimeMirror, AnimeMirrorDocument } from './schemas/anime-mirror.schema';

type JikanSeasonNowResponse = {
  data?: Array<{ mal_id?: number }>;
};

type JikanAnimeResponse = {
  data?: unknown;
};

function daysToMs(days: number) {
  return days * 24 * 60 * 60 * 1000;
}

@Injectable()
export class BeeService implements OnModuleInit {
  private readonly log = new Logger(BeeService.name);
  private seasonalTotalHint = 0;

  constructor(
    @InjectModel(AnimeMirror.name)
    private readonly mirrorModel: Model<AnimeMirrorDocument>,
    private readonly config: ConfigService,
  ) {}

  private syncEnabled() {
    const v = String(this.config.get<string>('SYNC_ENABLED') ?? '').trim();
    return v.toLowerCase() === 'true' || v === '1' || v.toLowerCase() === 'yes';
  }

  private jikanBaseUrl() {
    return (
      this.config.get<string>('JIKAN_BASE_URL') ?? 'https://api.jikan.moe/v4'
    ).replace(/\/+$/, '');
  }

  private userAgent() {
    return (
      this.config.get<string>('JIKAN_USER_AGENT') ??
      'AnitrackBee/1.0 (+https://example.local; contact=dev)'
    ).trim();
  }

  private seasonalTtlMs() {
    // Seasonal titles change quickly.
    return daysToMs(3);
  }

  private generalTtlMs() {
    return daysToMs(30);
  }

  async onModuleInit() {
    if (!this.syncEnabled()) return;
    try {
      await this.seedSeasonalQueue();
    } catch (e: any) {
      this.log.warn(`Seed seasonal queue failed: ${e?.message ?? e}`);
    }
  }

  async seedSeasonalQueue() {
    if (!this.syncEnabled()) return;

    const baseUrl = this.jikanBaseUrl();
    const url = `${baseUrl}/seasons/now?sfw=true&limit=25&page=1`;

    const json = await this.fetchJikanJson<JikanSeasonNowResponse>(url);
    const malIds = Array.from(
      new Set(
        (json?.data ?? [])
          .map((x) => Number(x?.mal_id))
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    );

    if (!malIds.length) {
      this.log.warn('[Mirror] /seasons/now returned empty list');
      return;
    }

    this.seasonalTotalHint = malIds.length;

    const ops = malIds.map((malId) => ({
      updateOne: {
        filter: { malId },
        update: {
          // With upsert, `malId` from the filter will be included in inserted docs.
          // Only set `source` once to avoid MongoDB path conflict.
          $set: { source: 'seasonal' as const },
        },
        upsert: true,
      },
    }));

    await this.mirrorModel.bulkWrite(ops, { ordered: false });
    this.log.log(`[Mirror] Seasonal queue seeded: ${malIds.length} titles`);
  }

  async enqueueGeneral(malId: number) {
    if (!Number.isFinite(malId) || malId <= 0) return;
    await this.mirrorModel.updateOne(
      { malId },
      { $setOnInsert: { malId, source: 'general' } },
      { upsert: true },
    );
  }

  private isStale(doc: Pick<AnimeMirror, 'source' | 'lastUpdated'>) {
    if (!doc.lastUpdated) return true;
    const age = Date.now() - new Date(doc.lastUpdated).getTime();
    const ttl = doc.source === 'seasonal' ? this.seasonalTtlMs() : this.generalTtlMs();
    return age >= ttl;
  }

  async syncBatch(batchSize = 3) {
    if (!this.syncEnabled()) return { synced: 0 };

    // Priority: seasonal stale/missing first, then general stale/missing.
    const now = new Date();
    const seasonalCutoff = new Date(now.getTime() - this.seasonalTtlMs());
    const generalCutoff = new Date(now.getTime() - this.generalTtlMs());

    const pick = async (source: 'seasonal' | 'general', cutoff: Date) => {
      return this.mirrorModel
        .find({
          source,
          $or: [{ lastUpdated: { $exists: false } }, { lastUpdated: { $lt: cutoff } }],
        })
        .sort({ lastUpdated: 1 })
        .limit(batchSize)
        .lean();
    };

    let docs = await pick('seasonal', seasonalCutoff);
    if (!docs.length) docs = await pick('general', generalCutoff);
    if (!docs.length) return { synced: 0 };

    let synced = 0;
    for (const d of docs) {
      try {
        await this.syncOne(Number(d.malId));
        synced += 1;
      } catch (e: any) {
        this.log.warn(`[Mirror] Sync failed malId=${d.malId}: ${e?.message ?? e}`);
      }
    }

    if (synced > 0 && this.seasonalTotalHint > 0) {
      const done = await this.mirrorModel.countDocuments({
        source: 'seasonal',
        lastUpdated: { $exists: true, $ne: null },
      });
      this.log.log(`[Mirror] Synced ${synced} this tick. seasonal=${done}/${this.seasonalTotalHint}`);
    } else if (synced > 0) {
      this.log.log(`[Mirror] Synced ${synced} this tick.`);
    }

    return { synced };
  }

  async syncOne(malId: number) {
    if (!Number.isFinite(malId) || malId <= 0) {
      throw new ApiErrorException(400, 'VALIDATION_ERROR', 'Invalid malId');
    }

    const baseUrl = this.jikanBaseUrl();
    const url = `${baseUrl}/anime/${encodeURIComponent(String(malId))}?sfw=true`;
    const json = await this.fetchJikanJson<JikanAnimeResponse>(url);

    await this.mirrorModel.updateOne(
      { malId },
      {
        $set: {
          malId,
          data: json,
          lastUpdated: new Date(),
        },
        $setOnInsert: {
          source: 'general',
        },
      },
      { upsert: true },
    );
  }

  async getFreshMirror(malId: number) {
    const doc = await this.mirrorModel.findOne({ malId }).lean();
    if (!doc?.data) return null;
    if (this.isStale({ source: doc.source, lastUpdated: doc.lastUpdated })) return null;
    return doc;
  }

  private async fetchJikanJson<T>(url: string): Promise<T> {
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

    try {
      return (await res.json()) as T;
    } catch {
      throw new ApiErrorException(
        502,
        'UPSTREAM_ERROR',
        'Jikan API returned invalid JSON',
      );
    }
  }
}

