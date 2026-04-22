import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApiErrorException } from '../../shared/http/api-error.filter';
import {
  assertAllowedStatusTransition,
  type AnimeStatus,
  todayYYYYMMDD,
} from './anime.constants';
import { AnimeEntryCreateDto, AnimeEntryPatchDto, AnimeListQueryDto } from './dto/anime-entry.dto';
import { AnimeEntry, AnimeEntryDocument } from './schemas/anime-entry.schema';

function isValidObjectId(id: string) {
  return Types.ObjectId.isValid(id);
}

@Injectable()
export class AnimeService {
  constructor(@InjectModel(AnimeEntry.name) private readonly model: Model<AnimeEntryDocument>) {}

  async list(query: AnimeListQueryDto) {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20) || 20));
    const sortParam = query.sort ?? 'updatedAt:desc';

    const filter: Record<string, unknown> = {};
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

    return {
      items: items.map((d) => d.toJSON()),
      page,
      pageSize,
      total,
    };
  }

  async create(dto: AnimeEntryCreateDto) {
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
        status,
        completedAt,
        completedDates,
      });
      return created.toJSON();
    } catch (e: any) {
      if (e?.code === 11000) {
        throw new ApiErrorException(409, 'VALIDATION_ERROR', 'malId already exists', [
          { path: 'malId', reason: 'Duplicate value' },
        ]);
      }
      throw e;
    }
  }

  async getById(id: string) {
    if (!isValidObjectId(id)) {
      throw new ApiErrorException(404, 'NOT_FOUND', 'Anime entry not found');
    }
    const doc = await this.model.findById(id);
    if (!doc) throw new ApiErrorException(404, 'NOT_FOUND', 'Anime entry not found');
    return doc.toJSON();
  }

  async patchById(id: string, dto: AnimeEntryPatchDto, rawBody: Record<string, unknown>) {
    if (!isValidObjectId(id)) {
      throw new ApiErrorException(404, 'NOT_FOUND', 'Anime entry not found');
    }

    const existing = await this.model.findById(id);
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

    const updated = await this.model.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });
    if (!updated) throw new ApiErrorException(404, 'NOT_FOUND', 'Anime entry not found');
    return updated.toJSON();
  }

  async deleteById(id: string) {
    if (!isValidObjectId(id)) return;
    await this.model.findByIdAndDelete(id);
  }
}

