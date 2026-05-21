export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh w-full bg-zinc-50 font-sans text-zinc-950 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-3 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:gap-6 sm:px-4 sm:py-8">
        {children}
      </main>
    </div>
  );
}

