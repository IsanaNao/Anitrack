import { describe, expect, it } from "vitest";

import {
  addCalendarDaysUTC,
  buildHeatmapWeeks,
  calculateIntensity,
  compareYMD,
  listDaysInclusive,
  mondayOnOrBeforeUTC,
} from "../heatmapCalc";

describe("calculateIntensity", () => {
  it("maps counts per Blueprint §5.2", () => {
    expect(calculateIntensity(0)).toBe(0);
    expect(calculateIntensity(1)).toBe(1);
    expect(calculateIntensity(2)).toBe(2);
    expect(calculateIntensity(3)).toBe(3);
    expect(calculateIntensity(4)).toBe(3);
    expect(calculateIntensity(5)).toBe(4);
    expect(calculateIntensity(99)).toBe(4);
  });

  it("treats non-finite as 0", () => {
    expect(calculateIntensity(Number.NaN)).toBe(0);
    expect(calculateIntensity(-3)).toBe(0);
  });
});

describe("buildHeatmapWeeks", () => {
  it("returns continuous Monday-based weeks covering [from,to] with empty counts → intensity 0", () => {
    const from = "2025-04-20";
    const to = "2026-04-20";
    const weeks = buildHeatmapWeeks(from, to, new Map());

    expect(weeks.length).toBeGreaterThanOrEqual(52);

    const allDates: string[] = [];
    for (const w of weeks) {
      expect(w.days).toHaveLength(7);
      expect(w.weekStart).toBe(mondayOnOrBeforeUTC(w.days[0]!.date));
      for (const d of w.days) {
        allDates.push(d.date);
        expect(d.count).toBe(0);
        expect(d.intensity).toBe(0);
      }
    }

    const unique = new Set(allDates);
    expect(unique.size).toBe(allDates.length);

    const inRange = listDaysInclusive(from, to);
    for (const day of inRange) {
      expect(unique.has(day)).toBe(true);
    }
  });

  it("merges counts and applies intensity inside range only", () => {
    const from = "2026-04-11";
    const to = "2026-04-20";
    const counts = new Map<string, number>([
      ["2026-04-15", 1],
      ["2026-04-16", 5],
      ["2026-04-17", 2],
      ["2026-04-18", 3],
      ["2026-04-19", 4],
    ]);

    const weeks = buildHeatmapWeeks(from, to, counts);
    const flat = weeks.flatMap((w) => w.days);
    const byDate = Object.fromEntries(flat.map((d) => [d.date, d]));

    expect(byDate["2026-04-15"]!.count).toBe(1);
    expect(byDate["2026-04-15"]!.intensity).toBe(1);

    expect(byDate["2026-04-16"]!.count).toBe(5);
    expect(byDate["2026-04-16"]!.intensity).toBe(4);

    expect(byDate["2026-04-17"]!.intensity).toBe(2);
    expect(byDate["2026-04-18"]!.intensity).toBe(3);
    expect(byDate["2026-04-19"]!.intensity).toBe(3);

    expect(byDate["2026-04-11"]!.count).toBe(0);
    expect(byDate["2026-04-11"]!.intensity).toBe(0);
  });

  it("returns [] when from > to", () => {
    expect(buildHeatmapWeeks("2026-05-01", "2026-04-01", new Map())).toEqual([]);
  });
});

describe("compareYMD", () => {
  it("orders lexicographically", () => {
    expect(compareYMD("2026-04-01", "2026-04-02")).toBeLessThan(0);
    expect(compareYMD("2026-04-02", "2026-04-02")).toBe(0);
  });
});
