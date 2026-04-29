export type SortKey = "updatedAt:desc" | "createdAt:desc" | "rating:desc";

const options: { value: SortKey; label: string }[] = [
  { value: "updatedAt:desc", label: "最近更新" },
  { value: "createdAt:desc", label: "最近添加" },
  { value: "rating:desc", label: "评分（高→低）" },
];

export function SortSelect({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (v: SortKey) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-sm text-zinc-600 dark:text-zinc-300">排序</span>
      <select
        className="h-9 rounded-md border border-zinc-200 bg-transparent px-2 text-sm outline-none dark:border-zinc-800"
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

