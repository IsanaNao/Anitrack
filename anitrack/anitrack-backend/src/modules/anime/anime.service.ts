import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApiErrorException } from '../../shared/http/api-error.filter';
import { TEMP_USER_ID } from '../../shared/auth/temp-user';
import {
  assertAllowedStatusTransition,
  type AnimeStatus,
  todayYYYYMMDD,
} from './anime.constants';
import { AnimeEntryCreateDto, AnimeEntryPatchDto, AnimeListQueryDto } from './dto/anime-entry.dto';
import { AnimeEntry, AnimeEntryDocument } from './schemas/anime-entry.schema';
import { AnimeMetaService } from '../anime-meta/anime-meta.service';

function isValidObjectId(id: string) {
  return Types.ObjectId.isValid(id);
}

@Injectable()
export class AnimeService implements OnModuleInit {
  constructor(
    @InjectModel(AnimeEntry.name) private readonly model: Model<AnimeEntryDocument>,
    private readonly animeMeta: AnimeMetaService,
  ) {}

  async onModuleInit() {
    // IMPORTANT: old Atlas unique indexes (e.g. { malId: 1 } unique) can block inserts after refactor.
    // Keeping syncIndexes here makes the new compound unique index authoritative.
    try {
      await this.model.syncIndexes();
    } catch (e: any) {
      // When Mongo connection is disabled/unavailable (lazyConnection / no DB), keep the app bootable for Swagger.
      // eslint-disable-next-line no-console
      console.warn('[anitrack-backend] syncIndexes skipped:', e?.message ?? e);
    }
  }

