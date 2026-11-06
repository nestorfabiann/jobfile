import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { photoUrls, ago, type Post } from '@/lib/community';
import { nameMaps } from '@/lib/community';
import BeforeAfter from '@/components/BeforeAfter';
import { resolveHeld, reviewShowcase } from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminCommunity() {
  const { db } = await requireAdmin('reviews');
  let pending: Post[] = [];
  let held: Post[] = [];
  let hidden: any[] = [];
  let missing = false;
  try {
    pending = (((await db.from('community_posts').select('*').eq('status', 'pending_review').order('created_at')).data ?? []) as Post[]);
    held = (((await db.from('community_posts').select('*').eq('status', 'held').order('updated_at', { ascending: false }).limit(50)).data ?? []) as Post[]);
    hidden = ((await db.from('community_comments').select('*').eq('status', 'hidden').order('created_at', { ascending: false }).limit(50)).data ?? []) as any[];
  } catch { missing = true; }
  const [urls, names] = await Promise.all([
    photoUrls([...pending, ...held].flatMap((p) => [p.before_path, p.after_path, p.photo_path])),
    nameMaps([...pending, ...held].map((p) => p.author_id), [...pending, ...held].map((p) => p.company_id ?? '')),
  ]);
  const ctl = (type: 'post' | 'comment', id: string) => (
    <div className="row">
      {['restore', 'remove'].map((d) => (
        <form key={d} action={resolveHeld}><input type="hidden" name="target_type" value={type} /><input type="hidden" name="target_id" value={id} /><input type="hidden" name="decision" value={d} /><button className={d === 'restore' ? 'btn' : 'btn ghost'} type="submit">{d === 'restore' ? 'Put it back' : 'Remove for good'}</button></form>
      ))}
    </div>
  );
  return (
    <>
      <h1>Community review</h1>
      <p className="muted small">Projects were already agreed by both sides. Tips come straight from one person. Check the photos for faces, house numbers, license plates, and anything that shows an address or contact details. Approve only if it is safe to show.</p>
      {missing ? <div className="box warn">The Community tables are not created yet.</div> : null}

      <h2>Waiting for review ({pending.length})</h2>
      {pending.length === 0 && <div className="card"><p className="muted">Nothing waiting.</p></div>}
      {pending.map((p) => (
        <div className="card" key={p.id}>
          {p.before_path && p.after_path && urls.get(p.before_path) && urls.get(p.after_path) ? <BeforeAfter before={urls.get(p.before_path)!} after={urls.get(p.after_path)!} alt={p.title} /> : null}
          <b>{p.title}</b>
          {p.kind === 'tip'
            ? <span className="muted small"><b>Tip</b> · {names.company.get(p.company_id ?? '')?.name ?? names.person.get(p.author_id) ?? 'Someone'}{p.trade ? ` · ${p.trade}` : ''} · {ago(p.created_at)}</span>
            : <span className="muted small">{names.company.get(p.company_id ?? '')?.name ?? 'Company'} · {p.city}, TX · {p.trade}{p.days ? ` · ${p.days} days` : ''} · {ago(p.created_at)}</span>}
          {p.kind === 'tip' && p.photo_path && urls.get(p.photo_path) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urls.get(p.photo_path)!} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12 }} />
          ) : null}
          {p.body ? <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{p.body}</p> : null}
          <form action={reviewShowcase} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input type="hidden" name="post_id" value={p.id} />
            <label className="fld">Reason if you reject (the author sees it)<input name="reason" maxLength={300} placeholder="For example: a house number is visible in the after photo" /></label>
            <div className="row">
              <button className="btn" type="submit" name="decision" value="approve">Approve</button>
              <button className="btn ghost" type="submit" name="decision" value="reject">Reject</button>
            </div>
          </form>
        </div>
      ))}

      <h2>Hidden after reports ({held.length + hidden.length})</h2>
      {held.length + hidden.length === 0 && <div className="card"><p className="muted">Nothing hidden.</p></div>}
      {held.map((p) => (
        <div className="card" key={p.id}>
          <Link href={`/community/${p.id}`}><b>{p.title}</b></Link>
          <span className="muted small">{p.kind === 'idea' ? 'Question' : p.kind === 'tip' ? 'Tip' : 'Project'} by {names.company.get(p.company_id ?? '')?.name ?? names.person.get(p.author_id) ?? 'someone'}</span>
          {ctl('post', p.id)}
        </div>
      ))}
      {hidden.map((c) => (
        <div className="card" key={c.id}>
          <span className="small">Comment: “{String(c.body).slice(0, 200)}”</span>
          <Link className="small" href={`/community/${c.post_id}`}>Open the post</Link>
          {ctl('comment', c.id)}
        </div>
      ))}
    </>
  );
}
