import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BeeController } from './bee.controller';
import { BeeCron } from './bee.cron';
import { BeeService } from './bee.service';
import { AnimeMirror, AnimeMirrorSchema } from './schemas/anime-mirror.schema';
import { BeeState, BeeStateSchema } from './schemas/bee-state.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AnimeMirror.name, schema: AnimeMirrorSchema },
      { name: BeeState.name, schema: BeeStateSchema },
    ]),
  ],
  controllers: [BeeController],
  providers: [BeeService, BeeCron],
  exports: [BeeService],
})
export class BeeModule {}

