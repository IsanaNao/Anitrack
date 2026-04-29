import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiErrorException } from '../../shared/http/api-error.filter';
import {
  AnimeEntry,
  AnimeEntryDocument,
} from '../anime/schemas/anime-entry.schema';
import { HeatmapQueryDto } from './dto/heatmap-query.dto';

function monthFromDateUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function compareYYYYMM(a: string, b: string) {
  // works for YYYY-MM
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function addMonthsYYYYMM(ym: string, delta: number) {
  const [yy, mm] = ym.split('-').map((x) => Number(x));
  const base = new Date(Date.UTC(yy, (mm ?? 1) - 1, 1, 0, 0, 0, 0));
  base.setUTCMonth(base.getUTCMonth() + delta);
  return monthFromDateUTC(base);
}

function calculateMonthlyIntensity(args: {
  addedCount: number;
  completedCount: number;
}) {
  const score = Math.max(
    0,
    Math.trunc(args.addedCount) + Math.trunc(args.completedCount),
  );
  if (score <= 0) return 0;
  if (score === 1) return 1;
  if (score === 2) return 2;
  if (score <= 4) return 3;
  return 4;
}

@Injectable()
export class StatsService {
  constructor(
    @InjectModel(AnimeEntry.name)
    private readonly model: Model<AnimeEntryDocument>,
  ) {}

  async heatmap(userId: string, query: HeatmapQueryDto) {
    const tz = query.tz ?? 'UTC';
    // Keep tz validation for forward compatibility, but current monthly stats are computed in UTC.
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
    } catch {
      throw new ApiErrorException(
        400,
        'VALIDATION_ERROR',
        'Invalid IANA time zone for tz',
        [{ path: 'tz', reason: `Unknown or invalid time zone: ${tz}` }],
      );
    }

    const defaultEnd = monthFromDateUTC(new Date());
    const defaultStart = addMonthsYYYYMM(defaultEnd, -11); // last 12 months
    const start = (query.start ?? defaultStart).trim();
    const end = (query.end ?? defaultEnd).trim();

    if (compareYYYYMM(start, end) > 0) {
      throw new ApiErrorException(
        400,
        'VALIDATION_ERROR',
        '`start` must be on or before `end`',
        [
          { path: 'start', reason: '`start` is after `end`' },
          { path: 'end', reason: '`end` is before `start`' },
        ],
      );
    }

    const addedRows = await this.model.aggregate<{
      _id: string;
      addedCount: number;
    }>([
      { $match: { userId } },
      {
        $addFields: {
          month: {
            $dateToString: {
              format: '%Y-%m',
              date: '$createdAt',
              timezone: 'UTC',
            },
          },
        },
      },
      { $match: { month: { $gte: start, $lte: end } } },
      { $group: { _id: '$month', addedCount: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const completedRows = await this.model.aggregate<{
      _id: string;
      completedCount: number;
      episodeCount: number;
    }>([
      {
        $match: {
          userId,
          status: 'COMPLETED',
          completedAt: { $exists: true, $ne: null },
        },
      },
      {
        $addFields: {
          month: {
            $substrBytes: [
              { $trim: { input: { $toString: '$completedAt' } } },
              0,
              7,
            ],
          },
        },
      },
      {
        $match: {
          month: { $gte: start, $lte: end, $regex: '^\\d{4}-\\d{2}$' },
        },
      },
      {
        $group: {
          _id: '$month',
          completedCount: { $sum: 1 },
          episodeCount: { $sum: { $ifNull: ['$episodesWatched', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const addedByMonth = new Map<string, number>();
    for (const r of addedRows)
      addedByMonth.set(String(r._id).trim(), Number(r.addedCount ?? 0) || 0);

    const completedByMonth = new Map<
      string,
      { completedCount: number; episodeCount: number }
    >();
    for (const r of completedRows) {
      completedByMonth.set(String(r._id).trim(), {
        completedCount: Number(r.completedCount ?? 0) || 0,
        episodeCount: Number(r.episodeCount ?? 0) || 0,
      });
    }

    const months: Array<{
      month: string;
      addedCount: number;
      completedCount: number;
      episodeCount: number;
      intensity: number;
    }> = [];

    // Fill all months for stable UI.
    let cur = start;
    for (let guard = 0; guard < 5000; guard++) {
      const addedCount = addedByMonth.get(cur) ?? 0;
      const completed = completedByMonth.get(cur);
      const completedCount = completed?.completedCount ?? 0;
      const episodeCount = completed?.episodeCount ?? 0;
      months.push({
        month: cur,
        addedCount,
        completedCount,
        episodeCount,
        intensity: calculateMonthlyIntensity({ addedCount, completedCount }),
      });
      if (cur === end) break;
      cur = addMonthsYYYYMM(cur, 1);
    }

    return { start, end, months };
  }
}
