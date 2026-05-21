"use client";

import { useI18n } from "@/i18n/I18nProvider";
import type { Locale } from "@/i18n/types";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  const btn = (code: Locale, label: string) => {
    const active = locale === code;
    return (
      <button
        key={code}
        type="button"
        aria-pressed={active}
        onClick={() => setLocale(code)}
        className={
          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors " +
          (active
            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900")
        }
      >
        {label}
      </button>
    );
  };

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-zinc-200 bg-zinc-50/80 p-0.5 dark:border-zinc-800 dark:bg-zinc-900/50"
      role="group"
      aria-label={t("lang.switch")}
    >
      {btn("zh", t("lang.zh"))}
      {btn("en", t("lang.en"))}
    </div>
  );
}
