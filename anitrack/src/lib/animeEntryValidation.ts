import { z } from "zod";

export const AnimeStatus = z.enum([
  "PLANNED",
  "WATCHING",
  "ON_HOLD",
  "DROPPED",
  "COMPLETED",
]);

export type AnimeStatus = z.infer<typeof AnimeStatus>;

export const DateYYYYMMDD = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (expected YYYY-MM-DD)");

export function todayYYYYMMDD(): string {
  return new Date().toISOString().slice(0, 10);
}

export function assertAllowedStatusTransition(from: AnimeStatus, to: AnimeStatus) {
  if (from === to) return;

  const allowed: Record<AnimeStatus, AnimeStatus[]> = {
    PLANNED: ["WATCHING", "ON_HOLD", "DROPPED", "COMPLETED"],
    WATCHING: ["ON_HOLD", "DROPPED", "COMPLETED"],
    ON_HOLD: ["WATCHING", "DROPPED", "COMPLETED"],
    // “捡回来”允许：DROPPED -> PLANNED；不允许直接回到 WATCHING
    DROPPED: ["PLANNED"],
    // re-watch 允许：COMPLETED -> WATCHING
    COMPLETED: ["WATCHING"],
  };

  if (!allowed[from].includes(to)) {
    const err = new Error(`Invalid status transition: ${from} -> ${to}`);
    (err as any).code = "INVALID_STATUS_TRANSITION";
    throw err;
  }
}

export const AnimeEntryBase = z.object({
  malId: z.number().int().nonnegative(),
  title: z.string().min(1),
  imageUrl: z.string().url().optional(),
  status: AnimeStatus.default("PLANNED"),
  rating: z.number().int().min(0).max(10).optional(),
  notes: z.string().max(5000).optional(),
  startedAt: DateYYYYMMDD.optional(),
  completedAt: DateYYYYMMDD.optional(),
  completedDates: z.array(DateYYYYMMDD).default([]),
});

export const AnimeEntryCreate = AnimeEntryBase;

export const AnimeEntryPatch = AnimeEntryBase.partial().extend({
  status: AnimeStatus.optional(),
});

