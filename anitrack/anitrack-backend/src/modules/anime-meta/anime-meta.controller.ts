import { Controller, Get, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
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

  /** 周视图时间表：`Europe/Berlin`（CEST/CET）展示；数据来自已映射 Bangumi 的当季镜像。 */
  @Get('timetable')
  async timetable(
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
  ) {
    return this.animeMeta.getTimetable(days);
  }
}
