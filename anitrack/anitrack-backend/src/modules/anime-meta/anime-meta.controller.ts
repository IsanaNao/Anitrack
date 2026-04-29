import { Controller, Get, Query } from '@nestjs/common';
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
      throw new ApiErrorException(400, 'VALIDATION_ERROR', 'Missing query parameter: q', [
        { path: 'q', reason: 'Required' },
      ]);
    }
    return this.animeMeta.searchAndUpsert(q, {
      page: query.page,
      pageSize: query.pageSize,
    });
  }
}