  async list(query: AnimeListQueryDto) {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20) || 20));
    const sortParam = query.sort ?? 'updatedAt:desc';

    const filter: Record<string, unknown> = {};
    filter.userId = TEMP_USER_ID;
    if (query.status) filter.status = query.status;

    const [sortFieldRaw, sortDirRaw] = String(sortParam).split(':');
    const sortField = sortFieldRaw === 'updatedAt' ? 'updatedAt' : 'updatedAt';
    const sortDir = sortDirRaw === 'asc' ? 1 : -1;

    const total = await this.model.countDocuments(filter);
    const items = await this.model
      .find(filter)
      .sort({ [sortField]: sortDir })
      .skip((page - 1) * pageSize)
      .limit(pageSize);

    const malIds = Array.from(new Set(items.map((d) => d.malId)));
    const metas = await this.animeMeta.findByMalIds(malIds);
    const metaByMalId = new Map<number, any>(metas.map((m: any) => [m.malId, m]));

    return {
      items: items.map((d) => {
        const json = d.toJSON() as any;
        json.animeMeta = metaByMalId.get(d.malId) ?? null;
        return json;
      }),
      page,
      pageSize,
      total,
    };
  }

  async create(dto: AnimeEntryCreateDto) {
    await this.animeMeta.getOrFetchByMalId(dto.malId);
    const status = (dto.status ?? 'PLANNED') as AnimeStatus;

    if (status !== 'COMPLETED') {
      if (dto.completedAt || (dto.completedDates?.length ?? 0) > 0) {
        throw new ApiErrorException(
          400,
          'VALIDATION_ERROR',
          'completedAt/completedDates are only allowed when status=COMPLETED',
          [
            { path: 'completedAt', reason: 'Only allowed when status=COMPLETED' },
            { path: 'completedDates', reason: 'Only allowed when status=COMPLETED' },
          ],
        );
      }
    }

    let completedAt = dto.completedAt;
    let completedDates = dto.completedDates ?? [];
    if (status === 'COMPLETED') {
      completedAt = completedAt ?? todayYYYYMMDD();
      completedDates = Array.from(new Set([...(completedDates ?? []), completedAt]));
    } else {
      completedAt = undefined;
      completedDates = [];
    }

    try {
      const created = await this.model.create({
        ...dto,
        userId: TEMP_USER_ID,
        status,
        completedAt,
        completedDates,
      });
      const json = created.toJSON() as any;
      json.animeMeta = await this.animeMeta.getOrFetchByMalId(dto.malId);
      return json;
    } catch (e: any) {
      if (e?.code === 11000) {
        throw new ApiErrorException(409, 'VALIDATION_ERROR', 'malId already exists for this user', [
          { path: 'malId', reason: 'Duplicate value (userId+malId)' },
        ]);
      }
      throw e;
    }
  }

  async getById(id: string) {
    if (!isValidObjectId(id)) {
      throw new ApiErrorException(404, 'NOT_FOUND', 'Anime entry not found');
    }
    const doc = await this.model.findOne({ _id: id, userId: TEMP_USER_ID });
    if (!doc) throw new ApiErrorException(404, 'NOT_FOUND', 'Anime entry not found');
    const json = doc.toJSON() as any;
    json.animeMeta = await this.animeMeta.getOrFetchByMalId(doc.malId);
    return json;
  }

  async patchById(id: string, dto: AnimeEntryPatchDto, rawBody: Record<string, unknown>) {
    if (!isValidObjectId(id)) {
      throw new ApiErrorException(404, 'NOT_FOUND', 'Anime entry not found');
    }

    const existing = await this.model.findOne({ _id: id, userId: TEMP_USER_ID });
    if (!existing) throw new ApiErrorException(404, 'NOT_FOUND', 'Anime entry not found');

    const fromStatus = existing.status as AnimeStatus;
    const toStatus = ((dto.status ?? existing.status) as unknown as AnimeStatus) ?? fromStatus;

    if (dto.status && dto.status !== existing.status) {
      try {
        assertAllowedStatusTransition(fromStatus, dto.status as unknown as AnimeStatus);
      } catch (e: any) {
        if (e?.code === 'INVALID_STATUS_TRANSITION') {
          throw new ApiErrorException(409, 'INVALID_STATUS_TRANSITION', e.message, [
            { path: 'status', reason: e.message },
          ]);
        }
        throw e;
      }
    }

    const touchesCompletedFields =
      Object.prototype.hasOwnProperty.call(rawBody, 'completedAt') ||
      Object.prototype.hasOwnProperty.call(rawBody, 'completedDates');

    if (toStatus !== 'COMPLETED' && touchesCompletedFields) {
      throw new ApiErrorException(
        400,
        'VALIDATION_ERROR',
        'completedAt/completedDates are only allowed when status=COMPLETED',
        [
          { path: 'completedAt', reason: 'Only allowed when status=COMPLETED' },
          { path: 'completedDates', reason: 'Only allowed when status=COMPLETED' },
        ],
      );
    }

    const update: Record<string, unknown> = { ...dto };

    if (dto.malId != null && dto.malId !== existing.malId) {
      await this.animeMeta.getOrFetchByMalId(dto.malId);
    }

    if (toStatus === 'COMPLETED') {
      const completedAt =
        (dto.completedAt as string | undefined) ??
        (existing.completedAt as string | undefined) ??
        todayYYYYMMDD();

      const mergedDates = [
        ...((existing.completedDates as unknown as string[]) ?? []),
        ...((dto.completedDates as unknown as string[] | undefined) ?? []),
        completedAt,
      ];

      update.completedAt = completedAt;
      update.completedDates = Array.from(new Set(mergedDates));
    } else if (existing.status === 'COMPLETED' && dto.status && dto.status !== 'COMPLETED') {
      update.completedAt = undefined;
      update.completedDates = [];
    }

    const updated = await this.model.findOneAndUpdate({ _id: id, userId: TEMP_USER_ID }, update, {
      new: true,
      runValidators: true,
    });
    if (!updated) throw new ApiErrorException(404, 'NOT_FOUND', 'Anime entry not found');
    const json = updated.toJSON() as any;
    json.animeMeta = await this.animeMeta.getOrFetchByMalId(updated.malId);
    return json;
  }

  async deleteById(id: string) {
    if (!isValidObjectId(id)) return;
    await this.model.findOneAndDelete({ _id: id, userId: TEMP_USER_ID });
  }
}

