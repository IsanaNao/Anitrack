"use client";

import { useI18n } from "@/i18n/I18nProvider";

export type SortKey = "updatedAt:desc" | "createdAt:desc" | "rating:desc";

const options: { value: SortKey; labelKey: string }[] = [
  { value: "updatedAt:desc", labelKey: "sort.updatedAtDesc" },
  { value: "createdAt:desc", labelKey: "sort.createdAtDesc" },
  { value: "rating:desc", labelKey: "sort.ratingDesc" },
];

export function SortSelect({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (v: SortKey) => void;
}) {
  const { t } = useI18n();

  return (
    <label className="flex items-center gap-2">
      <span className="text-sm text-zinc-600 dark:text-zinc-300">{t("common.sort")}</span>
      <select
        className="h-9 rounded-md border border-zinc-200 bg-transparent px-2 text-sm outline-none dark:border-zinc-800"
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {t(o.labelKey)}
          </option>
        ))}
      </select>
    </label>
  );
}
