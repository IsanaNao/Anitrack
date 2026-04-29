import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiErrorException } from '../../shared/http/api-error.filter';
import {
  addCalendarDaysUTC,
  compareYMD,
  getTodayInTimeZone,
} from '../../common/utils/heatmap-calc';
import { AnimeEntry, AnimeEntryDocument } from '../anime/schemas/anime-entry.schema';
import { HeatmapQueryDto } from './dto/heatmap-query.dto';

@Injectable()
export class StatsService {
  constructor(@InjectModel(AnimeEntry.name) private readonly model: Model<AnimeEntryDocument>) {}

  async heatmap(userId: string, query: HeatmapQueryDto) {
    const tz = query.tz ?? 'Europe/Berlin';
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
    } catch {
      throw new ApiErrorException(400, 'VALIDATION_ERROR', 'Invalid IANA time zone for tz', [
        { path: 'tz', reason: `Unknown or invalid time zone: ${tz}` },
      ]);
    }

    const to = query.to ?? getTodayInTimeZone(tz);
    const from = query.from ?? addCalendarDaysUTC(to, -365);

    if (compareYMD(from, to) > 0) {
      throw new ApiErrorException(400, 'VALIDATION_ERROR', '`from` must be on or before `to`', [
        { path: 'from', reason: '`from` is after `to`' },
        { path: 'to', reason: '`to` is before `from`' },
      ]);
    }

    const rows = await this.model.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          userId,
          status: 'COMPLETED',
          completedAt: { $exists: true, $ne: null },
        },
      },
      {
        $addFields: {
          heatmapDay: {
            $let: {
              vars: { v: '$completedAt' },
              in: {
                $cond: {
                  if: { $eq: [{ $type: '$$v' }, 'date'] },
                  then: {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: '$$v',
                      timezone: 'UTC',
                    },
                  },
                  else: { $trim: { input: { $toString: '$$v' } } },
                },
              },
            },
          },
        },
      },
      {
        $match: {
          heatmapDay: { $gte: from, $lte: to, $regex: '^\\d{4}-\\d{2}-\\d{2}$' },
        },
      },
      {
        $group: {
          _id: '$heatmapDay',
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return rows.map((r) => ({
      date: typeof r._id === 'string' ? r._id.trim() : String(r._id),
      count: r.count,
    }));
  }
}

