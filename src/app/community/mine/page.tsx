import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireMarketplace } from '@/lib/marketplace';
import { ago, nameMaps, photoUrls, postStats, STATUS_LABEL, type Post } from '@/lib/community';
import BeforeAfter from '@/components/BeforeAfter';
import CommunityCard from '@/components/CommunityCard';
import { removeMyPost, respondShowcase } from '../actions';

export const dynamic = 'force-dynamic';

export default async function Mine({ searchParams }: { searchParams: { error?: string; ok?: string } }) {
  requireMarketplace();
  const { user } = await requireUser();
  const db = supabaseAdmin();

  const [{ data: pms }, { data: cms }] = await Promise.all([
    db.from('project_members').select('project_id,role').eq('user_id', user.id),
    db.from('company_members').select('company_id').eq('user_id', user.id),
  ]);
  const contractor = (cms ?? []).length > 0;
  const side = new Map<string, string>(((pms ?? []) as any[]).map((m) => [m.project_id as string, m.role as string] as [string, string]));
  const cids = (cms ?? []).map((m: any) => m.company_id as string);
  if (cids.length) {
    const { data: ps } = await db.from('projects').select('id').in('company_id', cids);
    (ps ?? []).forEach((p: any) => { if (!side.has(p.id as string)) side.set(p.id as string, 'contractor'); });
  }

  let mine: Post[] = [];
  let waiting: Post[] = [];
  let saved: Post[] = [];
  let missing = false;
  try {
    mine = (((await db.from('community_posts').select('*').eq('author_id', user.id).neq('status', 'removed').order('created_at', { ascending: false }).limit(50)).data ?? []) as Post[]);
    const ids = Array.from(side.keys());
    if (ids.length) {
      const { data: w } = await db.from('community_posts').select('*').eq('status', 'pending_other').in('project_id', ids).neq('author_id', user.id).order('created_at');
      waiting = ((w ?? []) as Post[]).filter((p) => side.get(p.project_id as string) !== p.author_role);
    }
    const { data: sv } = await db.from('community_saves').select('post_id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    const sids = (sv ?? []).map((s: any) => s.post_id as string);
    if (sids.length) {
      const { data: sp } = await db.from('community_posts').select('*').in('id', sids).eq('status', 'live');
      const order = new Map<string, number>(sids.map((id: string, i: number) => [id, i] as [string, number]));
      saved = ((sp ?? []) as Post[]).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    }
  } catch { missing = true; }

  const everything = [...mine, ...waiting, ...saved];
  const [names, stats, urls] = await Promise.all([
    nameMaps(everything.map((p) => p.author_id), everything.map((p) => p.company_id ?? '')),
    postStats(saved.map((p) => p.id), user.id),
    photoUrls(everything.flatMap((p) => [p.before_path, p.after_path, p.photo_path])),
  ]);

  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Link href="/community" className="small">‹ Community</Link>
      <h1>My posts and saved</h1>
      {searchParams.error ? <div className="box bad" role="alert">{searchParams.error}</div> : null}
      {searchParams.ok ? <div className="box ok" role="status">{searchParams.ok}</div> : null}
      {missing ? <div className="box warn">Community needs one database step. Ask Jobfile support to run it.</div> : null}

      {waiting.length > 0 ? <h2>Waiting for your OK ({waiting.length})</h2> : null}
      {waiting.map((p) => (
        <div className="card" key={p.id}>
          {p.before_path && p.after_path && urls.get(p.before_path) && urls.get(p.after_path) ? <BeforeAfter before={urls.get(p.before_path)!} after={urls.get(p.after_path)!} alt={p.title} /> : null}
          <b>{p.title}</b>
          <span className="muted small">{p.author_role === 'contractor' ? `${names.company.get(p.company_id ?? '')?.name ?? 'Your contractor'} wants` : 'The homeowner wants'} to share this finished project. It shows only {p.city || 'the city'}, never the address or names.</span>
          {p.body ? <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{p.body}</p> : null}
          <div className="row">
            <form action={respondShowcase}><input type="hidden" name="post_id" value={p.id} /><input type="hidden" name="decision" value="approve" /><button className="btn" type="submit">Approve</button></form>
            <form action={respondShowcase}><input type="hidden" name="post_id" value={p.id} /><input type="hidden" name="decision" value="decline" /><button className="btn ghost" type="submit">Decline</button></form>
          </div>
        </div>
      ))}

      <h2>My posts</h2>
      {mine.length === 0 && !missing ? <div className="card"><p className="muted">You have not posted yet. Share a finished project{contractor ? ' to show your work' : ''}, or ask the community a question.</p><div className="row"><Link className="btn accent" href="/community/share">Share a project</Link><Link className="btn ghost" href="/community/ask">Ask for ideas</Link></div></div> : null}
      {mine.map((p) => (
        <div className="card" key={p.id}>
          <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
            <Link href={`/community/${p.id}`}><b>{p.title}</b></Link>
            <span className={`pill${p.status === 'live' ? ' ok' : p.status === 'rejected' || p.status === 'held' ? ' bad' : ''}`}>{p.status === 'live' ? 'Live' : p.status === 'pending_other' ? 'Waiting for approval' : p.status === 'pending_review' ? 'In review' : p.status === 'rejected' ? 'Not approved' : 'Hidden'}</span>
          </div>
          <span className="muted small">{p.kind === 'idea' ? 'Question' : 'Project'} · {STATUS_LABEL[p.status]} · {ago(p.created_at)}{p.reject_reason ? ` · ${p.reject_reason}` : ''}</span>
          <form action={removeMyPost}><input type="hidden" name="post_id" value={p.id} /><button className="btn ghost" type="submit">Remove</button></form>
        </div>
      ))}

      <h2>Saved</h2>
      {saved.length === 0 && !missing ? <div className="card"><p className="muted">Tap Save on a post to keep it here.</p></div> : null}
      {saved.map((p) => <CommunityCard key={p.id} p={p} urls={urls} names={names} stats={stats} contractor={contractor} />)}
    </div>
  );
}
