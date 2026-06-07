import { Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Cache } from 'cache-manager';
import {
  ApiErrorException,
  describeApiError,
} from '../../shared/http/api-error.filter';
import { stripHtmlSummary } from '../bee/bee-mapping.util';
import { BeeService } from '../bee/bee.service';
import { AnimeMirror, AnimeMirrorDocument } from '../bee/schemas/anime-mirror.schema';
import { AnimeMeta, AnimeMetaDocument } from './schemas/anime-meta.schema';
import type { JikanPagination } from './dto/anime-meta-search.dto';
import {
  berlinInstantAtDayOffset,
  bangumiWeekdayFromBerlinInstant,
  formatDateSlashBerlin,
  formatWeekdayShortZhBerlin,
  formatYmdBerlin,
  tokyoWallToBerlinClock,
} from './timetable.util';
import { resolveTimetableAirTimeRaw, resolveTimetableWeekdayBangumi } from './timetable-air-resolve';

const TIMETABLE_TZ = 'Europe/Berlin';

type JikanAnimeResponse = {
  data?: {
    mal_id?: number;
    title?: string;
    title_english?: string | null;
    title_japanese?: string | null;
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
  private readonly log = new Logger(AnimeMetaService.name);
  private seasonalMirrorI18nTask: Promise<void> | null = null;

  constructor(
    @InjectModel(AnimeMeta.name)
    private readonly model: Model<AnimeMetaDocument>,
    @InjectModel(AnimeMirror.name)
    private readonly mirrorModel: Model<AnimeMirrorDocument>,
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

  /** 从 `AnimeMirror` 快照提取多语言标题（供前端 i18n 展示，不写回 `AnimeMeta`）。 */
  private extractTitlesFromMirrorRow(row: {
    titles?: { cn?: string; jp?: string; en?: string };
    data?: unknown;
  }): { titleCn?: string; titleJp?: string; titleEn?: string } {
    const inner = (row.data as { data?: Record<string, unknown> } | undefined)
      ?.data;
    const innerTitleEn =
      inner && typeof inner.title_english === 'string'
        ? String(inner.title_english).trim()
        : '';
    const innerTitleJp =
      inner && typeof inner.title_japanese === 'string'
        ? String(inner.title_japanese).trim()
        : '';
    const titleCn =
      typeof row.titles?.cn === 'string' ? row.titles.cn.trim() : '';
    const titleJp =
      (typeof row.titles?.jp === 'string' ? row.titles.jp.trim() : '') ||
      innerTitleJp ||
      '';
    const titleEn =
      (typeof row.titles?.en === 'string' ? row.titles.en.trim() : '') ||
      innerTitleEn ||
      '';
    return {
      titleCn: titleCn || undefined,
      titleJp: titleJp || undefined,
      titleEn: titleEn || undefined,
    };
  }

  private attachMirrorI18n(
    meta: Record<string, unknown>,
    row?: {
      titles?: { cn?: string; jp?: string; en?: string };
      bangumi?: { summaryCn?: string };
      data?: unknown;
    } | null,
  ): Record<string, unknown> {
    const fromMirror = row ? this.extractTitlesFromMirrorRow(row) : {};
    const docCn =
      typeof meta.titleCn === 'string' ? meta.titleCn.trim() : '';
    const docJp =
      typeof meta.titleJp === 'string' ? meta.titleJp.trim() : '';
    const docEn =
      typeof meta.titleEn === 'string' ? meta.titleEn.trim() : '';
    const docSynopsisCn =
      typeof meta.synopsisCn === 'string' ? meta.synopsisCn.trim() : '';

    const summaryRaw = row?.bangumi?.summaryCn;
    const mirrorSynopsisCn =
      typeof summaryRaw === 'string' && summaryRaw.trim()
        ? stripHtmlSummary(summaryRaw)
        : undefined;

    return {
      ...meta,
      titleCn: docCn || fromMirror.titleCn,
      titleJp: docJp || fromMirror.titleJp,
      titleEn: docEn || fromMirror.titleEn,
      synopsisCn: docSynopsisCn || mirrorSynopsisCn,
    };
  }

  private async malIdsNeedingI18n(malIds: number[]): Promise<number[]> {
    if (!malIds.length) return [];
    const withCnMeta = await this.model
      .find({
        malId: { $in: malIds },
        titleCn: { $exists: true, $nin: [null, ''] },
      })
      .select('malId')
      .lean();
    const metaOk = new Set(withCnMeta.map((d) => d.malId));
    const mirrors = await this.mirrorModel
      .find({ malId: { $in: malIds } })
      .select('malId titles.cn')
      .lean();
    const mirrorOk = new Set(
      mirrors
        .filter((m) => typeof m.titles?.cn === 'string' && m.titles.cn.trim())
        .map((m) => m.malId),
    );
    return malIds.filter((id) => !metaOk.has(id) && !mirrorOk.has(id));
  }

  private async persistI18nFromMirror(malId: number): Promise<void> {
    const mirror = await this.mirrorModel
      .findOne({ malId })
      .select('titles bangumi')
      .lean();
    if (!mirror) return;
    const t = this.extractTitlesFromMirrorRow(mirror);
    const summaryRaw = mirror.bangumi?.summaryCn;
    const synopsisCn =
      typeof summaryRaw === 'string' && summaryRaw.trim()
        ? stripHtmlSummary(summaryRaw)
        : undefined;
    const $set: Record<string, string> = {};
    if (t.titleCn) $set.titleCn = t.titleCn;
    if (t.titleJp) $set.titleJp = t.titleJp;
    if (t.titleEn) $set.titleEn = t.titleEn;
    if (synopsisCn) $set.synopsisCn = synopsisCn;
    if (!Object.keys($set).length) return;
    await this.model.updateOne({ malId }, { $set });
  }

  /** 为清单条目按需建立 Bangumi 映射并写回 `AnimeMeta` 多语言字段。 */
  async ensureI18nForMalIds(malIds: number[]) {
    const need = await this.malIdsNeedingI18n(malIds);
    if (!need.length) {
      this.log.debug(`[i18n-map] 无需映射（均已具备 titleCn）`);
      return { attempted: 0, mapped: 0, persisted: 0 };
    }
    const t0 = Date.now();
    this.log.log(
      `[i18n-map] 开始：本批 ${need.length} 个 malId → [${need.join(', ')}]`,
    );
    const { attempted, mapped } =
      await this.bee.ensureBangumiMappingsForMalIds(need, { max: 8 });
    let persisted = 0;
    for (const id of need) {
      await this.persistI18nFromMirror(id);
      const doc = await this.model
        .findOne({ malId: id })
        .select('titleCn')
        .lean();
      if (doc?.titleCn?.trim()) persisted += 1;
    }
    const ms = Date.now() - t0;
    this.log.log(
      `[i18n-map] 完成（${ms}ms）：attempted=${attempted} mapped=${mapped} persisted=${persisted}/${need.length}`,
    );
    return { attempted, mapped, persisted };
  }

  /** 将 Mirror 已有 titles.cn 同步到缺 titleCn 的 AnimeMeta（无需 Bangumi 搜索）。 */
  private async syncMetaFromExistingMirrorTitles(malIds: number[]): Promise<number> {
    if (!malIds.length) return 0;
    const metaMissing = await this.model
      .find({
        malId: { $in: malIds },
        $or: [{ titleCn: { $exists: false } }, { titleCn: null }, { titleCn: '' }],
      })
      .select('malId')
      .lean();
    const need = new Set(metaMissing.map((d) => d.malId));
    if (!need.size) return 0;

    const mirrors = await this.mirrorModel
      .find({ malId: { $in: [...need] } })
      .select('malId titles.cn')
      .lean();
    let synced = 0;
    for (const m of mirrors) {
      if (typeof m.titles?.cn !== 'string' || !m.titles.cn.trim()) continue;
      await this.persistI18nFromMirror(m.malId);
      synced += 1;
    }
    if (synced > 0) {
      this.log.log(`[i18n-map] Mirror 当季池：${synced} 部已从 Mirror 同步 titleCn 至 AnimeMeta`);
    }
    return synced;
  }

  private async runI18nBatches(malIds: number[]): Promise<void> {
    const BATCH = 8;
    for (let i = 0; i < malIds.length; i += BATCH) {
      const batch = malIds.slice(i, i + BATCH);
      try {
        await this.ensureI18nForMalIds(batch);
      } catch (e: unknown) {
        this.log.warn(`[i18n-map] Mirror 当季批次异常: ${describeApiError(e)}`);
      }
      if (i + BATCH < malIds.length) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }

  /**
   * 为 AnimeMirror 当季池后台补 Bangumi 映射（客户端启动 / 读路径触发，幂等）。
   */
  async scheduleSeasonalMirrorI18nSync(): Promise<{ queued: number; running: boolean }> {
    const rows = await this.mirrorModel
      .find({ tier: 'seasonal', malId: { $gt: 0 } })
      .select('malId')
      .lean();
    const malIds = [...new Set(rows.map((r) => r.malId))];
    if (!malIds.length) return { queued: 0, running: false };

    await this.syncMetaFromExistingMirrorTitles(malIds);

    const need = await this.malIdsNeedingI18n(malIds);
    if (!need.length) {
      return { queued: 0, running: Boolean(this.seasonalMirrorI18nTask) };
    }

    if (!this.seasonalMirrorI18nTask) {
      this.log.log(
        `[i18n-map] Mirror 当季池：${need.length} 部待 Bangumi 映射，后台批次处理`,
      );
      this.seasonalMirrorI18nTask = this.runI18nBatches(need).finally(() => {
        this.seasonalMirrorI18nTask = null;
      });
    }

    return { queued: need.length, running: true };
  }

  async findByMalIds(malIds: number[]) {
    if (!malIds.length) return [];
    const need = await this.malIdsNeedingI18n(malIds);
    if (need.length) {
      const batch = need.slice(0, 8);
      const remaining = Math.max(0, need.length - batch.length);
      this.log.log(
        `[i18n-map] 清单读路径：共 ${malIds.length} 部，缺中文 ${need.length} 部；后台映射 [${batch.join(', ')}]` +
          (remaining > 0
            ? `（另有 ${remaining} 部请刷新页面后继续补）`
            : ''),
      );
      void this.ensureI18nForMalIds(batch).catch((e: unknown) => {
        this.log.warn(`[i18n-map] 后台批次异常: ${describeApiError(e)}`);
      });
    }
    const docs = await this.model.find({ malId: { $in: malIds } });
    const mirrors = await this.mirrorModel
      .find({ malId: { $in: malIds } })
      .select('malId titles bangumi data')
      .lean();
    const mirrorByMal = new Map(mirrors.map((m) => [m.malId, m]));
    return docs.map((d) => {
      const json = d.toJSON() as Record<string, unknown>;
      return this.attachMirrorI18n(json, mirrorByMal.get(d.malId) ?? null);
    });
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

  private async enrichMetaFromMirror(
    malId: number,
    meta: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const mirror = await this.mirrorModel
      .findOne({ malId })
      .select('malId titles bangumi data')
      .lean();
    return this.attachMirrorI18n(meta, mirror ?? null);
  }

  async getOrFetchByMalId(malId: number) {
    const existing = await this.model.findOne({ malId });
    if (existing) {
      let out = await this.enrichMetaFromMirror(
        malId,
        existing.toJSON() as Record<string, unknown>,
      );
      if (!(typeof out.titleCn === 'string' && out.titleCn.trim())) {
        await this.ensureI18nForMalIds([malId]);
        const refreshed = await this.model.findOne({ malId });
        if (refreshed) {
          out = await this.enrichMetaFromMirror(
            malId,
            refreshed.toJSON() as Record<string, unknown>,
          );
        }
      }
      return out;
    }

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
        return this.enrichMetaFromMirror(
          malId,
          created.toJSON() as Record<string, unknown>,
        );
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

    return this.enrichMetaFromMirror(
      malId,
      created.toJSON() as Record<string, unknown>,
    );
  }

  /**
   * 当季 Mirror 抽样：优先已有 Bangumi 中文名的条目，减少 UI 语言与标题不一致。
   */
  private async sampleSeasonalMirrorRows(limit: number) {
    const n = Math.min(12, Math.max(1, Math.floor(limit) || 1));
    const baseMatch = {
      tier: 'seasonal' as const,
      malId: { $gt: 0 },
      data: { $exists: true, $ne: null },
    };
    const withCn = await this.mirrorModel.aggregate([
      {
        $match: {
          ...baseMatch,
          'titles.cn': { $exists: true, $nin: [null, ''] },
        },
      },
      { $sample: { size: n } },
    ]);
    if (withCn.length >= n) return withCn.slice(0, n);
    const exclude = withCn.map((r) => r.malId as number);
    const rest = await this.mirrorModel.aggregate([
      {
        $match: {
          ...baseMatch,
          malId: { $gt: 0, $nin: exclude },
        },
      },
      { $sample: { size: n - withCn.length } },
    ]);
    return [...withCn, ...rest];
  }

  private mapSeasonalMirrorRowToItem(row: {
    malId: number;
    titles?: { cn?: string; jp?: string; en?: string };
    bangumi?: { summaryCn?: string };
    data?: unknown;
  }) {
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
    const synopsis =
      typeof inner.synopsis === 'string' ? inner.synopsis : undefined;

    return this.attachMirrorI18n(
      {
        malId,
        title,
        imageUrl: images?.jpg?.image_url ?? undefined,
        episodes: totalEpisodes ?? undefined,
        totalEpisodes: totalEpisodes ?? undefined,
        score: (inner.score as number | null | undefined) ?? undefined,
        synopsis,
        genres,
      },
      row,
    );
  }

  /**
   * Dashboard / discovery: random **seasonal** titles from `AnimeMirror` (Bee), no Jikan calls.
   * 抽样后同步 Bangumi 映射，响应含 titleCn/titleEn 等；前端按 UI 语言 pick，切换语言不重新抽样。
   */
  async randomSeasonalFromMirror(limit: number) {
    void this.scheduleSeasonalMirrorI18nSync().catch((e: unknown) => {
      this.log.warn(
        `[i18n-map] seasonal-random 触发映射失败: ${describeApiError(e)}`,
      );
    });

    let rows = await this.sampleSeasonalMirrorRows(limit);
    const malIds = rows
      .map((r) => Number(r.malId))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (malIds.length) {
      await this.syncMetaFromExistingMirrorTitles(malIds);
      const need = await this.malIdsNeedingI18n(malIds);
      if (need.length) {
        this.log.log(
          `[i18n-map] seasonal-random：同步映射 ${need.length} 部 → [${need.join(', ')}]`,
        );
        await this.ensureI18nForMalIds(need);
        rows = await this.mirrorModel
          .find({ malId: { $in: malIds } })
          .lean();
        const order = new Map(malIds.map((id, i) => [id, i]));
        rows.sort(
          (a, b) => (order.get(a.malId) ?? 0) - (order.get(b.malId) ?? 0),
        );
      }
    }

    const metaDocs = await this.model
      .find({ malId: { $in: malIds } })
      .lean();
    const metaByMal = new Map(metaDocs.map((d) => [d.malId, d]));

    const items = rows
      .map((row) => {
        const base = this.mapSeasonalMirrorRowToItem(row);
        if (!base) return null;
        const meta = metaByMal.get(Number(row.malId));
        if (!meta) return base;
        return this.attachMirrorI18n(
          {
            ...(base as Record<string, unknown>),
            titleCn: meta.titleCn,
            titleJp: meta.titleJp,
            titleEn: meta.titleEn,
            synopsisCn: meta.synopsisCn,
          },
          row,
        );
      })
      .filter((v): v is NonNullable<typeof v> => Boolean(v));

    return { items };
  }

  /**
   * 时间表用：Jikan `synopsis` 多为英文；若以假名为主则归为 synopsisJa，避免在时间表页展示中文简介。
   */
  private timetableSynopsisFields(rawSynopsis: unknown): {
    synopsisEn?: string;
    synopsisJa?: string;
  } {
    if (typeof rawSynopsis !== 'string' || !rawSynopsis.trim()) return {};
    const plain = stripHtmlSummary(rawSynopsis.replace(/<[^>]+>/g, ' '));
    if (!plain.trim()) return {};
    let kana = 0;
    let latin = 0;
    for (const ch of plain) {
      const c = ch.codePointAt(0) ?? 0;
      if (c >= 0x3040 && c <= 0x30ff) kana += 1;
      else if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) latin += 1;
    }
    if (kana >= 12 && kana >= latin * 1.15) return { synopsisJa: plain };
    return { synopsisEn: plain };
  }

  /**
   * 时间表：基于 `AnimeMirror`（当季）与东京墙钟 → `Europe/Berlin` 展示。
   * 默认 **前后各 14 天**（共 29 个日历日）；兼容旧参数 `days`（仅向未来）。
   */
  async getTimetable(opts?: {
    days?: number;
    pastDays?: number;
    futureDays?: number;
  }) {
    let startOffset = -14;
    let endOffset = 14;
    if (opts?.pastDays != null || opts?.futureDays != null) {
      const past = Math.min(14, Math.max(0, Math.floor(opts.pastDays ?? 14) || 0));
      const future = Math.min(14, Math.max(0, Math.floor(opts.futureDays ?? 14) || 0));
      startOffset = -past;
      endOffset = future;
    } else if (opts?.days != null) {
      const days = Math.min(14, Math.max(1, Math.floor(opts.days) || 7));
      startOffset = 0;
      endOffset = days - 1;
    }
    const rawMirrors = await this.mirrorModel
      .find({
        tier: 'seasonal',
        malId: { $gt: 0 },
      })
      .lean();

    const mirrors = rawMirrors.filter((m) => {
      const inner = (m.data as { data?: Record<string, unknown> } | undefined)?.data;
      const w = resolveTimetableWeekdayBangumi({
        bangumi: (m.bangumi ?? null) as { weekday?: unknown } | null,
        jikanInner: inner && typeof inner === 'object' ? inner : undefined,
      });
      return typeof w === 'number';
    });

    const daysOut: Array<{
      date: string;
      dateLabel: string;
      weekdayLabel: string;
      items: Array<{
        malId: number;
        bgmId: number;
        title: string;
        titleCn?: string;
        titleJp?: string;
        titleEn?: string;
        imageUrl?: string;
        airTimeLocal?: string;
        nextAirAtIso?: string;
        /** 用于调试：参与换算的原始播出字符串（Bangumi / Jikan 兜底合并前） */
        airTime?: string;
        synopsisCn?: string;
        synopsisEn?: string;
        synopsisJa?: string;
        episodeLabel: string;
      }>;
    }> = [];

    type TimetableItemOut = (typeof daysOut)[number]['items'][number];

    for (let i = startOffset; i <= endOffset; i++) {
      const d = berlinInstantAtDayOffset(i);
      const jbgm = bangumiWeekdayFromBerlinInstant(d);
      const date = formatYmdBerlin(d);
      const weekdayLabel = formatWeekdayShortZhBerlin(d);
      const dateLabel = formatDateSlashBerlin(d);

      const items: TimetableItemOut[] = [];
      for (const m of mirrors) {
        const inner = (m.data as { data?: Record<string, unknown> } | undefined)?.data;
        const wd = resolveTimetableWeekdayBangumi({
          bangumi: (m.bangumi ?? null) as { weekday?: unknown } | null,
          jikanInner: inner && typeof inner === 'object' ? inner : undefined,
        });
        if (typeof wd !== 'number' || wd !== jbgm) continue;
        const imageUrl =
          inner &&
          typeof inner.images === 'object' &&
          inner.images !== null &&
          typeof (inner.images as { jpg?: { image_url?: string } }).jpg?.image_url === 'string'
            ? (inner.images as { jpg?: { image_url?: string } }).jpg?.image_url
            : undefined;

        const innerTitle =
          inner && typeof inner.title === 'string' ? String(inner.title).trim() : '';
        const innerTitleEn =
          inner && typeof inner.title_english === 'string'
            ? String(inner.title_english).trim()
            : '';
        const innerTitleJp =
          inner && typeof inner.title_japanese === 'string'
            ? String(inner.title_japanese).trim()
            : '';

        const title =
          (typeof m.titles?.en === 'string' && m.titles.en.trim()) ||
          innerTitleEn ||
          (typeof m.titles?.jp === 'string' && m.titles.jp.trim()) ||
          innerTitleJp ||
          innerTitle ||
          (typeof m.titles?.cn === 'string' && m.titles.cn.trim()) ||
          `mal:${m.malId}`;

        const titleCn =
          (typeof m.titles?.cn === 'string' && m.titles.cn.trim()) || undefined;
        const titleJp =
          (typeof m.titles?.jp === 'string' && m.titles.jp.trim()) || innerTitleJp || undefined;
        const titleEn =
          (typeof m.titles?.en === 'string' && m.titles.en.trim()) || innerTitleEn || undefined;

        const synopsisParts = this.timetableSynopsisFields(inner?.synopsis);
        const summaryCnRaw = (m.bangumi as { summaryCn?: string } | undefined)
          ?.summaryCn;
        const synopsisCn =
          typeof summaryCnRaw === 'string' && summaryCnRaw.trim()
            ? stripHtmlSummary(summaryCnRaw)
            : undefined;

        const airRaw = resolveTimetableAirTimeRaw({
          bangumi: (m.bangumi ?? null) as Record<string, unknown> | null,
          jikanInner: inner && typeof inner === 'object' ? inner : undefined,
        });
        const conv = tokyoWallToBerlinClock(date, airRaw);
        const bgmNum = Number(m.bgmId);
        items.push({
          malId: m.malId,
          bgmId: Number.isFinite(bgmNum) && bgmNum > 0 ? bgmNum : 0,
          title,
          titleCn,
          titleJp,
          titleEn,
          imageUrl,
          airTime: airRaw,
          airTimeLocal: conv?.clock ?? undefined,
          nextAirAtIso: conv?.iso,
          synopsisCn,
          synopsisEn: synopsisParts.synopsisEn,
          synopsisJa: synopsisParts.synopsisJa,
          episodeLabel: 'Seasonal',
        });
      }
      items.sort((a, b) => (a.airTimeLocal ?? '').localeCompare(b.airTimeLocal ?? ''));
      daysOut.push({ date, dateLabel, weekdayLabel, items });
    }

    return { timezone: TIMETABLE_TZ, days: daysOut };
  }
}
