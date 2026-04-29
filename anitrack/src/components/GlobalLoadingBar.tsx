"use client";

import { useIsFetching, useIsMutating } from "@tanstack/react-query";

export function GlobalLoadingBar() {
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const active = fetching + mutating > 0;

  return (
    <div
      aria-hidden
      className="h-0.5 w-full bg-transparent"
      style={{
        background:
          active
            ? "linear-gradient(90deg, rgba(24,24,27,0) 0%, rgba(24,24,27,0.6) 35%, rgba(24,24,27,0) 70%)"
            : "transparent",
        backgroundSize: active ? "200% 100%" : undefined,
        animation: active ? "anitrack-loading 1.0s linear infinite" : undefined,
      }}
    />
  );
}

