import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnimeMetaService } from './anime-meta.service';
import { AnimeMeta, AnimeMetaSchema } from './schemas/anime-meta.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: AnimeMeta.name, schema: AnimeMetaSchema }])],
  providers: [AnimeMetaService],
  exports: [AnimeMetaService],
})
export class AnimeMetaModule {}

