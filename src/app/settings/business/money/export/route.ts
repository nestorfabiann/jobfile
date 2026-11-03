import { myCompanyId } from '@/lib/myCompany';
import { supabaseAdmin } from '@/lib/supabase/server';
import { CAT_LABEL, catOf } from '@/lib/expenses';

export const dynamic = 'force-dynamic';

// Cells starting with = + - @ would run as formulas in a spreadsheet, so they get a leading apostrophe.
const cell = (v: string) => {
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  const companyId = await myCompanyId();
  if (!companyId) return new Response('Not found', { status: 404 });
  const db = supabaseAdmin();
  const { data: ps } = await db.from('projects').select('id,name').eq('company_id', companyId).limit(500);
  const names = new Map<string, string>((ps ?? []).map((p: any) => [p.id as string, p.name as string] as [string, string]));
  const { data: ex } = names.size
    ? await db.from('project_expenses').select('project_id,amount_cents,category,vendor,spent_on').in('project_id', Array.from(names.keys())).order('spent_on', { ascending: false }).limit(20000)
    : { data: [] as any[] };
  const lines = ['Date,Project,Type,Who or where,Amount'];
  (ex ?? []).forEach((e: any) => {
    lines.push([e.spent_on, names.get(e.project_id) ?? '', CAT_LABEL[catOf(e.category)], e.vendor ?? '', (Number(e.amount_cents) / 100).toFixed(2)].map((v) => cell(String(v))).join(','));
  });
  return new Response('﻿' + lines.join('\r\n') + '\r\n', {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="jobfile-expenses.csv"', 'Cache-Control': 'no-store' },
  });
}
