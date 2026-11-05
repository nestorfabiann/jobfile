import { requireAdmin } from '@/lib/admin';
import AdminInsuranceActions from '@/components/AdminInsuranceActions';
import { reviewIdCheck } from '../actions';

export const dynamic = 'force-dynamic';

const WHY: Record<string, string> = {
  not_read: 'Could not be read automatically. Look at it yourself.',
  not_an_id: 'Does not look like a government photo ID',
  blurry: 'Blurry, cropped or glare over the name or date',
  screen_photo: 'Looks like a photo of a screen or a printout',
  looks_edited: 'Text or photo may be edited',
  no_expiry: 'Expiry date could not be read',
  expired: 'Looks expired',
  name_close: 'Name on the ID is close to the account name, not exact',
  name_differs: 'Name on the ID differs from the account name',
};

export default async function IdChecks({ searchParams }: { searchParams: { all?: string } }) {
  const { db } = await requireAdmin();
  const all = searchParams.all === '1';
  let rows: any[] = [];
  try {
    let q = db.from('company_id_checks').select('*, companies(name)').order('created_at', { ascending: false }).limit(100);
    if (!all) q = q.eq('status', 'pending');
    rows = (await q).data ?? [];
  } catch { /* table not created yet */ }
  const owners = new Map<string, string>();
  if (rows.length) {
    const { data } = await db.from('profiles').select('id,full_name').in('id', rows.map((r: any) => r.user_id as string));
    for (const p of (data ?? []) as any[]) owners.set(p.id as string, (p.full_name as string) ?? '');
  }
  return (
    <>
      <h1>ID checks</h1>
      <p className="muted small">Owner only. The system reads the ID and tells you what to look at, but it never approves anything. You decide. Opening a photo is written to the audit log, and the photo is deleted when you approve or reject.</p>
      <div className="row">
        <a className={`btn ${all ? 'ghost' : ''}`} href="/admin/id-checks">To check</a>
        <a className={`btn ${all ? '' : 'ghost'}`} href="/admin/id-checks?all=1">All</a>
      </div>
      {rows.length === 0 && <div className="card"><p className="muted">{all ? 'No ID checks yet.' : 'Nothing waiting for a check.'}</p></div>}
      {rows.map((r: any) => {
        const good = r.status === 'pending' && (r.flags ?? []).length === 0 && r.name_match === 'match';
        return (
          <div className="card" key={r.id}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>{r.companies?.name ?? 'Company'}</b>
              <span className={`pill ${r.status === 'verified' ? 'ok' : r.status === 'rejected' ? 'bad' : good ? 'ok' : 'warn'}`}>{r.status === 'pending' ? (good ? 'Looks good' : 'Needs a look') : r.status}</span>
            </div>
            <p className="muted small" style={{ margin: 0 }}>Account owner: {owners.get(r.user_id) || 'no name'}</p>
            <p className="small" style={{ margin: 0 }}>Name read: <b>{r.read_name || 'not read'}</b> · Match: <b>{r.name_match}</b> · Expires: <b>{r.read_expires ?? 'not read'}</b></p>
            {(r.flags ?? []).length > 0 && <div className="box" style={{ background: 'var(--warn-bg)' }}>{(r.flags as string[]).map((x) => <div className="small" key={x}>• {WHY[x] ?? x}</div>)}</div>}
            {r.status === 'pending' && r.photo_path && <div className="row"><a className="btn ghost" href={`/admin/id-checks/file/${r.id}`} target="_blank" rel="noopener noreferrer">View photo (logged)</a></div>}
            {r.review_note ? <p className="small">Note: {r.review_note}</p> : null}
            {r.status === 'pending' && <AdminInsuranceActions id={r.id} review={reviewIdCheck} approve="verified" approveLabel="Approve, delete photo" />}
          </div>
        );
      })}
    </>
  );
}
