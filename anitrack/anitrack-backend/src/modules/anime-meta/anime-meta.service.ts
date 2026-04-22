import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiErrorException } from '../../shared/http/api-error.filter';
import { AnimeMeta, AnimeMetaDocument } from './schemas/anime-meta.schema';

type JikanAnimeResponse = {
  data?: {
    mal_id?: number;
    title?: string;
    episodes?: number | null;
    score?: number | null;
    images?: { jpg?: { image_url?: string | null } };
  };
};

@Injectable()
export class AnimeMetaService {
  constructor(
    @InjectModel(AnimeMeta.name) private readonly model: Model<AnimeMetaDocument>,
    private readonly config: ConfigService,
  ) {}

  async findByMalIds(malIds: number[]) {
    if (!malIds.length) return [];
    return this.model.find({ malId: { $in: malIds } }).lean();
  }

  async getOrFetchByMalId(malId: number) {
    const existing = await this.model.findOne({ malId }).lean();
    if (existing) return existing;

    const baseUrl = (this.config.get<string>('JIKAN_BASE_URL') ?? 'https://api.jikan.moe/v4').replace(
      /\/+$/,
      '',
    );
    const url = `${baseUrl}/anime/${encodeURIComponent(String(malId))}`;

    let res: Response;
    try {
      res = await fetch(url, {
        headers: { accept: 'application/json' },
      });
    } catch (e: any) {
      throw new ApiErrorException(502, 'UPSTREAM_ERROR', `Failed to reach Jikan API: ${e?.message ?? e}`);
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

    const created = await this.model.create({
      malId,
      title,
      imageUrl: data?.images?.jpg?.image_url ?? undefined,
      episodes: data?.episodes ?? undefined,
      score: data?.score ?? undefined,
    });
    return created.toJSON();
  }
}

