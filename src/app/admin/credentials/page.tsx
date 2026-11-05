import { requireAdmin } from '@/lib/admin';
import AdminInsuranceActions from '@/components/AdminInsuranceActions';
import { fmtDate } from '@/lib/companyProfile';
import { credShort } from '@/lib/credentials';
import { reviewCredential } from '../actions';

export const dynamic = 'force-dynamic';

export default async function Credentials({ searchParams }: { searchParams: { all?: string } }) {
  const { db } = await requireAdmin('verification');
  const all = searchParams.all === '1';
  let rows: any[] = [];
  try {
    let q = db.from('company_credentials').select('*, companies(name)').order('created_at', { ascending: false }).limit(100);
    if (!all) q = q.eq('status', 'stated');
    rows = (await q).data ?? [];
  } catch { /* table not created yet */ }
  return (
    <>
      <h1>Credentials</h1>
      <p className="muted small">Open the link or proof and check that it is this business: same name, same area, still active. Approving shows &ldquo;Checked by Jobfile&rdquo;. Rejecting hides it and tells the contractor why. Anything you leave alone stays labeled &ldquo;Stated by contractor&rdquo;.</p>
      <div className="row">
        <a className={`btn ${all ? 'ghost' : ''}`} href="/admin/credentials">To check</a>
        <a className={`btn ${all ? '' : 'ghost'}`} href="/admin/credentials?all=1">All</a>
        <a className="btn ghost" href="/admin/verification">Insurance</a>
      </div>
      {rows.length === 0 && <div className="card"><p className="muted">{all ? 'No credentials yet.' : 'Nothing waiting for a check.'}</p></div>}
      {rows.map((c: any) => (
        <div className="card" key={c.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{c.companies?.name ?? 'Company'} &middot; {c.name}</b>
            <span className={`pill ${c.status === 'checked' ? 'ok' : c.status === 'rejected' ? 'bad' : 'warn'}`}>{c.status === 'stated' ? 'to check' : c.status}</span>
          </div>
          <p className="muted small">{credShort(c.kind)}{c.expires_on ? ` \u00b7 expires ${fmtDate(c.expires_on)}` : ''}</p>
          <div className="row">
            {c.link ? <a className="btn ghost" href={c.link} target="_blank" rel="noopener noreferrer nofollow">Open their link</a> : null}
            {c.proof_path ? <a className="btn ghost" href={`/admin/credentials/file/${c.id}`} target="_blank" rel="noopener noreferrer">Open proof</a> : null}
          </div>
          {c.link ? <p className="muted small" style={{ wordBreak: 'break-all' }}>{c.link}</p> : null}
          {c.review_note ? <p className="small">Note: {c.review_note}</p> : null}
          <AdminInsuranceActions id={c.id} review={reviewCredential} approve="checked" approveLabel="Mark as checked" />
        </div>
      ))}
    </>
  );
}
