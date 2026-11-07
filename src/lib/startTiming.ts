/** Helpers for the "When do you want to start?" answer (answers.when) and "Is the date flexible?" (answers.flex). */
const WINDOW_DAYS: Record<string, number> = { 'Within 2 weeks': 14, 'This month': 31, '1 to 3 months': 92 };

export type TimingTag = { text: string; urgent: boolean };

/** Short tags for a job card or job page. Empty when the homeowner gave no answer. */
export function timingTags(answers: unknown): TimingTag[] {
  const a = (answers && typeof answers === 'object' ? answers : {}) as Record<string, unknown>;
  const when = typeof a.when === 'string' ? a.when : '';
  const flex = typeof a.flex === 'string' ? a.flex : '';
  const out: TimingTag[] = [];
  if (when === 'Within 2 weeks') out.push({ text: 'ASAP · within 2 weeks', urgent: true });
  else if (when === 'This month') out.push({ text: 'Start: this month', urgent: false });
  else if (when === '1 to 3 months') out.push({ text: 'Start: 1 to 3 months', urgent: false });
  else if (when === 'Just pricing') out.push({ text: 'Just pricing', urgent: false });
  if (when && when !== 'Just pricing') {
    if (flex === 'Very flexible') out.push({ text: 'Flexible', urgent: false });
    else if (flex === 'Fixed deadline') out.push({ text: 'Fixed deadline', urgent: false });
  }
  return out;
}

/** Does a bid's earliest start date fit what the homeowner asked? Null when there is nothing to compare. */
export function startFit(answers: unknown, postedAt: string, startDate: string | null | undefined): 'fits' | 'later' | null {
  const a = (answers && typeof answers === 'object' ? answers : {}) as Record<string, unknown>;
  const days = typeof a.when === 'string' ? WINDOW_DAYS[a.when] : undefined;
  if (!days || !startDate) return null;
  const start = new Date(`${startDate}T12:00:00`).getTime();
  const base = new Date(postedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(base)) return null;
  return start <= base + days * 86400000 ? 'fits' : 'later';
}
