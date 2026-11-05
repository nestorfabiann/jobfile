import Link from 'next/link';
import { cookies } from 'next/headers';
import CommunitySeen from '@/components/CommunitySeen';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { JOB_TYPES, requireMarketplace } from '@/lib/marketplace';
import { nameMaps, photoUrls, postStats, type Post } from '@/lib/community';
import CommunityCard from '@/components/CommunityCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Community · Jobfile' };

export default async function Community({ searchParams }: { searchParams: { k?: string; t?: string; error?: string; ok?: string } }) {
  requireMarketplace();
  const { user } = await requireUser();
  const db = supabaseAdmin();
  const kind: 'all' | 'idea' | 'showcase' = searchParams.k === 'idea' ? 'idea' : searchParams.k === 'showcase' ? 'showcase' : 'all';
  const trade = JOB_TYPES[searchParams.t ?? ''] ? (searchParams.t as string) : '';
  // When they last looked: a visit within 30 minutes of the last one keeps the same marker, so tags stay while they browse.
  const ck = cookies();
  const active = Number(ck.get('cm_active')?.value) || 0;
  const seen = Number(ck.get('cm_seen')?.value) || 0;
  const nowMs = Date.now();
  const since = active && nowMs - active > 30 * 60_000 ? active : seen || active || 0;
  const sinceIso = since ? new Date(since).toISOString() : '';
  const { data: mem } = await db.from('company_members').select('company_id').eq('user_id', user.id).limit(1);
  const contractor = (mem ?? []).length > 0;

  let posts: Post[] = [];
  let trades: string[] = [];
  let missing = false;
  const activeAt = new Map<string, number>();
  const freshReplies = new Map<string, number>();
  let newShow = 0, newIdeas = 0, newMine = 0;
  try {
    let q = db.from('community_posts').select('*').eq('status', 'live').order('created_at', { ascending: false }).limit(60);
    if (kind !== 'all') q = q.eq('kind', kind);
    if (trade) q = q.eq('trade', trade);
    posts = ((await q).data ?? []) as Post[];
    const { data: ts } = await db.from('community_posts').select('trade').eq('status', 'live').neq('trade', '').limit(500);
    trades = Array.from(new Set(((ts ?? []) as any[]).map((t) => t.trade as string))).sort();
    // Latest reply time per idea, so a lively question moves up, plus replies since the last visit.
    const ideaIds = posts.filter((p) => p.kind === 'idea').map((p) => p.id);
    if (ideaIds.length) {
      const { data: cs } = await db.from('community_comments').select('post_id,created_at,author_id').eq('status', 'live').in('post_id', ideaIds).order('created_at', { ascending: false }).limit(500);
      ((cs ?? []) as any[]).forEach((c) => {
        const t = new Date(c.created_at).getTime();
        if (!activeAt.has(c.post_id)) activeAt.set(c.post_id, t);
        if (since && t > since && c.author_id !== user.id) freshReplies.set(c.post_id, (freshReplies.get(c.post_id) ?? 0) + 1);
      });
    }
    if (since) {
      const [{ count: a }, { count: b }] = await Promise.all([
        db.from('community_posts').select('id', { count: 'exact', head: true }).eq('status', 'live').eq('kind', 'showcase').gt('created_at', sinceIso).neq('author_id', user.id),
        db.from('community_posts').select('id', { count: 'exact', head: true }).eq('status', 'live').eq('kind', 'idea').gt('created_at', sinceIso).neq('author_id', user.id),
      ]);
      newShow = a ?? 0; newIdeas = b ?? 0;
      const { data: mine } = await db.from('community_posts').select('id').eq('author_id', user.id).limit(200);
      const mineIds = ((mine ?? []) as any[]).map((m) => m.id as string);
      if (mineIds.length) {
        const { count: r } = await db.from('community_comments').select('id', { count: 'exact', head: true }).eq('status', 'live').in('post_id', mineIds).gt('created_at', sinceIso).neq('author_id', user.id);
        newMine = r ?? 0;
      }
    }
  } catch { missing = true; }
  const DAY = 24 * 3600_000;
  const stamp = (p: Post) => (p.kind === 'idea' ? Math.max(new Date(p.created_at).getTime(), activeAt.get(p.id) ?? 0) : new Date(p.created_at).getTime());
  posts = [...posts].sort((a, b) => stamp(b) - stamp(a)).slice(0, 30);
  const isNew = (p: Post) => !!since && p.author_id !== user.id && new Date(p.created_at).getTime() > since;
  const isActive = (p: Post) => p.kind === 'idea' && (activeAt.get(p.id) ?? 0) > nowMs - DAY && (activeAt.get(p.id) ?? 0) > new Date(p.created_at).getTime();

  const [names, stats, urls] = await Promise.all([
    nameMaps(posts.map((p) => p.author_id), posts.map((p) => p.company_id ?? '')),
    postStats(posts.map((p) => p.id), user.id),
    photoUrls(posts.flatMap((p) => [p.before_path, p.after_path, p.photo_path])),
  ]);
  const href = (k: string, t = '') => `/community${k !== 'all' || t ? `?${[k !== 'all' ? `k=${k}` : '', t ? `t=${encodeURIComponent(t)}` : ''].filter(Boolean).join('&')}` : ''}`;

  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="stack" style={{ gap: 4 }}>
        <h1>Community</h1>
        <p className="muted">Real projects from Texas homes, shared by the people who did them. Get ideas, ask questions, and share your own.</p>
      </div>
      {searchParams.error ? <div className="box bad" role="alert">{searchParams.error}</div> : null}
      {searchParams.ok ? <div className="box ok" role="status">{searchParams.ok}</div> : null}
      {missing ? <div className="box warn">Community needs one database step. Ask Jobfile support to run it.</div> : null}
      <div className="row" style={{ gap: 8 }}>
        <Link className="btn accent" href="/community/share">Share a finished project</Link>
        <Link className="btn ghost" href="/community/ask">Ask for ideas</Link>
        <Link className="btn ghost" href="/community/mine">My posts and saved</Link>
      </div>
      <div className="chips" aria-label="Show">
        <Link className="chip" href={href('all')}><span style={kind === 'all' ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } : undefined}>All</span></Link>
        <Link className="chip" href={href('showcase')}><span style={kind === 'showcase' ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } : undefined}>Projects{newShow ? ` · ${newShow} new` : ''}</span></Link>
        <Link className="chip" href={href('idea')}><span style={kind === 'idea' ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } : undefined}>Ideas{newIdeas ? ` · ${newIdeas} new` : ''}</span></Link>
      </div>
      {since && (newShow || newIdeas || newMine) ? (
        <div className="box" role="status" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <b>Since your last visit</b>
          {newShow || newIdeas ? <span className="small">{[newShow ? `${newShow} new project${newShow > 1 ? 's' : ''}` : '', newIdeas ? `${newIdeas} new idea${newIdeas > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')}</span> : null}
          {newMine ? <span className="small">{newMine} new repl{newMine > 1 ? 'ies' : 'y'} on your posts · <Link href="/community/mine">See them</Link></span> : null}
        </div>
      ) : null}
      <CommunitySeen since={since} />
      {trades.length > 0 ? (
        <div className="chips" aria-label="Kind of work">
          <Link className="chip" href={href(kind)}><span style={!trade ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } : undefined}>All</span></Link>
          {trades.map((t) => <Link key={t} className="chip" href={href(kind, t)}><span style={trade === t ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } : undefined}>{t}</span></Link>)}
        </div>
      ) : null}

      {posts.length === 0 && !missing ? (
        <div className="card" style={{ alignItems: 'flex-start' }}>
          <h2>{kind === 'idea' ? 'No questions yet' : kind === 'all' ? 'Nothing shared yet' : 'No projects shared yet'}</h2>
          <p className="muted">{kind === 'idea' ? 'Ask the first one. Pros and neighbors reply with ideas.' : 'Finished a project on Jobfile? Share the before and after, and be the first one here.'}</p>
          <Link className="btn accent" href={kind === 'idea' ? '/community/ask' : '/community/share'}>{kind === 'idea' ? 'Ask for ideas' : 'Share a finished project'}</Link>
        </div>
      ) : null}
      {posts.map((p) => <CommunityCard key={p.id} p={p} urls={urls} names={names} stats={stats} contractor={contractor} fresh={isNew(p)} active={isActive(p)} newReplies={freshReplies.get(p.id) ?? 0} />)}
    </div>
  );
}
