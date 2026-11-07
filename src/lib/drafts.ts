import { cleanItems, JOB_TYPES } from '@/lib/marketplace';
import { cleanAnswers, type Answers } from '@/lib/scopeQuestions';

export type DraftData = { type: string; picks: string[]; size: string; zip: string; city: string; details: string; bmin: string; bmax: string; answers: Answers; maxBids?: string };
const digitsOnly = (v: unknown, n: number) => String(v ?? '').replace(/\D/g, '').slice(0, n);

/** Keeps only fields and values the form could really have produced. */
export function cleanDraft(raw: any): DraftData {
  const type = JOB_TYPES[String(raw?.type)] ? String(raw.type) : Object.keys(JOB_TYPES)[0];
  const picks = cleanItems(type, Array.isArray(raw?.picks) ? raw.picks.map(String).slice(0, 60) : []).map((x) => x.item);
  return { type, picks, size: digitsOnly(raw?.size, 8), zip: digitsOnly(raw?.zip, 5), city: String(raw?.city ?? '').slice(0, 80), details: String(raw?.details ?? '').slice(0, 1000), bmin: digitsOnly(raw?.bmin, 10), bmax: digitsOnly(raw?.bmax, 10), answers: cleanAnswers(type, raw?.answers), maxBids: ['3', '5', '10', '0'].includes(String(raw?.maxBids)) ? String(raw.maxBids) : '5' };
}
