import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type CurrentUser as CurrentUserType,
} from '../../shared/auth/current-user';
import { ActivityQueryDto } from './dto/activity-query.dto';
import { HeatmapQueryDto } from './dto/heatmap-query.dto';
import { StatsService } from './stats.service';

@ApiTags('Statistics')
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Profile & dashboard summary statistics' })
  async summary(@CurrentUser() user: CurrentUserType) {
    return this.stats.summary(user.id);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Monthly activity (backend aggregated)' })
  async activity(
    @Query() query: ActivityQueryDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.stats.activity(user.id, query.month);
  }

  @Get('heatmap')
  @ApiOperation({ summary: 'Watch heatmap (planned contract)' })
  async heatmap(
    @Query() query: HeatmapQueryDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.stats.heatmap(user.id, query);
  }
}
