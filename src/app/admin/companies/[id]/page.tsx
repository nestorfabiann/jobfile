import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin';
import { signedUrls } from '@/lib/companyProfile';
import { EditForm, ActionRow, NoteForm } from '@/components/AdminProfileForms';
import { addNote, editCompany, moveOwner, removeLogo, removePhoto, setHidden, setVerified } from '../../profileActions';

export const dynamic = 'force-dynamic';

export default async function AdminCompany({ params }: { params: { id: string } }) {
  const { db } = await requireAdmin();
  const { data: c } = await db.from('companies').select('*').eq('id', params.id).maybeSingle<any>();
  if (!c) notFound();
  const [{ data: mem }, { data: photos }, { data: notes }, { data: ins }] = await Promise.all([
    db.from('company_members').select('user_id,role').eq('company_id', c.id),
    db.from('company_photos').select('id,path,caption').eq('company_id', c.id).order('created_at', { ascending: false }).limit(30),
    db.from('admin_notes').select('id,body,author_email,created_at').eq('subject_type', 'company').eq('subject_id', c.id).order('created_at', { ascending: false }).limit(50),
    db.from('company_insurance').select('status,expires_on').eq('company_id', c.id),
  ]);
  const ids = (mem ?? []).map((m: any) => m.user_id as string);
  const { data: people } = ids.length ? await db.from('profiles').select('id,email,full_name').in('id', ids) : { data: [] as any[] };
  const who = new Map((people ?? []).map((p: any) => [p.id, p]));
  const owner = (mem ?? []).find((m: any) => m.role === 'owner') as any;
  const urls = await signedUrls('company-photos', (photos ?? []).map((p: any) => p.path as string));
  const insured = (ins ?? []).some((i: any) => i.status === 'approved' && (!i.expires_on || new Date(i.expires_on) > new Date()));
  const staffOptions = (mem ?? []).filter((m: any) => m.role !== 'owner');
  const hid = { company_id: c.id };

  return (
    <>
      <h1>{c.name}</h1>
      <div className="card">
        <div className="row">
          {c.hidden_at ? <span className="pill bad">hidden</span> : <span className="pill ok">listed</span>}
          {insured ? <span className="pill ok">insured</span> : <span className="pill">no current insurance</span>}
          {c.verified_at ? <span className="pill ok">verified</span> : <span className="pill warn">not verified</span>}
        </div>
        <div className="small muted">
          Owner: {owner ? <Link href={`/admin/users/${owner.user_id}`}>{who.get(owner.user_id)?.email ?? owner.user_id}</Link> : 'none'} · {Math.max(0, (mem ?? []).length - 1)} staff
        </div>
        {c.hidden_at && <div className="small">Hidden because: {c.hidden_reason || '—'}</div>}
      </div>

      <h2>Business profile</h2>
      <div className="card">
        <EditForm
          title={c.name}
          action={editCompany}
          hidden={hid}
          fields={[
            { name: 'name', label: 'Business name', value: c.name ?? '' },
            { name: 'about', label: 'About', value: c.about ?? '', textarea: true },
            { name: 'trades', label: 'Trades', value: (c.trades ?? []).join(', '), hint: 'Comma separated, for example: Painting, Drywall and carpentry' },
            { name: 'business_zip', label: 'Business ZIP', value: c.business_zip ?? '', inputMode: 'numeric' },
            { name: 'service_radius_mi', label: 'Service radius (miles)', value: c.service_radius_mi != null ? String(c.service_radius_mi) : '', inputMode: 'numeric' },
          ]}
        />
      </div>

      <h2>Actions</h2>
      <div className="card">
        <ActionRow label={c.verified_at ? 'Remove verified mark' : 'Mark as verified'} desc={c.verified_at ? 'Takes the "Verified by Jobfile" badge off.' : 'Adds a "Verified by Jobfile" badge after you check the license and insurance.'} button={c.verified_at ? 'Remove' : 'Verify'} action={setVerified} hidden={hid} />
        <ActionRow label={c.hidden_at ? 'Show in the marketplace again' : 'Hide from the marketplace'} desc="Hidden businesses are not listed, get no job alerts and cannot place new bids. Open projects with them stay as they are." button={c.hidden_at ? 'Show' : 'Hide'} danger={!c.hidden_at} tell action={setHidden} hidden={hid} />
        {c.logo_path ? <ActionRow label="Remove the logo" desc="For an image that breaks the rules." button="Remove" danger tell action={removeLogo} hidden={hid} /> : null}
        {staffOptions.length > 0 && (
          <ActionRow label="Move ownership" desc="Makes another person at this company the owner." button="Move" action={moveOwner} hidden={hid}
            extra={<label className="fld">New owner<select name="new_owner" defaultValue="">{<option value="" disabled>Choose…</option>}{staffOptions.map((m: any) => <option key={m.user_id} value={m.user_id}>{who.get(m.user_id)?.email ?? m.user_id}</option>)}</select></label>} />
        )}
      </div>

      {(photos ?? []).length > 0 && (
        <>
          <h2>Work photos</h2>
          {(photos ?? []).map((p: any) => (
            <div className="card" key={p.id}>
              {urls.get(p.path) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urls.get(p.path)} alt={p.caption || 'Work photo'} style={{ maxWidth: '100%', borderRadius: 12 }} />
              ) : null}
              <span className="muted small">{p.caption || 'No caption'}</span>
              <ActionRow label="Remove this photo" desc="For an image that breaks the rules." button="Remove" danger tell action={removePhoto} hidden={{ ...hid, photo_id: p.id }} />
            </div>
          ))}
        </>
      )}

      <h2>Private notes</h2>
      <div className="card">
        <p className="small muted" style={{ margin: 0 }}>Only admins see these. They are never shown to the business.</p>
        {(notes ?? []).map((n: any) => (
          <div key={n.id} className="box" style={{ background: 'var(--surface-2)' }}><b>{new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {n.author_email}:</b> {n.body}</div>
        ))}
        <NoteForm type="company" id={c.id} action={addNote} />
      </div>
      <p><Link href="/admin/users">Back to users</Link></p>
    </>
  );
}
