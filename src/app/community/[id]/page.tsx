import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { JOB_TYPES, requireMarketplace } from '@/lib/marketplace';
import { ago, costText, nameMaps, photoUrls, postStats, STATUS_LABEL, type Post } from '@/lib/community';
import BeforeAfter from '@/components/BeforeAfter';
import PostActions from '@/components/PostActions';
import IdeaPoll from '@/components/IdeaPoll';
import { authorLabel } from '@/components/CommunityCard';
import { addComment, deleteComment, removeMyPost, reportContent } from '../actions';

export const dynamic = 'force-dynamic';

export default async function CommunityPost({ params, searchParams }: { params: { id: string }; searchParams: { error?: string; ok?: string } }) {
  requireMarketplace();
  if (!/^[0-9a-f-]{36}$/.test(params.id)) notFound();
  const { user } = await requireUser();
  const db = supabaseAdmin();
  const { data: p } = await db.from('community_posts').select('*').eq('id', params.id).maybeSingle<Post>();
  if (!p) notFound();
  // Opening the post clears its reply alerts.
  try { await db.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).eq('path', `/community/${params.id}`).in('kind', ['community', 'community_note']).is('read_at', null); } catch { /* path column missing */ }
  const mine = p.author_id === user.id;
  if (p.status !== 'live' && !mine) {
    // The other side of a project can look at a post that is waiting for their approval.
    let ok = false;
    if (p.project_id && p.status === 'pending_other') {
      const { data: pm } = await db.from('project_members').select('role').eq('project_id', p.project_id).eq('user_id', user.id).maybeSingle();
      ok = !!pm;
    }
    if (!ok) notFound();
  }
  const live = p.status === 'live';
  const path = `/community/${p.id}`;
  const { data: mem } = await db.from('company_members').select('company_id').eq('user_id', user.id).limit(1);
  const contractor = (mem ?? []).length > 0;

  const { data: cs } = await db.from('community_comments').select('*').eq('post_id', p.id).eq('status', 'live').order('created_at').limit(200);
  const comments = (cs ?? []) as { id: string; author_id: string; company_id: string | null; body: string; created_at: string }[];
  const [names, stats, urls] = await Promise.all([
    nameMaps([p.author_id, ...comments.map((c) => c.author_id)], [p.company_id ?? '', ...comments.map((c) => c.company_id ?? '')]),
    postStats([p.id], user.id),
    photoUrls([p.before_path, p.after_path, p.photo_path]),
  ]);
  const before = p.before_path ? urls.get(p.before_path) : undefined;
  const after = p.after_path ? urls.get(p.after_path) : undefined;
  const photo = p.photo_path ? urls.get(p.photo_path) : undefined;
  const who = authorLabel(p, names);
  const co = p.company_id ? names.company.get(p.company_id) : undefined;

  let counts: number[] = [];
  let myVote: number | null = null;
  if (p.kind === 'idea' && p.poll.length) {
    const { data: vs } = await db.from('community_votes').select('user_id,option').eq('post_id', p.id).limit(20000);
    counts = p.poll.map((_, i) => ((vs ?? []) as any[]).filter((v) => v.option === i).length);
    const m = ((vs ?? []) as any[]).find((v) => v.user_id === user.id);
    myVote = m ? (m.option as number) : null;
  }
  const report = (type: 'post' | 'comment', id: string) => (
    <form action={reportContent} style={{ display: 'inline' }}>
      <input type="hidden" name="target_type" value={type} /><input type="hidden" name="target_id" value={id} /><input type="hidden" name="back" value={path} />
      <button type="submit" className="small" style={{ background: 'none', border: 0, color: 'var(--ink-2)', textDecoration: 'underline', cursor: 'pointer', padding: '10px 0', minHeight: 44 }}>Report</button>
    </form>
  );

  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Link href={p.kind === 'idea' ? '/community?k=idea' : '/community'} className="small">‹ Community</Link>
      {searchParams.error ? <div className="box bad" role="alert">{searchParams.error}</div> : null}
      {searchParams.ok ? <div className="box ok" role="status">{searchParams.ok}</div> : null}
      {!live ? <div className="box warn"><b>{STATUS_LABEL[p.status]}.</b>{p.reject_reason ? ` ${p.reject_reason}` : ''} Only you{mine ? '' : ' and the other side'} can see this.</div> : null}

      {p.kind === 'showcase' && before && after ? <BeforeAfter before={before} after={after} alt={p.title} /> : null}
      {p.kind === 'idea' && photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="cmphoto" style={{ borderRadius: 16 }} />
      ) : null}

      <div className="stack" style={{ gap: 6 }}>
        <h1 style={{ fontSize: 28 }}>{p.title}</h1>
        <span className="small">
          <b>{who}</b>
          {p.kind === 'idea' && p.author_role === 'contractor' ? <span className="pill ok" style={{ marginLeft: 6 }}>Pro</span> : null}
          {co?.verified && p.kind === 'showcase' ? <span className="pill ok" style={{ marginLeft: 6 }}>✓ Verified</span> : null}
          <span className="muted"> · {ago(p.created_at)}</span>
        </span>
      </div>

      {p.kind === 'showcase' ? (
        <div className="grid2" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div className="card"><span className="muted small">Where</span><b>{p.city ? `${p.city}, TX` : 'Texas'}</b></div>
          <div className="card"><span className="muted small">Kind of work</span><b>{p.trade || '—'}</b></div>
          <div className="card"><span className="muted small">Time</span><b>{p.days ? `${p.days} day${p.days > 1 ? 's' : ''}` : '—'}</b></div>
          <div className="card"><span className="muted small">Cost range</span><b>{costText(p) || 'Not shared'}</b></div>
        </div>
      ) : null}
      {p.body ? <p style={{ whiteSpace: 'pre-wrap' }}>{p.body}</p> : null}
      {p.kind === 'showcase' ? <div className="box ok"><b>Finished on Jobfile.</b> This project was completed and confirmed by both sides, and both agreed to share it. Names and addresses are never shown.</div> : null}
      {p.kind === 'idea' && p.poll.length ? <IdeaPoll postId={p.id} options={p.poll.map((o) => o.label)} counts={counts} mine={myVote} /> : null}

      {live ? <PostActions postId={p.id} title={p.title} liked={stats.liked.has(p.id)} likes={stats.likes.get(p.id) ?? 0} saved={stats.saved.has(p.id)} /> : null}

      {live && p.kind === 'showcase' && !contractor ? <Link className="btn accent" href={`/marketplace/new?like=${p.id}`}>Start a project like this</Link> : null}
      {live && p.kind === 'showcase' && p.company_id ? <Link className="btn ghost" href={`/contractors/${p.company_id}`}>View {co?.name ?? 'the contractor'}’s profile</Link> : null}
      {live && p.kind === 'idea' && mine && !contractor ? <Link className="btn accent" href={`/marketplace/new?like=${p.id}`}>Get bids for this</Link> : null}

      {live ? (
        <section id="comments" className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2>{p.kind === 'idea' ? 'Replies' : 'Comments'} ({comments.length})</h2>
          {comments.length === 0 ? <p className="muted small">{p.kind === 'idea' ? 'No replies yet. Be the first to help.' : 'No comments yet. Ask a question about the project.'}</p> : null}
          {comments.map((c) => {
            const cc = c.company_id ? names.company.get(c.company_id) : undefined;
            return (
              <div key={c.id} className="cmc">
                <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                  <span className="small"><b>{cc ? cc.name : names.person.get(c.author_id) ?? 'A neighbor'}</b>{cc ? <span className="pill ok" style={{ marginLeft: 6 }}>Pro</span> : null}<span className="muted"> · {ago(c.created_at)}</span></span>
                </div>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.body}</p>
                {c.author_id === user.id ? (
                  <form action={deleteComment}><input type="hidden" name="comment_id" value={c.id} /><button type="submit" className="small" style={{ background: 'none', border: 0, color: 'var(--ink-2)', textDecoration: 'underline', cursor: 'pointer', minHeight: 44 }}>Delete</button></form>
                ) : report('comment', c.id)}
              </div>
            );
          })}
          <form action={addComment} className="card" style={{ gap: 8 }}>
            <input type="hidden" name="post_id" value={p.id} />
            <label className="fld">{p.kind === 'idea' ? 'Your reply' : 'Add a comment'}<textarea name="body" rows={3} maxLength={500} required placeholder="Be kind and helpful. No phone numbers, emails or links." /></label>
            <button className="btn" type="submit">Post</button>
          </form>
        </section>
      ) : null}

      <div className="row" style={{ gap: 12, justifyContent: 'space-between' }}>
        {live && !mine ? report('post', p.id) : <span />}
        {mine && p.status !== 'removed' ? (
          <form action={removeMyPost}><input type="hidden" name="post_id" value={p.id} /><button type="submit" className="small" style={{ background: 'none', border: 0, color: 'var(--bad)', textDecoration: 'underline', cursor: 'pointer', minHeight: 44 }}>Remove my post</button></form>
        ) : null}
      </div>
    </div>
  );
}
