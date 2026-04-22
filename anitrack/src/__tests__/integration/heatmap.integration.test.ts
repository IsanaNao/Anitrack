import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GET } from "@/app/api/stats/heatmap/route";
import { AnimeEntryModel } from "@/models/AnimeEntry";

/** 与播种/手工数据隔离的测试用 malId 区间 */
const MAL_ID_MIN = 9_100_000_000;
const MAL_ID_MAX = 9_100_000_099;
const MAL_ID_ROW = 9_100_000_042;
const TARGET_DAY = "2026-04-16";

function readSwaggerHeatmapSchema(): { required: string[]; weekRequired: string[]; dayRequired: string[] } {
  const p = path.resolve(process.cwd(), "public", "swagger.json");
  const doc = JSON.parse(fs.readFileSync(p, "utf8")) as {
    components: {
      schemas: {
        HeatmapResponse: { required?: string[] };
        HeatmapWeek: { required?: string[] };
        HeatmapDay: { required?: string[] };
      };
    };
  };
  const hr = doc.components.schemas.HeatmapResponse;
  const hw = doc.components.schemas.HeatmapWeek;
  const hd = doc.components.schemas.HeatmapDay;
  return {
    required: hr.required ?? [],
    weekRequired: hw.required ?? [],
    dayRequired: hd.required ?? [],
  };
}

function assertHeatmapMatchesSwagger(body: unknown) {
  expect(body && typeof body === "object").toBe(true);
  const o = body as Record<string, unknown>;
  const sw = readSwaggerHeatmapSchema();
  for (const k of sw.required) {
    expect(o).toHaveProperty(k);
  }
  expect(Array.isArray(o.weeks)).toBe(true);
  for (const w of o.weeks as Record<string, unknown>[]) {
    for (const k of sw.weekRequired) {
      expect(w).toHaveProperty(k);
    }
    expect(w.days).toHaveLength(7);
    for (const d of w.days as Record<string, unknown>[]) {
      for (const k of sw.dayRequired) {
        expect(d).toHaveProperty(k);
      }
      expect(typeof d.date).toBe("string");
      expect(typeof d.count).toBe("number");
      expect(typeof d.intensity).toBe("number");
    }
  }
}

describe("GET /api/stats/heatmap (integration)", () => {
  beforeAll(async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error(
        "缺少 MONGODB_URI：集成测试需要真实 Mongo（可在 anitrack/.env.local 中配置，由 vitest.integration.config 自动加载）",
      );
    }
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await AnimeEntryModel.deleteMany({ malId: { $gte: MAL_ID_MIN, $lte: MAL_ID_MAX } }).exec();
    await mongoose.disconnect();
  });

  it("weeks 结构符合 swagger；插入 COMPLETED 后对应日期 count > 0", async () => {
    await AnimeEntryModel.deleteMany({ malId: MAL_ID_ROW }).exec();

    const q = "from=2026-04-01&to=2026-04-30&tz=Europe/Berlin";
    const url = `http://local.test/api/stats/heatmap?${q}`;

    const before = await GET(new NextRequest(url));
    expect(before.status).toBe(200);
    const beforeJson = await before.json();
    assertHeatmapMatchesSwagger(beforeJson);

    await AnimeEntryModel.create({
      malId: MAL_ID_ROW,
      title: "vitest heatmap integration",
      status: "COMPLETED",
      completedAt: TARGET_DAY,
      completedDates: [TARGET_DAY],
    });

    const after = await GET(new NextRequest(url));
    expect(after.status).toBe(200);
    const afterJson = (await after.json()) as {
      weeks: { days: { date: string; count: number; intensity: number }[] }[];
    };
    assertHeatmapMatchesSwagger(afterJson);

    const flat = afterJson.weeks.flatMap((w) => w.days);
    const cell = flat.find((d) => d.date === TARGET_DAY);
    expect(cell, `应存在日期 ${TARGET_DAY}`).toBeTruthy();
    expect(cell!.count, `${TARGET_DAY} 的 count 应 > 0`).toBeGreaterThan(0);
    expect(cell!.intensity).toBeGreaterThan(0);
  });
});
