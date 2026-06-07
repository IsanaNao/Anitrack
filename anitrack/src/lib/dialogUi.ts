/** Shared Radix dialog layers — z-50 keeps content above sticky page chrome. */
export const DIALOG_OVERLAY =
  "fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]";

/** Mobile: near full-viewport sheet; sm+: centered modal. */
export function dialogContentClass(maxWidthPx = 720) {
  return (
    "fixed z-50 flex max-h-[calc(100dvh-max(0.5rem,env(safe-area-inset-top))-max(0.5rem,env(safe-area-inset-bottom)))] flex-col overflow-hidden " +
    "inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] bottom-[max(0.5rem,env(safe-area-inset-bottom))] " +
    "rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950 " +
    `sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(85dvh,${maxWidthPx}px)] sm:w-[min(92vw,${maxWidthPx}px)] sm:-translate-x-1/2 sm:-translate-y-1/2`
  );
}

export const DIALOG_BODY_SCROLL = "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3";
export const DIALOG_FOOTER = "shrink-0 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800";
