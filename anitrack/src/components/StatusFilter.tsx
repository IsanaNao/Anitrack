import type { AnimeStatus } from "@/lib/api";

const options: { key: AnimeStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "全部" },
  { key: "PLANNED", label: "想看" },
  { key: "WATCHING", label: "在看" },
  { key: "COMPLETED", label: "已看" },
  { key: "DROPPED", label: "弃番" },
  { key: "ON_HOLD", label: "搁置" },
];

export function StatusFilter({
  value,
  onChange,
}: {
  value: AnimeStatus | "ALL";
  onChange: (v: AnimeStatus | "ALL") => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
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
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

