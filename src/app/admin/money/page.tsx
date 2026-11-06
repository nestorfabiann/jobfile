import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { dollars } from '@/lib/money';
import { groupSum, loadMoney, monthKey, RANGES, type MoneyRange } from '@/lib/adminMoney';

export const dynamic = 'force-dynamic';
const DAY = 86400000;

export default async function AdminMoney({ searchParams }: { searchParams: { r?: string } }) {
  const { db } = await requireAdmin();
  const r = (RANGES.find(([k]) => k === searchParams.r)?.[0] ?? '30') as MoneyRange;
  const d = await loadMoney(db, r);
  const agreed = d.projects.reduce((s, p) => s + p.agreed, 0);
  const paid = d.statusSplit.paid, requested = d.statusSplit.requested, scheduled = d.statusSplit.scheduled;
  const changes = d.projects.reduce((s, p) => s + p.changes, 0);
  const n = d.projects.length;

  // Month chart: agreed by signing month, paid by payment month.
  const months = new Map<string, { a: number; p: number }>();
  for (const p of d.projects) { const k = monthKey(p.executedAt); const c = months.get(k) ?? { a: 0, p: 0 }; c.a += p.agreed; months.set(k, c); }
  for (const e of d.paidEvents) { const k = monthKey(e.at); const c = months.get(k) ?? { a: 0, p: 0 }; c.p += e.cents; months.set(k, c); }
  const mrows = [...months.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).slice(-12);
  const maxM = Math.max(1, ...mrows.flatMap(([, v]) => [v.a, v.p]));

  const byTrade = groupSum(d.projects, (p) => p.trade).slice(0, 8);
  const byCity = groupSum(d.projects, (p) => p.city).slice(0, 8);
  const top = [...d.projects].sort((a, b) => b.agreed - a.agreed).slice(0, 8);
  const flags = [
    ...d.projects.filter((p) => p.oldestRequestAt && Date.now() - new Date(p.oldestRequestAt).getTime() > 14 * DAY).map((p) => ({ p, why: 'Payment requested 14+ days ago, no response' })),
    ...d.projects.filter((p) => p.agreed >= 5000000).map((p) => ({ p, why: 'Large project (over $50,000)' })),
    ...d.projects.filter((p) => p.agreed > 0 && p.paid > 0 && p.paid / p.agreed < 0.25 && Date.now() - new Date(p.executedAt).getTime() > 60 * DAY).map((p) => ({ p, why: 'Signed 60+ days ago, under 25% paid' })),
  ].slice(0, 12);

  const bar = (v: number, max: number, color: string) => <div style={{ height: 10, borderRadius: 5, background: color, width: `${Math.max(2, (v / max) * 100)}%` }} />;
  const stat = (label: string, cents: number, sub?: string) => (
    <div className="card" key={label} style={{ gap: 4 }}>
      <span className="muted small">{label}</span>
      <b style={{ fontSize: 26 }}>{dollars(cents)}</b>
      {sub ? <span className="muted small">{sub}</span> : null}
    </div>
  );
  const table = (title: string, rows: { k: string; agreed: number; paid: number; n: number }[]) => (
    <div className="card" style={{ gap: 10 }}>
      <b>{title}</b>
      {rows.length === 0 ? <span className="muted small">Nothing yet.</span> : rows.map((x) => (
        <div key={x.k} style={{ display: 'grid', gap: 4 }}>
          <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}><span>{x.k} <span className="muted small">· {x.n}</span></span><b>{dollars(x.agreed)}</b></div>
          {bar(x.agreed, rows[0].agreed || 1, 'var(--accent, #e8590c)')}
        </div>
      ))}
    </div>
  );

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div>
        <h1 style={{ margin: 0 }}>Money</h1>
        <p className="muted small" style={{ margin: '4px 0 0' }}>Recorded in the app. Jobfile does not hold the money, and these numbers are not audited.</p>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {RANGES.map(([k, l]) => <Link key={k} href={`/admin/money?r=${k}`} className={`btn ${r === k ? '' : 'ghost'}`} style={{ minHeight: 40, padding: '6px 16px' }}>{l}</Link>)}
        <a href={`/admin/money/export?r=${r}`} className="btn ghost" style={{ minHeight: 40, padding: '6px 16px' }}>Download CSV</a>
      </div>

      <div className="card" style={{ gap: 4 }}>
        <span className="muted small">Agreed project value (signed agreements)</span>
        <b style={{ fontSize: 34 }}>{dollars(agreed)}</b>
        <span className="muted small">{n} project{n === 1 ? '' : 's'}{n ? ` · average ${dollars(Math.round(agreed / n))}` : ''}</span>
      </div>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {stat('Marked paid', paid, 'payments recorded as paid')}
        {stat('Requested, not paid', requested)}
        {stat('Not yet requested', scheduled)}
        {stat('Approved change orders', changes)}
        {stat('Marketplace awarded', d.awardedCents, `${d.awardedCount} winning bid${d.awardedCount === 1 ? '' : 's'}`)}
      </div>

      <div className="card" style={{ gap: 10 }}>
        <b>Agreed vs paid by month</b>
        {mrows.length === 0 ? <span className="muted small">Nothing in this range.</span> : mrows.map(([k, v]) => (
          <div key={k} style={{ display: 'grid', gap: 3 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{k}</span><span className="muted small">{dollars(v.a)} agreed · {dollars(v.p)} paid</span></div>
            {bar(v.a, maxM, 'var(--accent, #e8590c)')}
            {bar(v.p, maxM, 'var(--ok, #2f9e44)')}
          </div>
        ))}
        <span className="muted small">Orange: agreed when the agreement was signed. Green: marked paid.</span>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {table('By trade', byTrade)}
        {table('By city', byCity)}
      </div>

      <div className="card" style={{ gap: 8 }}>
        <b>Biggest projects</b>
        {top.length === 0 ? <span className="muted small">Nothing yet.</span> : top.map((p) => (
          <Link key={p.id} href={`/admin/projects/${p.id}`} className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
            <span>{p.name}</span><span><b>{dollars(p.agreed)}</b> <span className="muted small">· {dollars(p.paid)} paid</span></span>
          </Link>
        ))}
      </div>

      <div className="card" style={{ gap: 8 }}>
        <b>Worth a look</b>
        {flags.length === 0 ? <span className="muted small">Nothing flagged.</span> : flags.map(({ p, why }, i) => (
          <Link key={p.id + i} href={`/admin/projects/${p.id}`} className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
            <span>{p.name}<br /><span className="muted small">{why}</span></span><b>{dollars(p.agreed)}</b>
          </Link>
        ))}
      </div>
    </div>
  );
}
