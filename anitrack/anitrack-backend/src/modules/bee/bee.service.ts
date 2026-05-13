import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BangumiService } from '../bangumi/bangumi.service';
import { ApiErrorException } from '../../shared/http/api-error.filter';
import {
  flattenBangumiCalendar,
  jikanTitlesFromMirrorData,
  normalizeBangumiWallClock,
  pickBangumiTitleMatch,
  stripHtmlSummary,
} from './bee-mapping.util';
import { AnimeMirror, AnimeMirrorDocument } from './schemas/anime-mirror.schema';
import { ApiMapping, ApiMappingDocument } from './schemas/api-mapping.schema';
import { BeeState, BeeStateDocument } from './schemas/bee-state.schema';

type JikanSeasonNowResponse = {
  data?: Array<{ mal_id?: number }>;
};

type JikanAnimeResponse = {
  data?: unknown;
};

type JikanTopResponse = {
  data?: Array<{ mal_id?: number }>;
};

type JikanSeasonResponse = {
  data?: Array<{ mal_id?: number }>;
  pagination?: { has_next_page?: boolean };
};

function daysToMs(days: number) {
  return days * 24 * 60 * 60 * 1000;
}

const BACKFILL_STATE_KEY = 'season_backfill_cursor';
const SEED_RETRY_STATE_KEY = 'seed_retry_cursor';
const SEED_BACKOFF_STATE_KEY = 'seed_backoff_until';
const SEEDED_TOPS_STATE_KEY = 'seeded_top_tiers';
const SEASONS = ['winter', 'spring', 'summer', 'fall'] as const;
type SeasonKey = (typeof SEASONS)[number];

function currentSeasonKey(d = new Date()): SeasonKey {
  const m = d.getMonth() + 1;
  if (m <= 3) return 'winter';
  if (m <= 6) return 'spring';
  if (m <= 9) return 'summer';
  return 'fall';
}

function prevSeason(args: { year: number; season: SeasonKey }) {
  const idx = SEASONS.indexOf(args.season);
  const prevIdx = (idx - 1 + SEASONS.length) % SEASONS.length;
  const year = prevIdx === SEASONS.length - 1 ? args.year - 1 : args.year;
  return { year, season: SEASONS[prevIdx] as SeasonKey };
}

@Injectable()
export class BeeService implements OnModuleInit {
  private readonly log = new Logger(BeeService.name);
  private seasonalTotalHint = 0;
  private lastIdleLogAt = 0;

  constructor(
    @InjectModel(AnimeMirror.name)
    private readonly mirrorModel: Model<AnimeMirrorDocument>,
    @InjectModel(ApiMapping.name)
    private readonly apiMappingModel: Model<ApiMappingDocument>,
    @InjectModel(BeeState.name)
    private readonly stateModel: Model<BeeStateDocument>,
    private readonly config: ConfigService,
    private readonly bangumi: BangumiService,
  ) {}

  private syncEnabled() {
    const v = String(this.config.get<string>('SYNC_ENABLED') ?? '').trim();
    return v.toLowerCase() === 'true' || v === '1' || v.toLowerCase() === 'yes';
  }

  private bangumiEnabled() {
    const v = String(this.config.get<string>('BANGUMI_ENABLED') ?? 'true').trim();
    return !(v === '0' || v.toLowerCase() === 'false' || v.toLowerCase() === 'off');
  }

  private enabledTopTiers(): Array<'top_1y' | 'top_5y' | 'top_all'> {
    // Allow skipping tiers to avoid triggering rate limits on every startup.
    // Example: BEE_ENABLED_TOP_TIERS=top_5y,top_all
    // Use `off` / `none` / `false` to disable all /top/anime seeding and rely on
    // seasonal + quarterly /seasons/{year}/{season} backfill only.
    const raw = String(this.config.get<string>('BEE_ENABLED_TOP_TIERS') ?? '').trim();
    if (!raw) return ['top_1y', 'top_5y', 'top_all'];
    const low = raw.toLowerCase();
    if (low === 'off' || low === 'none' || low === 'false' || low === '-') return [];
    const parts = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const out: Array<'top_1y' | 'top_5y' | 'top_all'> = [];
    for (const p of parts) {
      if (p === 'top_1y' || p === 'top_5y' || p === 'top_all') out.push(p);
    }
    return out.length ? out : ['top_1y', 'top_5y', 'top_all'];
  }

