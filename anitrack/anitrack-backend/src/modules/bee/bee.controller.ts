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
      'Trigger one sync batch immediately (defaults to 3). Useful for manual verification.',
  })
  async syncStep(@Query('batchSize') batchSize?: string) {
    const n = Math.max(1, Math.min(10, Number(batchSize ?? 3) || 3));
    await this.bee.syncBatch(n);
    return this.bee.progressSnapshot();
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
}

