export function Pagination({
  page,
  totalPages,
  total,
  disabled,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  disabled?: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-5 flex items-center justify-between">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        Page {page} / {totalPages} · Total {total}
      </div>
      <div className="flex items-center gap-2">
        <button
          className="h-9 rounded-md border border-zinc-200 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 disabled:opacity-50"
          onClick={onPrev}
          disabled={disabled || page <= 1}
        >
          上一页
        </button>
        <button
          className="h-9 rounded-md border border-zinc-200 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 disabled:opacity-50"
          onClick={onNext}
          disabled={disabled || page >= totalPages}
        >
          下一页
        </button>
      </div>
    </div>
  );
}

