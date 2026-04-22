import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HeatmapQueryDto } from './dto/heatmap-query.dto';
import { StatsService } from './stats.service';

@ApiTags('Statistics')
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('heatmap')
  @ApiOperation({ summary: 'Watch heatmap (planned contract)' })
  async heatmap(@Query() query: HeatmapQueryDto) {
    return this.stats.heatmap(query);
  }
}

