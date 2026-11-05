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

export const GENERIC_PHASES = ['Demo and prep', 'Main work', 'Finish and paint', 'Cleanup and walkthrough'];
export const CLEANUP = 'Cleanup and walkthrough';
const hasCleanup = (n: string) => /clean|walk-?through|punch/i.test(n);

/** Short starter lists by trade, used when the agreement has only one work item (marketplace jobs start that way). */
const TRADE_PHASES: [RegExp, string, string[]][] = [
  [/roof/i, 'Roofing', ['Tear-off', 'Decking and underlayment', 'Shingles', CLEANUP]],
  [/paint/i, 'Painting', ['Prep and masking', 'Priming and first coat', 'Finish coat and trim', CLEANUP]],
  [/bath/i, 'Bathroom', ['Demo', 'Plumbing and rough-in', 'Tile and fixtures', CLEANUP]],
  [/kitchen/i, 'Kitchen', ['Demo', 'Cabinets and counters', 'Backsplash and fixtures', CLEANUP]],
  [/floor/i, 'Flooring', ['Remove old flooring', 'Subfloor prep', 'Install flooring', CLEANUP]],
  [/fenc/i, 'Fencing', ['Layout and post holes', 'Posts and rails', 'Pickets and gates', CLEANUP]],
  [/deck|patio/i, 'Decks and patios', ['Layout and footings', 'Framing', 'Decking and rails', CLEANUP]],
  [/concrete|driveway/i, 'Concrete', ['Demo and grading', 'Forms and rebar', 'Pour and finish', CLEANUP]],
  [/electric/i, 'Electrical', ['Planning and permits', 'Rough-in wiring', 'Fixtures and devices', CLEANUP]],
  [/plumb/i, 'Plumbing', ['Shut-off and demo', 'Rough-in', 'Fixtures and testing', CLEANUP]],
  [/hvac|heating|cooling|\bac\b/i, 'HVAC', ['Removal', 'Equipment and ductwork', 'Startup and testing', CLEANUP]],
  [/window|door/i, 'Windows and doors', ['Measure and remove', 'Install', 'Trim and seal', CLEANUP]],
  [/siding|exterior/i, 'Siding', ['Remove old siding', 'Wrap and flashing', 'Install siding', CLEANUP]],
  [/landscap|lawn|yard/i, 'Landscaping', ['Clear and grade', 'Planting and sod', 'Mulch and edging', CLEANUP]],
  [/drywall|carpent/i, 'Drywall and carpentry', ['Framing', 'Hang drywall', 'Tape, mud and sand', CLEANUP]],
  [/garage/i, 'Garage', ['Clear and prep', 'Main work', 'Finish', CLEANUP]],
];
export function tradePhases(...texts: string[]): string[] | null {
  const t = texts.join(' ');
  const hit = TRADE_PHASES.find(([re]) => re.test(t));
  return hit ? hit[2] : null;
}

/**
 * Phase names for a new schedule. Two or more work items in the agreement: each becomes a phase, in order.
 * One or none: a short list for the trade, then the generic list. Cleanup and walkthrough always ends the list.
 */
export function phasePlan(workTitles: string[], projectName: string): { names: string[]; fromAgreement: boolean; label: string } {
  const titles = workTitles.map((x) => x.trim().slice(0, 120)).filter(Boolean);
  if (titles.length >= 2) {
    const names = titles.slice(0, hasCleanup(titles.join(' ')) ? 8 : 7);
    if (!names.some(hasCleanup)) names.push(CLEANUP);
    return { names, fromAgreement: true, label: 'From the agreement' };
  }
  const trade = tradePhases(titles.join(' '), projectName);
  if (trade) return { names: trade, fromAgreement: false, label: 'Starter for this kind of job' };
  return { names: GENERIC_PHASES, fromAgreement: false, label: '' };
}

/** A starter schedule spread evenly between the agreement's dates. */
export function starterPhases(start: string, end: string, names: string[] = GENERIC_PHASES): { title: string; starts_on: string; ends_on: string }[] {
  const total = Math.max(names.length, daysBetween(start, end) + 1);
  const per = Math.floor(total / names.length);
  return names.map((title, i) => {
    const s = addDays(start, i * per);
    const e = i === names.length - 1 ? end : addDays(start, (i + 1) * per - 1);
    return { title, starts_on: s, ends_on: e < s ? s : e };
  });
}
