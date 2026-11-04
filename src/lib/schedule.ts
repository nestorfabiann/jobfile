/** Dates are plain YYYY-MM-DD strings in Central time. */
const TZ = 'America/Chicago';

export const todayChi = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });

export const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86400_000);

export const fmtDay = (iso: string | null | undefined) =>
  iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }) : '';

export const fmtRange = (a: string | null, b: string | null) => (a && b ? (a === b ? fmtDay(a) : `${fmtDay(a)} to ${fmtDay(b)}`) : a ? `From ${fmtDay(a)}` : b ? `Until ${fmtDay(b)}` : 'No dates yet');

export type Phase = { id: string; position: number; title: string; note: string; starts_on: string | null; ends_on: string | null; status: 'upcoming' | 'in_progress' | 'done' };

/** On track unless a phase should have finished already. */
export function scheduleState(phases: Phase[], today = todayChi()): { label: string; tone: 'ok' | 'warn' | 'bad' | '' } {
  if (!phases.length) return { label: 'Not set up', tone: '' };
  if (phases.every((p) => p.status === 'done')) return { label: 'All done', tone: 'ok' };
  const late = phases.filter((p) => p.status !== 'done' && p.ends_on && p.ends_on < today);
  if (late.length) return { label: `${late.length} behind`, tone: 'warn' };
  return { label: 'On track', tone: 'ok' };
}

/** A starter schedule spread evenly between the agreement's dates. */
export function starterPhases(start: string, end: string): { title: string; starts_on: string; ends_on: string }[] {
  const names = ['Demo and prep', 'Main work', 'Finish and paint', 'Cleanup and walkthrough'];
  const total = Math.max(names.length, daysBetween(start, end) + 1);
  const per = Math.floor(total / names.length);
  return names.map((title, i) => {
    const s = addDays(start, i * per);
    const e = i === names.length - 1 ? end : addDays(start, (i + 1) * per - 1);
    return { title, starts_on: s, ends_on: e < s ? s : e };
  });
}
