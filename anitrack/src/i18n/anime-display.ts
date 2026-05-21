import type { Locale } from "./types";

/** 作品元数据多语言字段（API 可选返回） */
export type AnimeTitleFields = {
  title: string;
  titleCn?: string;
  titleJp?: string;
  titleEn?: string;
};

export type AnimeSynopsisFields = {
  synopsis?: string;
  synopsisCn?: string;
  synopsisEn?: string;
  synopsisJa?: string;
};

function pickFirst(...candidates: (string | undefined)[]): string {
  for (const c of candidates) {
    const t = c?.trim();
    if (t) return t;
  }
  return "";
}

function hasCjk(s: string): boolean {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(s);
}

/**
 * 按 UI 语言选择番剧主标题（与壳层 i18n 解耦，优先 Bangumi/Jikan 映射字段）。
 */
export function pickAnimeTitle(
  locale: Locale,
  fields: AnimeTitleFields,
  fallbackMalId?: number,
): string {
  const { title, titleCn, titleJp, titleEn } = fields;
  if (locale === "zh") {
    const titleMaybeCn =
      title?.trim() && hasCjk(title) ? title.trim() : undefined;
    return (
      pickFirst(titleCn, titleMaybeCn, title, titleJp, titleEn) ||
      (fallbackMalId != null ? `malId: ${fallbackMalId}` : title)
    );
  }
  return (
    pickFirst(titleEn, title, titleJp, titleCn) ||
    (fallbackMalId != null ? `malId: ${fallbackMalId}` : title)
  );
}

/** 副标题：展示与主标题不同的另一语言名称 */
export function pickAnimeSubtitle(
  locale: Locale,
  fields: AnimeTitleFields,
  primary: string,
): string {
  const alt =
    locale === "zh"
      ? pickFirst(fields.titleEn, fields.titleJp)
      : pickFirst(fields.titleJp, fields.titleCn);
  const t = alt.trim();
  return t && t !== primary.trim() ? t : "";
}

export function pickAnimeSynopsis(
  locale: Locale,
  fields: AnimeSynopsisFields,
): string {
  if (locale === "zh") {
    return pickFirst(
      fields.synopsisCn,
      fields.synopsis,
      fields.synopsisEn,
      fields.synopsisJa,
    );
  }
  return pickFirst(
    fields.synopsisEn,
    fields.synopsis,
    fields.synopsisJa,
    fields.synopsisCn,
  );
}
