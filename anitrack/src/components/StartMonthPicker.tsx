"use client";

import { useMemo } from "react";

import { useI18n } from "@/i18n/I18nProvider";
import { en } from "@/i18n/messages/en";
import { zh } from "@/i18n/messages/zh";

function parseYYYYMM(v: string) {
  const [y, m] = v.split("-").map((x) => Number(x));
  return {
    year: Number.isFinite(y) ? y : 2005,
    month: Number.isFinite(m) && m >= 1 && m <= 12 ? m : 1,
  };
}

const selectClass =
  "h-10 rounded-md border border-zinc-200 bg-transparent px-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600";

export function StartMonthPicker({
  value,
  onChange,
  minYear = 1900,
  maxYear = 2100,
}: {
  value: string;
  onChange: (ym: string) => void;
  minYear?: number;
  maxYear?: number;
}) {
  const { t, locale } = useI18n();
  const monthNames = locale === "en" ? en.months.long : zh.months.long;
  const { year, month } = parseYYYYMM(value);

  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = minYear; y <= maxYear; y++) ys.push(y);
    return ys;
  }, [minYear, maxYear]);

  const setYear = (y: number) => {
    onChange(`${y}-${String(month).padStart(2, "0")}`);
  };

  const setMonth = (m: number) => {
    onChange(`${year}-${String(m).padStart(2, "0")}`);
  };

  return (
    <div className="flex max-w-[min(100%,320px)] gap-2">
      <select
        className={`${selectClass} min-w-0 flex-1`}
        value={year}
        aria-label={t("profile.startMonthYear")}
        onChange={(e) => setYear(Number(e.target.value))}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <select
        className={`${selectClass} min-w-0 flex-[1.35]`}
        value={month}
        aria-label={t("profile.startMonthMonth")}
        onChange={(e) => setMonth(Number(e.target.value))}
      >
        {monthNames.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}
