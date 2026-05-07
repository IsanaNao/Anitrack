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
}

export const AnimeMirrorSchema = SchemaFactory.createForClass(AnimeMirror);

