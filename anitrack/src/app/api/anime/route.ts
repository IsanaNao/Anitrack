import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/apiError";
import {
  AnimeEntryCreate,
  AnimeStatus,
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

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("pageSize") ?? "20") || 20),
    );
    const sortParam = url.searchParams.get("sort") ?? "updatedAt:desc";

    const filter: Record<string, unknown> = {};
    if (statusParam) {
      const parsed = AnimeStatus.safeParse(statusParam);
      if (!parsed.success) {
        return jsonError(400, "VALIDATION_ERROR", "Invalid query", [
          { path: "status", reason: "Invalid enum value" },
        ]);
      }
      filter.status = parsed.data;
    }

    const [sortFieldRaw, sortDirRaw] = sortParam.split(":");
    const sortField = sortFieldRaw === "updatedAt" ? "updatedAt" : "updatedAt";
    const sortDir = sortDirRaw === "asc" ? 1 : -1;

    const total = await AnimeEntryModel.countDocuments(filter);
    const items = await AnimeEntryModel.find(filter)
      .sort({ [sortField]: sortDir })
      .skip((page - 1) * pageSize)
      .limit(pageSize);

    return NextResponse.json({
      items: items.map((d) => d.toJSON()),
      page,
      pageSize,
      total,
    });
  } catch (err) {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error");
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();
    const parsed = AnimeEntryCreate.parse(body);

    if (parsed.status !== "COMPLETED") {
      if (parsed.completedAt || (parsed.completedDates?.length ?? 0) > 0) {
        return jsonError(
          400,
          "VALIDATION_ERROR",
          "completedAt/completedDates are only allowed when status=COMPLETED",
          [
            {
              path: "completedAt",
              reason: "Only allowed when status=COMPLETED",
            },
            {
              path: "completedDates",
              reason: "Only allowed when status=COMPLETED",
            },
          ],
        );
      }
    }

    let completedAt = parsed.completedAt;
    let completedDates = parsed.completedDates ?? [];
    if (parsed.status === "COMPLETED") {
      completedAt = completedAt ?? todayYYYYMMDD();
      completedDates = Array.from(new Set([...(completedDates ?? []), completedAt]));
    } else {
      completedAt = undefined;
      completedDates = [];
    }

    const created = await AnimeEntryModel.create({
      ...parsed,
      completedAt,
      completedDates,
    });

    return NextResponse.json(created.toJSON(), { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid request body", zodDetails(err));
    }

    const anyErr = err as any;
    if (anyErr?.code === 11000) {
      return jsonError(409, "VALIDATION_ERROR", "malId already exists", [
        { path: "malId", reason: "Duplicate value" },
      ]);
    }

    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error");
  }
}

