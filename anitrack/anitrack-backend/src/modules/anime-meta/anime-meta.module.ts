import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BangumiModule } from '../bangumi/bangumi.module';
import { BeeModule } from '../bee/bee.module';
import { AnimeMirror, AnimeMirrorSchema } from '../bee/schemas/anime-mirror.schema';
import { AnimeMetaController } from './anime-meta.controller';
import { AnimeMetaService } from './anime-meta.service';
import { AnimeMeta, AnimeMetaSchema } from './schemas/anime-meta.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AnimeMeta.name, schema: AnimeMetaSchema },
      // 与 BeeModule 使用同一 Schema；显式注册可避免仅 export MongooseModule 时偶发的 DI 解析失败（前端 Failed to fetch）
      { name: AnimeMirror.name, schema: AnimeMirrorSchema },
    ]),
    BeeModule,
    BangumiModule,
  ],
  controllers: [AnimeMetaController],
  providers: [AnimeMetaService],
  exports: [AnimeMetaService],
})
export class AnimeMetaModule {}
