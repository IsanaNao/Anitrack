import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnimeMetaModule } from '../anime-meta/anime-meta.module';
import { AnimeController } from './anime.controller';
import { AnimeService } from './anime.service';
import { AnimeEntry, AnimeEntrySchema } from './schemas/anime-entry.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AnimeEntry.name, schema: AnimeEntrySchema }]),
    AnimeMetaModule,
  ],
  controllers: [AnimeController],
  providers: [AnimeService],
  exports: [AnimeService],
})
export class AnimeModule {}

