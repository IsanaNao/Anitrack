import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BeeModule } from '../bee/bee.module';
import { AnimeMetaController } from './anime-meta.controller';
import { AnimeMetaService } from './anime-meta.service';
import { AnimeMeta, AnimeMetaSchema } from './schemas/anime-meta.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AnimeMeta.name, schema: AnimeMetaSchema },
    ]),
    BeeModule,
  ],
  controllers: [AnimeMetaController],
  providers: [AnimeMetaService],
  exports: [AnimeMetaService],
})
export class AnimeMetaModule {}
