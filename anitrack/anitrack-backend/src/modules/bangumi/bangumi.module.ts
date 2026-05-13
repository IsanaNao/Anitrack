import { Module } from '@nestjs/common';
import { BangumiService } from './bangumi.service';

@Module({
  providers: [BangumiService],
  exports: [BangumiService],
})
export class BangumiModule {}
