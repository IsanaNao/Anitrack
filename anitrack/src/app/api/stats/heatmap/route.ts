import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { jsonError } from "@/lib/apiError";
import { DateYYYYMMDD } from "@/lib/animeEntryValidation";
import {
  addCalendarDaysUTC,
  buildHeatmapWeeks,
  compareYMD,
  getTodayInTimeZone,
} from "@/lib/heatmapCalc";
import { connectToDatabase } from "@/lib/mongodb";
import { AnimeEntryModel } from "@/models/AnimeEntry";

const HeatmapQuery = z.object({
  from: DateYYYYMMDD.optional(),
  to: DateYYYYMMDD.optional(),
  tz: z
    .string()
    .min(1, "tz must be non-empty when provided")
    .optional(),
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const parsed = HeatmapQuery.safeParse({
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      tz: url.searchParams.get("tz") ?? undefined,
    });

    if (!parsed.success) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid query", [
        ...parsed.error.issues.map((i) => ({
          path: i.path.join(".") || "(root)",
          reason: i.message,
        })),
      ]);
    }

    const tz = parsed.data.tz ?? "Europe/Berlin";
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
    } catch {
      return jsonError(400, "VALIDATION_ERROR", "Invalid IANA time zone for tz", [
        { path: "tz", reason: `Unknown or invalid time zone: ${tz}` },
      ]);
    }

    const to = parsed.data.to ?? getTodayInTimeZone(tz);
    const from = parsed.data.from ?? addCalendarDaysUTC(to, -365);

    if (compareYMD(from, to) > 0) {
      return jsonError(400, "VALIDATION_ERROR", "`from` must be on or before `to`", [
        { path: "from", reason: "`from` is after `to`" },
        { path: "to", reason: "`to` is before `from`" },
      ]);
    }

    await connectToDatabase();

    /**
     * 将 completedDates 规范为 YYYY-MM-DD 再比较 / 分组。
     * 兼容：数组元素为 string、BSON Date、或其它可 $toString 的历史数据；
     * 避免 Date 与 string 混比导致 $match 永远不匹配、count 全为 0。
     */
    const rows = await AnimeEntryModel.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          status: "COMPLETED",
          completedDates: { $exists: true, $type: "array", $ne: [] },
        },
      },
      { $unwind: { path: "$completedDates" } },
      {
        $addFields: {
          heatmapDay: {
            $let: {
              vars: { v: "$completedDates" },
              in: {
                $cond: {
                  if: { $eq: [{ $type: "$$v" }, "date"] },
                  then: {
                    $dateToString: {
                      format: "%Y-%m-%d",
                      date: "$$v",
                      timezone: "UTC",
                    },
                  },
                  else: { $trim: { input: { $toString: "$$v" } } },
                },
              },
            },
          },
        },
      },
      {
        $match: {
          heatmapDay: { $gte: from, $lte: to, $regex: "^\\d{4}-\\d{2}-\\d{2}$" },
        },
      },
      {
        $group: {
          _id: "$heatmapDay",
          count: { $sum: 1 },
        },
      },
    ]);

    const counts = new Map<string, number>();
    for (const r of rows) {
      const key = typeof r._id === "string" ? r._id.trim() : String(r._id);
      counts.set(key, r.count);
    }

    const weeks = buildHeatmapWeeks(from, to, counts);

    return NextResponse.json({ from, to, weeks });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error");
  }
}
