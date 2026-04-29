export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh w-full bg-zinc-50 font-sans text-zinc-950 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        {children}
      </main>
    </div>
  );
}

