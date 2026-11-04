export type Availability = 'open' | 'booked' | 'paused';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

/** What a company's status is right now. A booked status ends by itself once its date has passed. */
export function availabilityOf(c: { availability?: string | null; booked_until?: string | null } | null | undefined): { mode: Availability; until: string | null; daysLeft: number | null } {
  const mode = c?.availability === 'booked' || c?.availability === 'paused' ? c.availability : 'open';
  const until = (c?.booked_until as string | null | undefined) ?? null;
  if (mode === 'booked') {
    if (!until || until < today()) return { mode: 'open', until: null, daysLeft: null };
    const days = Math.round((new Date(`${until}T12:00:00`).getTime() - new Date(`${today()}T12:00:00`).getTime()) / 86400_000);
    return { mode: 'booked', until, daysLeft: days };
  }
  return { mode, until: null, daysLeft: null };
}

export const untilText = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
