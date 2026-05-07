import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AnimeEntry,
  AnimeEntrySchema,
} from '../anime/schemas/anime-entry.schema';
import { AnimeMetaModule } from '../anime-meta/anime-meta.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AnimeEntry.name, schema: AnimeEntrySchema },
    ]),
    AnimeMetaModule,
  ],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
