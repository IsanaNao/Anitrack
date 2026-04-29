import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type CurrentUser as CurrentUserType,
} from '../../shared/auth/current-user';
import { HeatmapQueryDto } from './dto/heatmap-query.dto';
import { StatsService } from './stats.service';

@ApiTags('Statistics')
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('heatmap')
  @ApiOperation({ summary: 'Watch heatmap (planned contract)' })
  async heatmap(
    @Query() query: HeatmapQueryDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.stats.heatmap(user.id, query);
  }
}
