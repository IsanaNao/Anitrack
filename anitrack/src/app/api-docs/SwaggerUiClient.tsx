"use client";

import { useEffect, useRef } from "react";

import "swagger-ui-dist/swagger-ui.css";

export function SwaggerUiClient() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    let cancelled = false;

    void (async () => {
      const mod = await import("swagger-ui-dist/swagger-ui-bundle.js");
      const SwaggerUIBundle = mod.default;
      if (cancelled || !rootRef.current) return;

      SwaggerUIBundle({
        domNode: rootRef.current,
        url: "/swagger.json",
        deepLinking: true,
        tryItOutEnabled: true,
      });
    })();

    return () => {
      cancelled = true;
      el.replaceChildren();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="border-b border-neutral-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold text-neutral-900">Anitrack API 文档</h1>
        <p className="text-sm text-neutral-600">
          OpenAPI 规范：<code className="rounded bg-neutral-100 px-1">/swagger.json</code>
          — 下方可使用 Try it out 直接调用同源 API。
        </p>
      </div>
      <div ref={rootRef} className="swagger-ui-wrap" />
    </div>
  );
}
