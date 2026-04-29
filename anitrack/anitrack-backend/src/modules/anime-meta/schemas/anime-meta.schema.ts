import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AnimeMetaDocument = HydratedDocument<AnimeMeta>;

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
export class AnimeMeta {
  @Prop({ type: Number, required: true, unique: true, index: true })
  malId!: number;

  @Prop({ type: String, required: true, trim: true })
  title!: string;

  @Prop({ type: String, required: false })
  imageUrl?: string;

  // Back-compat: earlier versions used `episodes`. Keep it, but prefer `totalEpisodes`.
  @Prop({ type: Number, required: false, min: 0 })
  episodes?: number;

  @Prop({ type: Number, required: false, min: 0 })
  totalEpisodes?: number;

  @Prop({ type: Number, required: false, min: 0, max: 10 })
  score?: number;

  @Prop({ type: String, required: false })
  synopsis?: string;

  // Store as string[] for easy Tag rendering in frontend.
  @Prop({ type: [String], required: false, default: undefined })
  genres?: string[];
}

export const AnimeMetaSchema = SchemaFactory.createForClass(AnimeMeta);

