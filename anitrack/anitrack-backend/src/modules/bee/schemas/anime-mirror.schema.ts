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

  /** Bangumi `subject_id`；与 `ApiMapping.bgmId` 一致，便于按 BGM 维度查询。 */
  @Prop({ type: Number, required: false, sparse: true, unique: true, index: true })
  bgmId?: number;

  /** 多语言标题快照（用于映射与 Timetable 展示）。 */
  @Prop({
    type: {
      cn: { type: String, required: false },
      jp: { type: String, required: false },
      en: { type: String, required: false },
    },
    required: false,
    _id: false,
  })
  titles?: { cn?: string; jp?: string; en?: string };

  /**
   * Bangumi 侧元数据合并（播出精度、中文简介等）。
   * `summaryCn` 供 i18n / Timetable 使用；播出时刻按东京墙钟理解，再在 API 层转为 `Europe/Berlin`。
   */
  @Prop({ type: MongooseSchema.Types.Mixed, required: false })
  bangumi?: {
    summaryCn?: string;
    /** 1–7：与 Bangumi `/calendar` 桶 `weekday.id` 对齐（若缺失则由桶推断） */
    weekday?: number;
    /** "HH:mm" 东京本地播出墙钟（来自 calendar / subject） */
    airTime?: string;
    /** 最近一次从 v0 subject 拉取详情的时间 */
    detailFetchedAt?: string;
    rawSubject?: unknown;
  };

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

