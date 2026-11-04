import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { reviewLinkedRating } from './actions';

export const dynamic = 'force-dynamic';

export default async function LinkedRatings() {
  const { db } = await requireAdmin('verification');
  let rows: any[] = [];
  try {
    rows = ((await db.from('company_ratings').select('*, companies(name,business_zip)').eq('status', 'pending').order('created_at')).data ?? []) as any[];
  } catch { rows = []; }
  return (
    <>
      <Link href="/admin/verification" className="small">‹ Verification</Link>
      <h1>Linked Google pages</h1>
      <p className="muted small">These did not match the business name or ZIP on their own. Approve only if it is the same business. Matching ones go live without review.</p>
      {rows.length === 0 && <div className="card"><p className="muted">Nothing waiting for review.</p></div>}
      {rows.map((r) => (
        <div className="card" key={r.company_id}>
          <b>{r.companies?.name ?? 'Company'}</b>
          <span className="muted small">Jobfile: {r.companies?.name}{r.companies?.business_zip ? `, ${r.companies.business_zip}` : ''}</span>
          <span className="muted small">Google: {r.place_name}, {r.place_address}</span>
          {r.maps_url && <a className="small" href={r.maps_url} target="_blank" rel="noopener noreferrer">Open on Google Maps</a>}
          <div className="row">
            <form action={reviewLinkedRating}><input type="hidden" name="company_id" value={r.company_id} /><input type="hidden" name="decision" value="approved" /><button className="btn" type="submit">Approve</button></form>
            <form action={reviewLinkedRating}><input type="hidden" name="company_id" value={r.company_id} /><input type="hidden" name="decision" value="rejected" /><button className="btn ghost" type="submit">Reject</button></form>
          </div>
        </div>
      ))}
    </>
  );
}
