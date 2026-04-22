import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnimeController } from './anime.controller';
import { AnimeService } from './anime.service';
import { AnimeEntry, AnimeEntrySchema } from './schemas/anime-entry.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: AnimeEntry.name, schema: AnimeEntrySchema }])],
  controllers: [AnimeController],
  providers: [AnimeService],
  exports: [AnimeService],
})
export class AnimeModule {}

