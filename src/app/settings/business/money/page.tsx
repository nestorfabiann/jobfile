import Link from 'next/link';
import { redirect } from 'next/navigation';
import { myCompanyId } from '@/lib/myCompany';
import { supabaseAdmin } from '@/lib/supabase/server';
import { dollars } from '@/lib/money';
import { moneyFor } from '@/lib/expenses';
import BusinessTabs from '@/components/BusinessTabs';

export const dynamic = 'force-dynamic';

export default async function BusinessMoney() {
  const companyId = await myCompanyId();
  if (!companyId) {
    redirect('/projects');
    return null;
  }
  const db = supabaseAdmin();
  const { data: ps } = await db.from('projects').select('id,name,completed_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(100);
  const projects = (ps ?? []) as { id: string; name: string; completed_at: string | null }[];
  const money = await moneyFor(db, projects.map((p) => p.id));
  const all = Array.from(money.values()).reduce((a, m) => ({ received: a.received + m.received, spent: a.spent + m.spent, toCollect: a.toCollect + m.toCollect, profit: a.profit + m.profit }), { received: 0, spent: 0, toCollect: 0, profit: 0 });
  const active = projects.filter((p) => !p.completed_at);
  const done = projects.filter((p) => p.completed_at);

  const row = (p: { id: string; name: string }) => {
    const m = money.get(p.id)!;
    return (
      <Link key={p.id} href={`/projects/${p.id}/money`} className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', borderTop: '1px solid var(--line)', paddingTop: 10, textDecoration: 'none', color: 'inherit' }}>
        <span className="stack" style={{ gap: 2, minWidth: 0 }}><b>{p.name}</b><span className="muted small">Spent {dollars(m.spent)} of {dollars(m.total)}</span></span>
        <b style={{ color: m.profit < 0 ? 'var(--bad, #b3412f)' : 'var(--ok)', flex: 'none' }}>{m.profit > 0 ? '+' : ''}{dollars(m.profit)}</b>
      </Link>
    );
  };

  return (
    <>
      <div className="stack">
        <h1>Business profile</h1>
        <BusinessTabs active="money" />
        <span className="pill warn" style={{ alignSelf: 'flex-start' }}>🔒 Only you can see this</span>
      </div>
      <div className="card">
        <span className="muted small">All jobs, profit so far</span>
        <b style={{ fontSize: 34, color: all.profit < 0 ? 'var(--bad, #b3412f)' : 'var(--ok)' }}>{dollars(all.profit)}</b>
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Received</span><b>{dollars(all.received)}</b></div>
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Spent</span><b>{dollars(all.spent)}</b></div>
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Still to collect</span><b>{dollars(all.toCollect)}</b></div>
      </div>
      {projects.length === 0 && <div className="card"><p className="muted">No projects yet. Money for each job shows here once you have one.</p></div>}
      {active.length > 0 && <div className="card"><h2>Active jobs</h2>{active.map(row)}</div>}
      {done.length > 0 && <div className="card"><h2>Finished jobs</h2>{done.map(row)}</div>}
      {projects.length > 0 && (
        <>
          <a className="btn ghost" href="/settings/business/money/export">Download for taxes (spreadsheet)</a>
          <p className="muted small">A spreadsheet file (CSV) with every expense: date, project, type, who or where, and amount. Red means a job has cost more than you have collected so far.</p>
        </>
      )}
    </>
  );
}
