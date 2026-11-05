import { dollars } from './money';

export const ISSUE_CATEGORIES = [
  ['quality', 'Quality of work'],
  ['payment', 'Payment'],
  ['schedule', 'Schedule'],
  ['extra', 'Extra work'],
  ['communication', 'Communication'],
  ['other', 'Other'],
] as const;
export const categoryLabel = (k: string) => ISSUE_CATEGORIES.find((c) => c[0] === k)?.[1] ?? 'Other';

/** The fixes a side can propose. "disagree" is an answer with an explanation, not a fix. */
export const FIXES = [
  ['redo', 'Redo the work', 'Pick a date. It is recorded on the project.'],
  ['credit', 'A credit or refund', 'Enter an amount.'],
  ['balance', 'Pay the balance', 'Enter the amount still owed.'],
  ['price', 'Adjust the price', 'Enter the new total adjustment.'],
  ['end', 'End the job here', 'Both sides agree to stop.'],
  ['disagree', 'I see it differently', 'Explain your side.'],
] as const;
export const fixLabel = (k: string) => FIXES.find((f) => f[0] === k)?.[1] ?? '';

export const RESPOND_DAYS = 3;
export const MAX_OPEN_ISSUES = 3;
export const MAX_REPORTS_PER_DAY = 5;

export type Issue = {
  id: string; project_id: string; reporter_id: string; reporter_role: 'homeowner' | 'contractor'; category: string; description: string; wants: string;
  status: 'open' | 'agreed' | 'withdrawn'; respond_by: string; escalated_at: string | null; agreed_summary: string; agreed_at: string | null;
  ai_options: string[] | null; mediator_note: string; mediator_sent_at: string | null; created_at: string;
};
export type IssueEvent = {
  id: string; issue_id: string; user_id: string | null; side: 'homeowner' | 'contractor' | 'jobfile'; kind: 'report' | 'proposal' | 'accept' | 'note' | 'recommendation' | 'withdraw' | 'escalate';
  fix: string; amount_cents: number | null; on_date: string | null; body: string; ref_id: string | null; created_at: string;
};

const nice = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
/** A short plain-words line for a proposal. */
export function describeFix(e: { fix: string; amount_cents: number | null; on_date: string | null; body?: string }): string {
  const parts: string[] = [fixLabel(e.fix) || 'Proposal'];
  if (e.amount_cents != null && (e.fix === 'credit' || e.fix === 'balance' || e.fix === 'price')) parts[0] += ` of ${dollars(e.amount_cents)}`;
  if (e.on_date && e.fix === 'redo') parts[0] += ` by ${nice(e.on_date)}`;
  return parts[0];
}

/** Open and past the answer deadline, or someone asked Jobfile to step in. */
export function needsMediator(i: Pick<Issue, 'status' | 'escalated_at' | 'respond_by'>, now = Date.now()): boolean {
  return i.status === 'open' && (!!i.escalated_at || now > new Date(i.respond_by).getTime() + 2 * 86400_000);
}
