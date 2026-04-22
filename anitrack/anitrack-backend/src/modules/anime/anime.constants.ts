export const AnimeStatusValues = [
  'PLANNED',
  'WATCHING',
  'ON_HOLD',
  'DROPPED',
  'COMPLETED',
] as const;

export type AnimeStatus = (typeof AnimeStatusValues)[number];

export function assertAllowedStatusTransition(from: AnimeStatus, to: AnimeStatus) {
  if (from === to) return;

  const allowed: Record<AnimeStatus, AnimeStatus[]> = {
    PLANNED: ['WATCHING', 'ON_HOLD', 'DROPPED', 'COMPLETED'],
    WATCHING: ['ON_HOLD', 'DROPPED', 'COMPLETED'],
    ON_HOLD: ['WATCHING', 'DROPPED', 'COMPLETED'],
    DROPPED: ['PLANNED'],
    COMPLETED: ['WATCHING'],
  };

  if (!allowed[from].includes(to)) {
    const err = new Error(`Invalid status transition: ${from} -> ${to}`);
    (err as any).code = 'INVALID_STATUS_TRANSITION';
    throw err;
  }
}

export function todayYYYYMMDD(): string {
  return new Date().toISOString().slice(0, 10);
}

