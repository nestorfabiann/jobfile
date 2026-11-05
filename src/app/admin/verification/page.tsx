import { requireAdmin } from '@/lib/admin';
import AdminInsuranceActions from '@/components/AdminInsuranceActions';
import { fmtDate, INSURANCE_KINDS, isCurrent, type InsuranceKind } from '@/lib/companyProfile';
import { reviewInsurance } from '../actions';

export const dynamic = 'force-dynamic';

export default async function Verification({ searchParams }: { searchParams: { all?: string } }) {
  const { db } = await requireAdmin('verification');
  const all = searchParams.all === '1';
  let q = db.from('company_insurance').select('*, companies(name)').order('uploaded_at', { ascending: false }).limit(100);
  if (!all) q = q.eq('status', 'pending');
  const { data } = await q;
  return (
    <>
      <h1>Insurance verification</h1>
      <p className="muted small">
        Open the certificate and check that the business name matches, the policy is active, and the dates and coverage match what the contractor typed. Opening a file is written to the audit log. Approving shows the &ldquo;Insurance verified&rdquo; badge until the policy expiry date.
      </p>
      <div className="row">
        <a className={`btn ${all ? 'ghost' : ''}`} href="/admin/verification">Pending</a>
        <a className={`btn ${all ? '' : 'ghost'}`} href="/admin/verification?all=1">All</a>
        <a className="btn ghost" href="/admin/linked-ratings">Linked Google pages</a>
      </div>
      {(data ?? []).length === 0 && <div className="card"><p className="muted">{all ? 'No certificates yet.' : 'Nothing waiting for review.'}</p></div>}
      {(data ?? []).map((i: any) => (
        <div className="card" key={i.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{i.companies?.name ?? 'Company'} · {INSURANCE_KINDS[i.kind as InsuranceKind] ?? i.kind}</b>
            <span className={`pill ${i.status === 'approved' ? (isCurrent(i) ? 'ok' : 'bad') : i.status === 'rejected' ? 'bad' : 'warn'}`}>{i.status === 'approved' && !isCurrent(i) ? 'expired' : i.status}</span>
          </div>
          <p className="muted small">{[i.carrier, i.coverage && `Coverage ${i.coverage}`, `Expires ${fmtDate(i.expires_on)}`].filter(Boolean).join(' · ')}</p>
          {i.auto_approved ? <p className="small" style={{ margin: 0 }}><span className="pill ok">auto-approved</span> Read: {i.read_detail?.insured || 'name not read'} · expires {i.read_detail?.expires || 'n/a'}</p> : null}
          {i.status === 'pending' && i.read_detail ? (
            <div className="box" style={{ background: 'var(--warn-bg)' }}>
              <b className="small">{i.read_detail.routine === 'first' ? 'Routine check: first certificate from this company' : i.read_detail.routine === 'spot' ? 'Routine spot check' : 'Why it needs you'}</b>
              {(i.read_detail.reasons ?? []).map((x: string) => <div className="small" key={x}>• {x}</div>)}
              {i.read_detail.insured ? <div className="small">Read: {i.read_detail.insured} · {i.read_detail.kind} · expires {i.read_detail.expires || 'not found'}</div> : null}
            </div>
          ) : null}
          <div className="row"><a className="btn ghost" href={`/admin/verification/file/${i.id}`} target="_blank" rel="noopener noreferrer">Open certificate</a></div>
          {i.review_note ? <p className="small">Note: {i.review_note}</p> : null}
          <AdminInsuranceActions id={i.id} review={reviewInsurance} />
        </div>
      ))}
    </>
  );
}
