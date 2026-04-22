import { NextResponse, type NextRequest } from "next/server";
import mongoose from "mongoose";
import { ZodError } from "zod";

import { jsonError } from "@/lib/apiError";
import {
  AnimeEntryPatch,
  assertAllowedStatusTransition,
  todayYYYYMMDD,
} from "@/lib/animeEntryValidation";
import { connectToDatabase } from "@/lib/mongodb";
import { AnimeEntryModel } from "@/models/AnimeEntry";

function zodDetails(err: ZodError) {
  return err.issues.map((i) => ({
    path: i.path.join(".") || "(root)",
    reason: i.message,
  }));
}

function isValidObjectId(id: string) {
  return mongoose.Types.ObjectId.isValid(id);
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase();

    const { id } = await ctx.params;
    if (!isValidObjectId(id)) {
      return jsonError(404, "NOT_FOUND", "Anime entry not found");
    }

    const doc = await AnimeEntryModel.findById(id);
    if (!doc) return jsonError(404, "NOT_FOUND", "Anime entry not found");

    return NextResponse.json(doc.toJSON());
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error");
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase();

    const { id } = await ctx.params;
    if (!isValidObjectId(id)) {
      return jsonError(404, "NOT_FOUND", "Anime entry not found");
    }

    const existing = await AnimeEntryModel.findById(id);
    if (!existing) return jsonError(404, "NOT_FOUND", "Anime entry not found");

    const body = (await req.json()) as Record<string, unknown>;
    const patch = AnimeEntryPatch.parse(body);

    const fromStatus = existing.status as any;
    const toStatus = (patch.status ?? existing.status) as any;

    if (patch.status && patch.status !== existing.status) {
      try {
        assertAllowedStatusTransition(fromStatus, patch.status as any);
      } catch (e: any) {
        if (e?.code === "INVALID_STATUS_TRANSITION") {
          return jsonError(409, "INVALID_STATUS_TRANSITION", e.message, [
            { path: "status", reason: e.message },
          ]);
        }
        throw e;
      }
    }

    // Zod may apply defaults (e.g. completedDates: []) on parse; only treat as a client
    // intent to touch completed fields when the raw JSON actually included those keys.
    const touchesCompletedFields =
      Object.prototype.hasOwnProperty.call(body, "completedAt") ||
      Object.prototype.hasOwnProperty.call(body, "completedDates");

    if (toStatus !== "COMPLETED" && touchesCompletedFields) {
      return jsonError(
        400,
        "VALIDATION_ERROR",
        "completedAt/completedDates are only allowed when status=COMPLETED",
        [
          { path: "completedAt", reason: "Only allowed when status=COMPLETED" },
          { path: "completedDates", reason: "Only allowed when status=COMPLETED" },
        ],
      );
    }

    const update: Record<string, unknown> = { ...patch };

    // 自动维护 COMPLETED 字段
    if (toStatus === "COMPLETED") {
      const completedAt =
        (patch.completedAt as string | undefined) ??
        (existing.completedAt as string | undefined) ??
        todayYYYYMMDD();

      const mergedDates = [
        ...((existing.completedDates as unknown as string[]) ?? []),
        ...((patch.completedDates as unknown as string[] | undefined) ?? []),
        completedAt,
      ];

      update.completedAt = completedAt;
      update.completedDates = Array.from(new Set(mergedDates));
    } else if (existing.status === "COMPLETED" && patch.status && patch.status !== "COMPLETED") {
      // 离开 COMPLETED 时清理 completed 字段，避免统计污染
      update.completedAt = undefined;
      update.completedDates = [];
    }

    const updated = await AnimeEntryModel.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!updated) return jsonError(404, "NOT_FOUND", "Anime entry not found");
    return NextResponse.json(updated.toJSON());
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid request body", zodDetails(err));
    }
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error");
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase();

    const { id } = await ctx.params;
    if (!isValidObjectId(id)) {
      return new NextResponse(null, { status: 204 });
    }

    await AnimeEntryModel.findByIdAndDelete(id);
    return new NextResponse(null, { status: 204 });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error");
  }
}

