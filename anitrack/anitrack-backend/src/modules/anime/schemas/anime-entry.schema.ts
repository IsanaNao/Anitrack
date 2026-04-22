import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AnimeStatusValues, type AnimeStatus } from '../anime.constants';

export type AnimeEntryDocument = HydratedDocument<AnimeEntry>;

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
export class AnimeEntry {
  @Prop({ type: String, required: true, trim: true, index: true })
  userId!: string;

  @Prop({ type: Number, required: true })
  malId!: number;

  @Prop({
    type: String,
    required: true,
    enum: AnimeStatusValues,
    default: 'PLANNED',
    index: true,
  })
  status!: AnimeStatus;

  @Prop({ type: Number, required: false, min: 0, max: 10 })
  rating?: number;

  @Prop({ type: String, required: false })
  notes?: string;

  @Prop({ type: String, required: false })
  startedAt?: string;

  @Prop({ type: String, required: false })
  completedAt?: string;

  @Prop({ type: [String], required: true, default: [] })
  completedDates!: string[];
}

export const AnimeEntrySchema = SchemaFactory.createForClass(AnimeEntry);

AnimeEntrySchema.index({ userId: 1, malId: 1 }, { unique: true });
AnimeEntrySchema.index({ userId: 1, status: 1, updatedAt: -1 });
AnimeEntrySchema.index({ completedDates: 1 });

