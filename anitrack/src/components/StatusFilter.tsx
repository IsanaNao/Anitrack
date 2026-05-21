"use client";

import type { AnimeStatus } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";

const keys: { key: AnimeStatus | "ALL"; labelKey: string }[] = [
  { key: "ALL", labelKey: "status.ALL" },
  { key: "PLANNED", labelKey: "status.PLANNED" },
  { key: "WATCHING", labelKey: "status.WATCHING" },
  { key: "COMPLETED", labelKey: "status.COMPLETED" },
  { key: "DROPPED", labelKey: "status.DROPPED" },
  { key: "ON_HOLD", labelKey: "status.ON_HOLD" },
];

export function StatusFilter({
  value,
  onChange,
}: {
  value: AnimeStatus | "ALL";
  onChange: (v: AnimeStatus | "ALL") => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap gap-2">
      {keys.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={
              "h-9 rounded-md px-3 text-sm font-medium " +
              (active
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black"
                : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900")
            }
          >
            {t(o.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
