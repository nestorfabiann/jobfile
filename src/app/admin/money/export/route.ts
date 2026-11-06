import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { loadMoney, RANGES, type MoneyRange } from '@/lib/adminMoney';

export const dynamic = 'force-dynamic';

const esc = (v: string | number) => {
  let s = String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // keep spreadsheets from running text as a formula
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET(req: Request) {
  const { db } = await requireAdmin();
  const q = new URL(req.url).searchParams.get('r');
  const r = (RANGES.find(([k]) => k === q)?.[0] ?? '30') as MoneyRange;
  const d = await loadMoney(db, r);
  const head = ['Project', 'Trade', 'City', 'Signed', 'Agreed ($)', 'Change orders ($)', 'Marked paid ($)', 'Requested, not paid ($)'];
  const lines = d.projects.map((p) => [p.name, p.trade, p.city, p.executedAt.slice(0, 10), (p.agreed / 100).toFixed(2), (p.changes / 100).toFixed(2), (p.paid / 100).toFixed(2), (p.requested / 100).toFixed(2)].map(esc).join(','));
  return new NextResponse([head.map(esc).join(','), ...lines].join('\n'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="jobfile-money-${r}.csv"` },
  });
}
