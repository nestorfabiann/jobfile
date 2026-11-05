import { supabaseAdmin } from './supabase/server';

export const CRED_KINDS = [
  ['bbb', 'BBB', 'BBB Accredited Business'],
  ['chamber', 'Chamber', 'Chamber of Commerce or local association'],
  ['trade', 'Trade group', 'Trade association'],
  ['maker', 'Manufacturer', 'Manufacturer certification'],
  ['epa', 'EPA lead-safe', 'EPA Lead-Safe (RRP)'],
  ['license', 'License', 'License or registration'],
  ['other', 'Other', 'Other credential'],
] as const;
export type CredKind = (typeof CRED_KINDS)[number][0];
export const credShort = (k: string) => CRED_KINDS.find((x) => x[0] === k)?.[1] ?? 'Other';
export const credDefaultName = (k: string) => CRED_KINDS.find((x) => x[0] === k)?.[2] ?? '';
export const credIcon = (k: string) => (k === 'bbb' ? 'BBB' : k === 'epa' ? 'EPA' : k === 'chamber' ? 'C' : k === 'trade' ? 'T' : k === 'maker' ? 'M' : k === 'license' ? 'L' : '+');

export type Credential = { id: string; company_id: string; kind: string; name: string; link: string | null; proof_path: string | null; expires_on: string | null; status: 'stated' | 'checked' | 'rejected'; review_note: string; created_at: string };

/** True while a credential has not passed its own expiry date. */
export const credCurrent = (c: { expires_on: string | null }) => !c.expires_on || c.expires_on >= new Date().toISOString().slice(0, 10);

/** Credentials people may see for these companies: not rejected, not expired. Checked ones first. Empty when the table is missing. */
export async function publicCredentials(companyIds: string[]): Promise<Map<string, Credential[]>> {
  const out = new Map<string, Credential[]>();
  if (!companyIds.length) return out;
  try {
    const { data } = await supabaseAdmin().from('company_credentials').select('*').in('company_id', companyIds).neq('status', 'rejected').order('created_at');
    for (const c of ((data ?? []) as Credential[]).filter(credCurrent)) out.set(c.company_id, [...(out.get(c.company_id) ?? []), c]);
    out.forEach((v, k) => out.set(k, v.sort((a, b) => Number(b.status === 'checked') - Number(a.status === 'checked'))));
  } catch { /* table not created yet */ }
  return out;
}
