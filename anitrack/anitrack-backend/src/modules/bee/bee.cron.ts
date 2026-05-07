import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { BeeService } from './bee.service';

@Injectable()
export class BeeCron {
  private readonly log = new Logger(BeeCron.name);

  constructor(private readonly bee: BeeService) {}

  // Every 65 seconds, sync 3 items (avoid 60s boundary).
  @Interval(65_000)
  async tick() {
    try {
      await this.bee.syncBatch(3);
    } catch (e: any) {
      this.log.warn(`tick failed: ${e?.message ?? e}`);
    }
  }
}

