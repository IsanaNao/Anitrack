import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/stats/heatmap/route";

describe("GET /api/stats/heatmap (integration)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("代理到 NestJS：应转发 start/end/tz，并返回按月 months[] 结构", async () => {
    const mockBody = {
      start: "2005-05",
      end: "2005-06",
      months: [
        { month: "2005-05", addedCount: 1, completedCount: 2, episodeCount: 24, intensity: 2 },
        { month: "2005-06", addedCount: 0, completedCount: 0, episodeCount: 0, intensity: 0 },
      ],
    };

    const fetchMock = vi.fn(async (input: any) => {
      const u = String(input);
      expect(u).toContain("http://localhost:3001/api/stats/heatmap?");
      expect(u).toContain("start=2005-05");
      expect(u).toContain("end=2005-06");
      expect(u).toContain("tz=Europe%2FBerlin");
      return new Response(JSON.stringify(mockBody), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    // @ts-expect-error test stub
    globalThis.fetch = fetchMock;

    const q = "start=2005-05&end=2005-06&tz=Europe/Berlin";
    const url = `http://local.test/api/stats/heatmap?${q}`;
    const res = await GET(new NextRequest(url));
    expect(res.status).toBe(200);

    const json = (await res.json()) as any;
    expect(json).toHaveProperty("start", "2005-05");
    expect(json).toHaveProperty("end", "2005-06");
    expect(Array.isArray(json.months)).toBe(true);
    expect(json.months.length).toBeGreaterThan(0);
    expect(json.months[0]).toHaveProperty("month");
    expect(json.months[0]).toHaveProperty("addedCount");
    expect(json.months[0]).toHaveProperty("completedCount");
    expect(json.months[0]).toHaveProperty("episodeCount");
    expect(json.months[0]).toHaveProperty("intensity");
  });
});
