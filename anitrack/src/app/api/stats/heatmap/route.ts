import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { jsonError } from "@/lib/apiError";

const MonthYYYYMM = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Invalid month format (expected YYYY-MM)");

const HeatmapQuery = z.object({
  start: MonthYYYYMM.optional(),
  end: MonthYYYYMM.optional(),
  tz: z.string().min(1, "tz must be non-empty when provided").optional(),
});

function backendBaseUrl() {
  // Keep the same default as the frontend api client.
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api").replace(/\/+$/, "");
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = HeatmapQuery.safeParse({
    start: url.searchParams.get("start") ?? undefined,
    end: url.searchParams.get("end") ?? undefined,
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

  const qs = new URLSearchParams();
  if (parsed.data.start) qs.set("start", parsed.data.start);
  if (parsed.data.end) qs.set("end", parsed.data.end);
  if (parsed.data.tz) qs.set("tz", parsed.data.tz);

  const target = `${backendBaseUrl()}/stats/heatmap${qs.size ? `?${qs.toString()}` : ""}`;

  let res: Response;
  try {
    res = await fetch(target, {
      headers: { Accept: "application/json" },
      // Prevent Next from caching API proxy results unexpectedly.
      cache: "no-store",
    });
  } catch (e: any) {
    return jsonError(502, "INTERNAL_ERROR", `Failed to reach backend: ${e?.message ?? e}`);
  }

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    // Pass through backend error envelope if any; otherwise wrap.
    if (json && typeof json === "object") {
      return NextResponse.json(json, { status: res.status });
    }
    return jsonError(502, "INTERNAL_ERROR", `Backend returned HTTP ${res.status}`);
  }

  return NextResponse.json(json, { status: res.status });
}
