"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { syncMirrorSeasonalI18n } from "@/lib/api";

/** 客户端启动时触发 Mirror 当季 Bangumi 映射，避免推荐/时间表语言字段缺失。 */
export function MirrorI18nBootstrap() {
  const qc = useQueryClient();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void syncMirrorSeasonalI18n()
      .then((res) => {
        if (res.queued <= 0) return;
        const refetch = () => {
          void qc.invalidateQueries({ queryKey: ["anime-meta", "seasonal-random"] });
          void qc.invalidateQueries({ queryKey: ["anime-meta", "timetable"] });
        };
        window.setTimeout(refetch, 4000);
        window.setTimeout(refetch, 12000);
      })
      .catch(() => {
        /* 静默：映射为后台增强，不阻断 UI */
      });
  }, [qc]);

  return null;
}
