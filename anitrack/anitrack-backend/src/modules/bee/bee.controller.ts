import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BeeService } from './bee.service';

@ApiTags('Bee')
@Controller('bee')
export class BeeController {
  constructor(private readonly bee: BeeService) {}

  @Get('status')
  @ApiOperation({ summary: 'Bee mirror progress snapshot' })
  async status() {
    return this.bee.progressSnapshot();
  }

  @Post('seed-step')
  @ApiOperation({
    summary:
      'Trigger one lightweight seed retry step (for top tiers). Useful after rate limit cool-down.',
  })
  async seedStep() {
    await this.bee.seedRetryStep();
    return this.bee.progressSnapshot();
  }

  @Post('sync-step')
  @ApiOperation({
    summary:
      'Trigger one sync batch immediately (defaults to 3). Optional refreshSeasonalAirTimes=true re-fetches Bangumi v0 subject for up to airTimeRefreshLimit seasonal rows to fix airTime/weekday.',
  })
  async syncStep(
    @Query('batchSize') batchSize?: string,
    @Query('refreshSeasonalAirTimes') refreshSeasonalAirTimes?: string,
    @Query('airTimeRefreshLimit') airTimeRefreshLimit?: string,
  ) {
    const n = Math.max(1, Math.min(10, Number(batchSize ?? 3) || 3));
    let seasonalAirTimeRefresh:
      | { attempted: number; refreshed: number; errors: number }
      | undefined;
    if (
      refreshSeasonalAirTimes === 'true' ||
      refreshSeasonalAirTimes === '1'
    ) {
      const lim = Math.min(
        200,
        Math.max(1, Number(airTimeRefreshLimit ?? 50) || 50),
      );
      seasonalAirTimeRefresh = await this.bee.refreshSeasonalBangumiAirTimes(lim);
    }
    await this.bee.syncBatch(n);
    const snap = await this.bee.progressSnapshot();
    return seasonalAirTimeRefresh
      ? { ...snap, seasonalAirTimeRefresh }
      : snap;
  }

  @Get('bangumi-mapping')
  @ApiOperation({
    summary:
      'Bangumi ↔ MAL mapping snapshot (Mongo counts only). Use to verify mapping without reading logs.',
  })
  async bangumiMapping() {
    return this.bee.bangumiMappingSnapshot();
  }

  @Post('bangumi-map')
  @ApiOperation({
    summary:
      'Run Bangumi title-mapping pass once (calendar + v0 subject). Returns updated snapshot.',
  })
  async bangumiMapNow() {
    return this.bee.triggerBangumiMapNow();
  }

  @Post('map-mal-ids')
  @ApiOperation({
    summary:
      'On-demand Bangumi search mapping for library titles (comma-separated malIds). Persists mirror titles; call anime-meta read paths to sync AnimeMeta.',
  })
  async mapMalIds(@Query('malIds') malIdsRaw?: string) {
    const malIds = String(malIdsRaw ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!malIds.length) {
      return { attempted: 0, mapped: 0, malIds: [] };
    }
    return this.bee.ensureBangumiMappingsForMalIds(malIds, {
      max: Math.min(20, malIds.length),
      delayMs: 400,
    });
  }
}

