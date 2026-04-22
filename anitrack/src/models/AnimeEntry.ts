import mongoose, { type InferSchemaType } from "mongoose";

const AnimeStatusValues = [
  "PLANNED",
  "WATCHING",
  "ON_HOLD",
  "DROPPED",
  "COMPLETED",
] as const;

const AnimeEntrySchema = new mongoose.Schema(
  {
    malId: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: false },
    status: {
      type: String,
      required: true,
      enum: AnimeStatusValues,
      default: "PLANNED",
      index: true,
    },
    rating: { type: Number, required: false, min: 0, max: 10 },
    notes: { type: String, required: false },
    startedAt: { type: String, required: false },
    completedAt: { type: String, required: false },
    completedDates: { type: [String], required: true, default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform(_doc, ret) {
        const r = ret as any;
        r.id = String(r._id);
        delete r._id;
      },
    },
  },
);

AnimeEntrySchema.index({ malId: 1 }, { unique: true });
AnimeEntrySchema.index({ status: 1, updatedAt: -1 });
AnimeEntrySchema.index({ completedDates: 1 });

export type AnimeEntry = InferSchemaType<typeof AnimeEntrySchema>;

export const AnimeEntryModel =
  (mongoose.models.AnimeEntry as mongoose.Model<AnimeEntry>) ||
  mongoose.model<AnimeEntry>("AnimeEntry", AnimeEntrySchema);

