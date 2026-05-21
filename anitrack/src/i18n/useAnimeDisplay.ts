"use client";

import {
  pickAnimeSubtitle,
  pickAnimeSynopsis,
  pickAnimeTitle,
  type AnimeSynopsisFields,
  type AnimeTitleFields,
} from "./anime-display";
import { useI18n } from "./I18nProvider";

export function useAnimeDisplay() {
  const { locale } = useI18n();

  return {
    locale,
    title: (fields: AnimeTitleFields, malId?: number) =>
      pickAnimeTitle(locale, fields, malId),
    subtitle: (fields: AnimeTitleFields, primary: string) =>
      pickAnimeSubtitle(locale, fields, primary),
    synopsis: (fields: AnimeSynopsisFields) => pickAnimeSynopsis(locale, fields),
  };
}
