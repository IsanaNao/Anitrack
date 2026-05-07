import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Schema as MongooseSchema } from 'mongoose';

export type AnimeMirrorDocument = HydratedDocument<AnimeMirror>;

@Schema({
  timestamps: true,
  toJSON: {
    versionKey: false,
    transform(_doc: unknown, ret: any) {
      ret.id = String(ret._id);
      delete ret._id;
    },
  },
})
export class AnimeMirror {
  @Prop({ type: Number, required: true, unique: true, index: true })
  malId!: number;

  @Prop({ type: MongooseSchema.Types.Mixed, required: false })
  data?: unknown;

  @Prop({ type: Date, required: false })
  lastUpdated?: Date;

  @Prop({
    type: String,
    required: true,
    trim: true,
    default: 'general',
    enum: ['seasonal', 'general'],
    index: true,
  })
  source!: 'seasonal' | 'general';

  @Prop({
    type: String,
    required: true,
    trim: true,
    default: 'backfill',
    enum: ['seasonal', 'top_1y', 'top_5y', 'top_all', 'backfill'],
    index: true,
  })
  tier!: 'seasonal' | 'top_1y' | 'top_5y' | 'top_all' | 'backfill';

  // Lower number = higher priority.
  @Prop({ type: Number, required: true, default: 100, index: true })
  priority!: number;
}

export const AnimeMirrorSchema = SchemaFactory.createForClass(AnimeMirror);

