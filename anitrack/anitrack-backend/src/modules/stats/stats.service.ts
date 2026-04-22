import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiErrorException } from '../../shared/http/api-error.filter';
import {
  addCalendarDaysUTC,
  buildHeatmapWeeks,
  compareYMD,
  getTodayInTimeZone,
} from '../../common/utils/heatmap-calc';
import { TEMP_USER_ID } from '../../shared/auth/temp-user';
import { AnimeEntry, AnimeEntryDocument } from '../anime/schemas/anime-entry.schema';
import { HeatmapQueryDto } from './dto/heatmap-query.dto';

@Injectable()
export class StatsService {
  constructor(@InjectModel(AnimeEntry.name) private readonly model: Model<AnimeEntryDocument>) {}

  async heatmap(query: HeatmapQueryDto) {
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
          userId: TEMP_USER_ID,
          status: 'COMPLETED',
          completedDates: { $exists: true, $type: 'array', $ne: [] },
        },
      },
      { $unwind: { path: '$completedDates' } },
      {
        $addFields: {
          heatmapDay: {
            $let: {
              vars: { v: '$completedDates' },
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
    ]);

    const counts = new Map<string, number>();
    for (const r of rows) {
      const key = typeof r._id === 'string' ? r._id.trim() : String(r._id);
      counts.set(key, r.count);
    }

    const weeks = buildHeatmapWeeks(from, to, counts);
    return { from, to, weeks };
  }
}