  /** Pause between startup seed steps to reduce burst 429s (0 = disabled). */
  private seedStaggerMs() {
    const n = Number(this.config.get<string>('BEE_SEED_STAGGER_MS'));
    return Number.isFinite(n) && n > 0 ? Math.min(n, 120_000) : 0;
  }

  private async sleepSeedStagger() {
    const ms = this.seedStaggerMs();
    if (ms > 0) await new Promise((r) => setTimeout(r, ms));
  }

  /** Tiers that must be fully mirrored before we enqueue the next backfill season. */
  private highPriorityMirrorTiers(): Array<'seasonal' | 'top_1y' | 'top_5y' | 'top_all'> {
    const tiers: Array<'seasonal' | 'top_1y' | 'top_5y' | 'top_all'> = ['seasonal'];
    for (const t of this.enabledTopTiers()) tiers.push(t);
    return tiers;
  }

  private async countPendingHighPriorityMirrors(): Promise<number> {
    return this.mirrorModel.countDocuments({
      tier: { $in: this.highPriorityMirrorTiers() },
      $or: [{ data: { $exists: false } }, { lastUpdated: { $exists: false } }],
    });
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

  private ttlForTier(tier: AnimeMirror['tier']) {
    if (tier === 'seasonal') return daysToMs(7);
    if (tier === 'top_1y') return daysToMs(30); // Top40
    if (tier === 'top_5y') return daysToMs(60); // Top100
    if (tier === 'top_all') return daysToMs(180); // Top200
    return daysToMs(60); // backfill
  }

  async onModuleInit() {
    if (!this.syncEnabled()) return;
    // Seed steps are independent; don't let one failure block the others.
    const seed = async (label: string, fn: () => Promise<void>) => {
      try {
        await fn();
      } catch (e: any) {
        if (e instanceof ApiErrorException) {
          this.log.warn(
            `[Mirror] seed failed (${label}): status=${e.getStatus()} code=${e.code} message=${e.userMessage}`,
          );
          if (e.getStatus() === 429) {
            const until = Date.now() + 15 * 60 * 1000;
            await this.writeBackoffUntil(until, `429 during seed ${label}`);
          }
        } else {
          this.log.warn(`[Mirror] seed failed (${label}): ${e?.message ?? e}`);
        }
      }
    };

    await seed('seasonal', () => this.seedSeasonalQueue());
    const enabled = new Set(this.enabledTopTiers());
    if (enabled.has('top_1y')) {
      await this.sleepSeedStagger();
      await seed('top_1y', async () => {
        await this.seedTierTop({ count: 40, tier: 'top_1y', priority: 10 });
        await this.markTopSeeded('top_1y');
      });
    }
    if (enabled.has('top_5y')) {
      await this.sleepSeedStagger();
      await seed('top_5y', async () => {
        await this.seedTierTop({ count: 100, tier: 'top_5y', priority: 20 });
        await this.markTopSeeded('top_5y');
      });
    }
    if (enabled.has('top_all')) {
      await this.sleepSeedStagger();
      await seed('top_all', async () => {
        await this.seedTierTop({ count: 200, tier: 'top_all', priority: 30 });
        await this.markTopSeeded('top_all');
      });
    }
  }

  private async readBackoffUntil() {
    const doc = await this.stateModel.findOne({ key: SEED_BACKOFF_STATE_KEY }).lean();
    const ts = Number((doc?.value as any)?.untilMs);
    return Number.isFinite(ts) ? ts : 0;
  }

  private async writeBackoffUntil(untilMs: number, reason: string) {
    await this.stateModel.updateOne(
      { key: SEED_BACKOFF_STATE_KEY },
      { $set: { key: SEED_BACKOFF_STATE_KEY, value: { untilMs, reason } } },
      { upsert: true },
    );
  }

  private async getSeededTops(): Promise<Record<string, boolean>> {
    const doc = await this.stateModel
      .findOne({ key: SEEDED_TOPS_STATE_KEY })
      .lean();
    const v = doc?.value;
    if (!v || typeof v !== 'object') return {};
    return v as any;
  }

  private async markTopSeeded(tier: 'top_1y' | 'top_5y' | 'top_all') {
    const prev = await this.getSeededTops();
    await this.stateModel.updateOne(
      { key: SEEDED_TOPS_STATE_KEY },
      { $set: { key: SEEDED_TOPS_STATE_KEY, value: { ...prev, [tier]: true } } },
      { upsert: true },
    );
  }

  private async allTopTiersSeeded() {
    const need = this.enabledTopTiers();
    if (!need.length) return true;
    const v = await this.getSeededTops();
    for (const t of need) {
      if (!v[t]) return false;
    }
    return true;
  }

  async seedRetryStep() {
    if (!this.syncEnabled()) return;

    const backoffUntil = await this.readBackoffUntil();
    if (backoffUntil && Date.now() < backoffUntil) return;

    const baseTiers: Array<{
      tier: 'top_1y' | 'top_5y' | 'top_all';
      count: number;
      priority: number;
    }> = [
      { tier: 'top_1y', count: 40, priority: 10 },
      { tier: 'top_5y', count: 100, priority: 20 },
      { tier: 'top_all', count: 200, priority: 30 },
    ];
    const enabled = new Set(this.enabledTopTiers());
    const tiers = baseTiers.filter((t) => enabled.has(t.tier));
    if (!tiers.length) return;

    const cur = await this.stateModel.findOne({ key: SEED_RETRY_STATE_KEY }).lean();
    let idx = Number((cur?.value as any)?.idx ?? 0);
    if (!Number.isFinite(idx) || idx < 0) idx = 0;
    idx = idx % tiers.length;

    const pick = tiers[idx]!;
    try {
      await this.seedTierTop(pick);
      await this.markTopSeeded(pick.tier);
      idx = (idx + 1) % tiers.length;
      await this.stateModel.updateOne(
        { key: SEED_RETRY_STATE_KEY },
        { $set: { key: SEED_RETRY_STATE_KEY, value: { idx } } },
        { upsert: true },
      );
    } catch (e: any) {
      // If rate-limited, back off globally.
      if (e instanceof ApiErrorException && e.getStatus() === 429) {
        const until = Date.now() + 15 * 60 * 1000;
        await this.writeBackoffUntil(until, `429 during seed ${pick.tier}`);
      }
      throw e;
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
          $set: {
            source: 'seasonal' as const,
            tier: 'seasonal' as const,
            priority: 0,
          },
        },
        upsert: true,
      },
    }));

    await this.mirrorModel.bulkWrite(ops, { ordered: false });
    this.log.log(`[Mirror] Seasonal queue seeded: ${malIds.length} titles`);

    void this.tryBangumiMapSeasonal().catch((e: any) =>
      this.log.warn(`[Bee] Bangumi map after seasonal seed: ${e?.message ?? e}`),
    );
  }

  async seedTierTop(args: {
    count: number;
    tier: 'top_1y' | 'top_5y' | 'top_all';
    priority: number;
  }) {
    if (!this.syncEnabled()) return;

    const count = Math.max(1, Math.min(400, Number(args.count) || 1));
    const pages = Math.max(1, Math.ceil(count / 25));
    const pageSize = 25;

    const baseUrl = this.jikanBaseUrl();
    const ids: number[] = [];

    for (let page = 1; page <= pages; page++) {
      // "bypopularity" is stable for hot titles; keep it lightweight.
      const url = `${baseUrl}/top/anime?type=tv&filter=bypopularity&page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(pageSize))}&sfw=true`;
      const json = await this.fetchJikanJson<JikanTopResponse>(url);
      for (const x of json?.data ?? []) {
        const malId = Number(x?.mal_id);
        if (Number.isFinite(malId) && malId > 0) ids.push(malId);
      }
    }

    const malIds = Array.from(new Set(ids)).slice(0, count);
    if (!malIds.length) {
      this.log.warn('[Mirror] /top/anime returned empty list');
      return;
    }

    await this.mirrorModel.bulkWrite(
      malIds.map((malId) => ({
        updateOne: {
          filter: { malId },
          update: {
            // Never overwrite existing tier/priority; only seed if missing.
            $setOnInsert: {
              malId,
              source: 'general' as const,
              tier: args.tier,
              priority: args.priority,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );

    this.log.log(`[Mirror] Seeded ${args.tier}: +${malIds.length} titles`);
  }

  async enqueueGeneral(malId: number) {
    if (!Number.isFinite(malId) || malId <= 0) return;
    await this.mirrorModel.updateOne(
      { malId },
      {
        $setOnInsert: {
          malId,
          source: 'general',
          tier: 'backfill',
          priority: 90,
        },
      },
      { upsert: true },
    );
  }

  private isStale(doc: Pick<AnimeMirror, 'tier' | 'lastUpdated'>) {
    if (!doc.lastUpdated) return true;
    const age = Date.now() - new Date(doc.lastUpdated).getTime();
    const ttl = this.ttlForTier(doc.tier);
    return age >= ttl;
  }

  private async allowBackfillSync() {
    // Backfill should only run after all top tiers have been seeded successfully at least once.
    return await this.allTopTiersSeeded();
  }

  async syncBatch(batchSize = 3) {
    if (!this.syncEnabled()) return { synced: 0 };

    const nowMs = Date.now();
    const allowBackfill = await this.allowBackfillSync();
    // Pull by priority first (seasonal > top_1y > top_5y > top_all > backfill),
    // then by oldest lastUpdated.
    let docs = await this.mirrorModel
      .find({
        ...(allowBackfill ? {} : { tier: { $ne: 'backfill' } }),
        $or: [
          { data: { $exists: false } },
          { lastUpdated: { $exists: false } },
          // Conservative stale check: let syncOne do exact tier TTL gating.
          { lastUpdated: { $lt: new Date(nowMs - this.generalTtlMs()) } },
        ],
      })
      .sort({ priority: 1, lastUpdated: 1 })
      .limit(batchSize)
      .lean();

    // If we are truly idle for top tiers, start slow seasonal backfill.
    if (!docs.length && allowBackfill) {
      await this.seedBackfillNextSeason();
      docs = await this.mirrorModel
        .find({
          tier: 'backfill',
          $or: [{ data: { $exists: false } }, { lastUpdated: { $exists: false } }],
        })
        .sort({ priority: 1, lastUpdated: 1 })
        .limit(batchSize)
        .lean();
    }

    if (!docs.length) {
      // Avoid log spam: at most once per 10 minutes.
      if (nowMs - this.lastIdleLogAt > 10 * 60 * 1000) {
        this.lastIdleLogAt = nowMs;
        this.log.log('[Mirror] Idle (no stale or missing items to sync)');
      }
      return { synced: 0 };
    }

    let synced = 0;
    const byTier = new Map<string, number>();
    for (const d of docs) {
      try {
        const tier = String((d as any)?.tier ?? 'unknown');
        await this.syncOne(Number(d.malId));
        synced += 1;
        byTier.set(tier, (byTier.get(tier) ?? 0) + 1);
      } catch (e: any) {
        if (e instanceof ApiErrorException) {
          this.log.warn(
            `[Mirror] Sync failed malId=${d.malId}: status=${e.getStatus()} code=${e.code} message=${e.userMessage}`,
          );
        } else {
          this.log.warn(`[Mirror] Sync failed malId=${d.malId}: ${e?.message ?? e}`);
        }
      }
    }

    if (synced > 0) {
      const tiers = Array.from(byTier.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');

      let seasonalPart = '';
      if (this.seasonalTotalHint > 0) {
        const done = await this.mirrorModel.countDocuments({
          source: 'seasonal',
          lastUpdated: { $exists: true, $ne: null },
        });
        seasonalPart = ` seasonal=${done}/${this.seasonalTotalHint}`;
      }

      const progress = await this.progressSummary();
      this.log.log(
        `[Mirror] Synced ${synced} this tick (${tiers}).${seasonalPart} progress=${progress}`,
      );
    }

    return { synced };
  }

  async progressSnapshot() {
    const tiers: Array<AnimeMirror['tier']> = [
      'seasonal',
      'top_1y',
      'top_5y',
      'top_all',
      'backfill',
    ];
    const out: Record<string, { total: number; done: number }> = {};
    for (const t of tiers) {
      const [total, done] = await Promise.all([
        this.mirrorModel.countDocuments({ tier: t }),
        this.mirrorModel.countDocuments({
          tier: t,
          lastUpdated: { $exists: true, $ne: null },
          data: { $exists: true },
        }),
      ]);
      out[t] = { total, done };
    }
    const backoffUntil = await this.readBackoffUntil();
    return { tiers: out, backoffUntil };
  }

  /** 供排障：Bangumi ↔ MAL 映射与当季镜像覆盖情况（只读 Mongo，不请求外网）。 */
  async bangumiMappingSnapshot() {
    const [
      seasonalTotal,
      seasonalWithData,
      seasonalWithBgmId,
      seasonalWithSummaryCn,
      apiMappingTotal,
    ] = await Promise.all([
      this.mirrorModel.countDocuments({ tier: 'seasonal' }),
      this.mirrorModel.countDocuments({
        tier: 'seasonal',
        data: { $exists: true, $ne: null },
      }),
      this.mirrorModel.countDocuments({
        tier: 'seasonal',
        bgmId: { $exists: true, $ne: null },
      }),
      this.mirrorModel.countDocuments({
        tier: 'seasonal',
        'bangumi.summaryCn': { $exists: true, $ne: '' },
      }),
      this.apiMappingModel.countDocuments({}),
    ]);

    return {
      bangumiEnabled: this.bangumiEnabled(),
      seasonal: {
        totalQueued: seasonalTotal,
        withJikanData: seasonalWithData,
        withBgmId: seasonalWithBgmId,
        withSummaryCn: seasonalWithSummaryCn,
      },
      apiMappings: apiMappingTotal,
      hints: [
        'withBgmId > 0 表示至少部分当季条目已通过标题匹配挂上 Bangumi id。',
        'withSummaryCn 表示已拉到 v0 subject 并写入中文简介字段。',
        '手动触发映射：POST /api/bee/bangumi-map（会请求 Bangumi；建议日历缓存命中后再调）。',
      ],
    };
  }

  /** 手动触发一次 Bangumi 映射（与定时任务相同逻辑）。 */
  async triggerBangumiMapNow() {
    await this.tryBangumiMapSeasonal();
    return this.bangumiMappingSnapshot();
  }

  private async progressSummary() {
    const snap = await this.progressSnapshot();
    const fmt = (k: string, v: { done: number; total: number }) =>
      `${k}=${v.done}/${v.total}`;
    const t = snap.tiers as any;
    return [
      fmt('1y', t.top_1y),
      fmt('5y', t.top_5y),
      fmt('all', t.top_all),
      fmt('backfill', t.backfill),
    ].join(',');
  }

  private async seedBackfillNextSeason() {
    // Prevent premature backfill if some top tiers were not seeded due to rate limiting.
    if (!(await this.allTopTiersSeeded())) return;

    // Only start backfill when enabled high-priority tiers are fully synced at least once.
    const pendingHigh = await this.countPendingHighPriorityMirrors();
    if (pendingHigh > 0) return;

    const cur = await this.stateModel.findOne({ key: BACKFILL_STATE_KEY }).lean();
    let year: number;
    let season: SeasonKey;
    if (cur?.value && typeof cur.value === 'object') {
      year = Number((cur.value as any).year);
      season = String((cur.value as any).season) as SeasonKey;
      if (!Number.isFinite(year) || !SEASONS.includes(season)) {
        year = new Date().getFullYear();
        season = currentSeasonKey();
      }
    } else {
      year = new Date().getFullYear();
      season = currentSeasonKey();
    }

    // Quarter rollback: start from the previous season relative to "now".
    // Example: May -> current season is spring (April-start), so rollback starts at winter.
    const next = prevSeason({ year, season });
    const seeded = await this.seedSeasonQueue({ year: next.year, season: next.season });
    await this.stateModel.updateOne(
      { key: BACKFILL_STATE_KEY },
      { $set: { key: BACKFILL_STATE_KEY, value: { year: next.year, season: next.season } } },
      { upsert: true },
    );
    if (seeded > 0) {
      this.log.log(`[Mirror] Backfill seeded: ${next.year} ${next.season} (+${seeded})`);
    }
  }

  private async seedSeasonQueue(args: { year: number; season: SeasonKey }) {
    const baseUrl = this.jikanBaseUrl();
    const ids: number[] = [];
    for (let page = 1; page <= 4; page++) {
      const url = `${baseUrl}/seasons/${encodeURIComponent(String(args.year))}/${encodeURIComponent(args.season)}?sfw=true&limit=25&page=${encodeURIComponent(String(page))}`;
      const json = await this.fetchJikanJson<JikanSeasonResponse>(url);
      for (const x of json?.data ?? []) {
        const malId = Number(x?.mal_id);
        if (Number.isFinite(malId) && malId > 0) ids.push(malId);
      }
      if (!json?.pagination?.has_next_page) break;
    }
    const malIds = Array.from(new Set(ids));
    if (!malIds.length) return 0;

    await this.mirrorModel.bulkWrite(
      malIds.map((malId) => ({
        updateOne: {
          filter: { malId },
          update: {
            $setOnInsert: {
              malId,
              source: 'general' as const,
              tier: 'backfill' as const,
              priority: 90,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    return malIds.length;
  }

  async syncOne(malId: number) {
    if (!Number.isFinite(malId) || malId <= 0) {
      throw new ApiErrorException(400, 'VALIDATION_ERROR', 'Invalid malId');
    }

    const existing = await this.mirrorModel.findOne({ malId }).lean();
    if (existing?.data && existing?.tier && !this.isStale({ tier: existing.tier, lastUpdated: existing.lastUpdated })) {
      // Strictly skip: avoid redundant fetch + write.
      return;
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
          tier: 'backfill',
          priority: 90,
        },
      },
      { upsert: true },
    );
  }

  async getFreshMirror(malId: number) {
    const doc = await this.mirrorModel.findOne({ malId }).lean();
    if (!doc?.data) return null;
    if (this.isStale({ tier: doc.tier, lastUpdated: doc.lastUpdated })) return null;
    return doc;
  }

  /**
   * Random picks from mirrored **seasonal** tier only (Bee `/seasons/now` queue).
   * Read path for recommendations: **no Jikan HTTP** — requires documents with `data` already synced.
   */
  async sampleSeasonalMirrorDocs(size: number) {
    const n = Math.max(1, Math.min(25, Math.floor(size) || 1));
    return this.mirrorModel.aggregate<{ malId: number; data: unknown }>([
      {
        $match: {
          tier: 'seasonal',
          malId: { $gt: 0 },
          data: { $exists: true, $ne: null },
        },
      },
      { $sample: { size: n } },
      { $project: { _id: 0, malId: 1, data: 1 } },
    ]);
  }

  /**
   * 将当季 `AnimeMirror` 与 Bangumi `/calendar` 做标题匹配，写入 `ApiMapping` 与 `bgmId/titles`，
   * 并拉取 v0 subject 丰富 `bangumi.summaryCn`、播出字段。
   */
  async tryBangumiMapSeasonal() {
    if (!this.bangumiEnabled()) return;

    try {
      const calendar = await this.bangumi.getCalendarCached();
      const rows = flattenBangumiCalendar(calendar);
      if (!rows.length) {
        this.log.warn('[Bee] Bangumi calendar produced no rows');
        return;
      }

      const mirrors = await this.mirrorModel
        .find({
          tier: 'seasonal',
          data: { $exists: true, $ne: null },
        })
        .lean()
        .limit(220);

      let mapped = 0;
      let enriched = 0;

      for (const doc of mirrors) {
        const malId = Number(doc.malId);
        if (!Number.isFinite(malId) || malId <= 0) continue;

        if (doc.bgmId) {
          if (!doc.bangumi?.summaryCn) {
            try {
              await this.enrichBangumiSubject(malId, Number(doc.bgmId));
              enriched += 1;
            } catch (e: any) {
              this.log.warn(`[Bee] enrich malId=${malId}: ${e?.message ?? e}`);
            }
          }
          continue;
        }

        const jt = jikanTitlesFromMirrorData(doc.data);
        const pick = pickBangumiTitleMatch(jt, rows);
        if (!pick?.item?.id) continue;

        const bgmId = Number(pick.item.id);
        if (!Number.isFinite(bgmId) || bgmId <= 0) continue;

        const taken = await this.apiMappingModel.findOne({ bgmId }).lean();
        if (taken && Number(taken.malId) !== malId) continue;

        try {
          await this.apiMappingModel.updateOne(
            { malId },
            { $set: { malId, bgmId, lastMapped: new Date() } },
            { upsert: true },
          );
        } catch (e: any) {
          if (e?.code === 11000) {
            this.log.warn(`[Bee] skip malId=${malId} bgmId=${bgmId} (mapping duplicate)`);
            continue;
          }
          throw e;
        }

        const titleJp = typeof pick.item.name === 'string' ? pick.item.name : '';
        const titleCn =
          typeof pick.item.name_cn === 'string' && pick.item.name_cn.trim()
            ? pick.item.name_cn.trim()
            : titleJp;
        const titleEn =
          typeof pick.item.name_en === 'string' && pick.item.name_en.trim()
            ? pick.item.name_en.trim()
            : '';

        const display = titleCn || titleJp || String(bgmId);

        const wallClock = normalizeBangumiWallClock(
          typeof pick.item.time === 'string' ? pick.item.time : undefined,
        );

        await this.mirrorModel.updateOne(
          { malId },
          {
            $set: {
              bgmId,
              titles: { cn: titleCn, jp: titleJp, en: titleEn },
              bangumi: {
                weekday: pick.bucketWeekday ?? pick.item.air_weekday,
                airTime: wallClock,
              },
            },
          },
        );

        this.log.log(`[Bee] Mapped MAL:${malId} to BGM:${bgmId} (${display})`);
        mapped += 1;

        try {
          await this.enrichBangumiSubject(malId, bgmId);
          enriched += 1;
        } catch (e: any) {
          this.log.warn(`[Bee] enrich after map malId=${malId}: ${e?.message ?? e}`);
        }
      }

      if (mapped > 0 || enriched > 0) {
        this.log.log(`[Bee] Bangumi map pass: newMappings=${mapped}, enrich=${enriched}`);
      }
    } catch (e: any) {
      if (e instanceof ApiErrorException && e.getStatus() === 429) {
        this.log.warn(`[Bee] Bangumi map: ${e.userMessage}`);
        return;
      }
      this.log.warn(`[Bee] Bangumi map failed: ${e?.message ?? e}`);
    }
  }

  private async enrichBangumiSubject(malId: number, bgmId: number) {
    const sub = await this.bangumi.getSubjectV0Cached(bgmId);
    const summaryRaw = typeof sub.summary === 'string' ? sub.summary : '';
    const summaryCn = summaryRaw ? stripHtmlSummary(summaryRaw) : undefined;

    const airWeekday =
      typeof sub.air_weekday === 'number'
        ? sub.air_weekday
        : typeof (sub as { airweekday?: unknown }).airweekday === 'number'
          ? Number((sub as { airweekday?: number }).airweekday)
          : undefined;

    const airTimeRaw =
      typeof (sub as { time?: unknown }).time === 'string'
        ? String((sub as { time?: string }).time)
        : typeof (sub as { air_time?: unknown }).air_time === 'string'
          ? String((sub as { air_time?: string }).air_time)
          : undefined;
    const airTimeNorm = normalizeBangumiWallClock(airTimeRaw);

    const cur = await this.mirrorModel.findOne({ malId }).lean();
    const prevB = (cur?.bangumi ?? {}) as {
      weekday?: number;
      airTime?: string;
      summaryCn?: string;
    };

    const merged = {
      ...prevB,
      summaryCn: summaryCn ?? prevB.summaryCn,
      weekday: typeof airWeekday === 'number' ? airWeekday : prevB.weekday,
      airTime:
        airTimeNorm ??
        normalizeBangumiWallClock(prevB.airTime) ??
        prevB.airTime,
      detailFetchedAt: new Date().toISOString(),
    };

    await this.mirrorModel.updateOne({ malId }, { $set: { bangumi: merged } });
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

