"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n/I18nProvider";

function NavLink({
  href,
  children,
  onNavigate,
}: {
  href: string;
  children: React.ReactNode;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={
        "rounded-md px-3 py-2 text-sm font-medium transition-colors " +
        (active
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black"
          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900")
      }
    >
      {children}
    </Link>
  );
}

export function TopNav() {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const closeMenu = () => setMenuOpen(false);

  const links = (
    <>
      <NavLink href="/" onNavigate={closeMenu}>
        {t("nav.dashboard")}
      </NavLink>
      <NavLink href="/timetable" onNavigate={closeMenu}>
        {t("nav.timetable")}
      </NavLink>
      <NavLink href="/library" onNavigate={closeMenu}>
        {t("nav.library")}
      </NavLink>
      <NavLink href="/profile" onNavigate={closeMenu}>
        {t("nav.profile")}
      </NavLink>
    </>
  );

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)] dark:border-zinc-800 dark:bg-black/50">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <Link
          href="/"
          className="shrink-0 text-sm font-semibold tracking-tight"
          onClick={closeMenu}
        >
          Anitrack
        </Link>

        <nav
          className="hidden flex-wrap items-center justify-end gap-1 md:flex md:gap-2"
          aria-label={t("nav.main")}
        >
          {links}
          <div className="ml-1 md:ml-2">
            <LanguageSwitcher />
          </div>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <LanguageSwitcher />
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="sr-only">
              {menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            </span>
            <span className="text-lg leading-none" aria-hidden>
              {menuOpen ? "✕" : "☰"}
            </span>
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav
          id="mobile-nav"
          className="border-t border-zinc-200 px-3 py-2 md:hidden dark:border-zinc-800"
          aria-label={t("nav.main")}
        >
          <div className="grid gap-1">{links}</div>
        </nav>
      ) : null}
    </header>
  );
}
