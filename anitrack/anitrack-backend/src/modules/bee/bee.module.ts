import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BeeCron } from './bee.cron';
import { BeeService } from './bee.service';
import { AnimeMirror, AnimeMirrorSchema } from './schemas/anime-mirror.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AnimeMirror.name, schema: AnimeMirrorSchema },
    ]),
  ],
  providers: [BeeService, BeeCron],
  exports: [BeeService],
})
export class BeeModule {}

