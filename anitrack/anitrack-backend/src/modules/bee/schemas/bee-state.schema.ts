import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BeeStateDocument = HydratedDocument<BeeState>;

@Schema({ timestamps: true, versionKey: false })
export class BeeState {
  @Prop({ type: String, required: true, unique: true, index: true })
  key!: string;

  @Prop({ type: Object, required: false })
  value?: Record<string, unknown>;
}

export const BeeStateSchema = SchemaFactory.createForClass(BeeState);

