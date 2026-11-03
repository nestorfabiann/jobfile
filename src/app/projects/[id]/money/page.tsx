import { notFound } from 'next/navigation';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { dollars } from '@/lib/money';
import { signedUrls } from '@/lib/companyProfile';
import { CATS, CAT_LABEL, catOf, moneyFor } from '@/lib/expenses';
import ExpenseForm from '@/components/ExpenseForm';
import { removeExpense } from './actions';

export const dynamic = 'force-dynamic';
const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default async function MyMoney({ params }: { params: { id: string } }) {
  const { project, role } = await loadProject(params.id);
  if (role !== 'contractor') notFound();
  const db = supabaseAdmin();
  const [money, { data: rows }] = await Promise.all([
    moneyFor(db, [project.id]),
    db.from('project_expenses').select('*').eq('project_id', project.id).order('spent_on', { ascending: false }).order('created_at', { ascending: false }).limit(200),
  ]);
  const m = money.get(project.id)!;
  const ex = (rows ?? []) as any[];
  const urls = await signedUrls('expense-receipts', ex.map((e) => e.receipt_path as string).filter(Boolean));
  const pctSpent = m.received + m.spent > 0 ? Math.min(100, Math.round((m.spent / Math.max(m.received, m.spent)) * 100)) : 0;

  return (
    <>
      <span className="pill warn" style={{ alignSelf: 'flex-start' }}>🔒 Only you can see this</span>
      <div className="card">
        <span className="muted small">Profit so far</span>
        <b style={{ fontSize: 34, color: m.profit < 0 ? 'var(--bad, #b3412f)' : 'var(--ok)' }}>{dollars(m.profit)}</b>
        <div style={{ height: 12, borderRadius: 99, background: 'var(--line)', overflow: 'hidden', display: 'flex' }} aria-hidden="true">
          <i style={{ width: `${pctSpent}%`, background: 'var(--bad, #b3412f)' }} /><i style={{ width: `${100 - pctSpent}%`, background: m.received || m.spent ? 'var(--ok)' : 'transparent' }} />
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Received</span><b>{dollars(m.received)}</b></div>
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Spent</span><b>{dollars(m.spent)}</b></div>
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Still to collect</span><b>{dollars(m.toCollect)}</b></div>
        <p className="muted small">Contract {dollars(m.total)}. Received counts payments you confirmed on the Payments tab.</p>
      </div>

      <ExpenseForm projectId={project.id} />

      {m.spent > 0 && (
        <div className="card">
          <h2>Spent by type</h2>
          {CATS.filter((c) => m.byCat[c] > 0).map((c) => (
            <div className="row" key={c} style={{ justifyContent: 'space-between' }}><span>{CAT_LABEL[c]}</span><b>{dollars(m.byCat[c])}</b></div>
          ))}
        </div>
      )}

      <div className="card">
        <h2>Expenses</h2>
        {ex.length === 0 && <p className="muted">No expenses yet. Tap Add expense when you buy materials or pay a helper.</p>}
        {ex.map((e) => (
          <div key={e.id} className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <span className="stack" style={{ gap: 2, minWidth: 0 }}>
              <b>{e.vendor || CAT_LABEL[catOf(e.category)]}</b>
              <span className="muted small">{CAT_LABEL[catOf(e.category)]} · {day(e.spent_on)}{e.receipt_path && urls.get(e.receipt_path) ? <> · <a href={urls.get(e.receipt_path)} target="_blank" rel="noreferrer">📎 receipt</a></> : null}</span>
            </span>
            <span className="stack" style={{ gap: 2, alignItems: 'flex-end', flex: 'none' }}>
              <b>{dollars(Number(e.amount_cents))}</b>
              <form action={removeExpense}><input type="hidden" name="project_id" value={project.id} /><input type="hidden" name="id" value={e.id} /><button className="small" type="submit" style={{ background: 'none', border: 0, color: 'var(--muted)', textDecoration: 'underline', minHeight: 32 }}>Remove</button></form>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
