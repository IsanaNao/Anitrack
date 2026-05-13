import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ApiMappingDocument = HydratedDocument<ApiMapping>;

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
export class ApiMapping {
  @Prop({ type: Number, required: true, unique: true, index: true })
  malId!: number;

  @Prop({ type: Number, required: true, unique: true, index: true })
  bgmId!: number;

  @Prop({ type: Date, required: true })
  lastMapped!: Date;
}

export const ApiMappingSchema = SchemaFactory.createForClass(ApiMapping);
