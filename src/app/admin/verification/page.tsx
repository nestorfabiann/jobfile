import { requireAdmin } from '@/lib/admin';
import AdminInsuranceActions from '@/components/AdminInsuranceActions';
import { fmtDate, INSURANCE_KINDS, isCurrent, type InsuranceKind } from '@/lib/companyProfile';
import { reviewInsurance } from '../actions';

export const dynamic = 'force-dynamic';

export default async function Verification({ searchParams }: { searchParams: { all?: string } }) {
  const { db } = await requireAdmin();
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
      </div>
      {(data ?? []).length === 0 && <div className="card"><p className="muted">{all ? 'No certificates yet.' : 'Nothing waiting for review.'}</p></div>}
      {(data ?? []).map((i: any) => (
        <div className="card" key={i.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{i.companies?.name ?? 'Company'} · {INSURANCE_KINDS[i.kind as InsuranceKind] ?? i.kind}</b>
            <span className={`pill ${i.status === 'approved' ? (isCurrent(i) ? 'ok' : 'bad') : i.status === 'rejected' ? 'bad' : 'warn'}`}>{i.status === 'approved' && !isCurrent(i) ? 'expired' : i.status}</span>
          </div>
          <p className="muted small">{[i.carrier, i.coverage && `Coverage ${i.coverage}`, `Expires ${fmtDate(i.expires_on)}`].filter(Boolean).join(' · ')}</p>
          <div className="row"><a className="btn ghost" href={`/admin/verification/file/${i.id}`} target="_blank" rel="noopener noreferrer">Open certificate</a></div>
          {i.review_note ? <p className="small">Note: {i.review_note}</p> : null}
          <AdminInsuranceActions id={i.id} review={reviewInsurance} />
        </div>
      ))}
    </>
  );
}
