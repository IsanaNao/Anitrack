import { Controller, Get, Post, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiErrorException } from '../../shared/http/api-error.filter';
import { AnimeMetaService } from './anime-meta.service';
import { AnimeMetaSearchQueryDto } from './dto/anime-meta-search.dto';

@Controller('anime-meta')
export class AnimeMetaController {
  constructor(private readonly animeMeta: AnimeMetaService) {}

  @Get('search')
  async search(@Query() query: AnimeMetaSearchQueryDto) {
    const q = (query?.q ?? '').trim();
    if (!q) {
      throw new ApiErrorException(
        400,
        'VALIDATION_ERROR',
        'Missing query parameter: q',
        [{ path: 'q', reason: 'Required' }],
      );
    }
    return this.animeMeta.searchAndUpsert(q, {
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  /** Random seasonal picks from Bee `AnimeMirror` only (no Jikan on this path). */
  @Get('seasonal-random')
  async seasonalRandom(
    @Query('limit', new DefaultValuePipe(4), ParseIntPipe) limit: number,
  ) {
    const capped = Math.min(12, Math.max(1, limit));
    return this.animeMeta.randomSeasonalFromMirror(capped);
  }

  /**
   * 客户端启动时触发：为 Mirror 当季池后台补 Bangumi 映射（不阻塞响应）。
   */
  @Post('mirror-i18n-sync')
  async mirrorI18nSync() {
    return this.animeMeta.scheduleSeasonalMirrorI18nSync();
  }

  /**
   * 周视图时间表：`Europe/Berlin` 展示。
   * 默认 `pastDays=14` & `futureDays=14`（前后各两周）；旧客户端可继续传 `days`（仅向未来）。
   */
  @Get('timetable')
  async timetable(
    @Query('days') days?: string,
    @Query('pastDays') pastDaysRaw?: string,
    @Query('futureDays') futureDaysRaw?: string,
  ) {
    const legacyRaw = days != null ? String(days).trim() : '';
    const pastRaw = pastDaysRaw != null ? String(pastDaysRaw).trim() : '';
    const futureRaw = futureDaysRaw != null ? String(futureDaysRaw).trim() : '';
    const useLegacy =
      legacyRaw !== '' && pastRaw === '' && futureRaw === '';
    if (useLegacy) {
      return this.animeMeta.getTimetable({ days: Number(legacyRaw) || 7 });
    }
    const past = pastRaw !== '' ? Number(pastRaw) : 14;
    const future = futureRaw !== '' ? Number(futureRaw) : 14;
    return this.animeMeta.getTimetable({
      pastDays: Number.isFinite(past) ? past : 14,
      futureDays: Number.isFinite(future) ? future : 14,
    });
  }
}
