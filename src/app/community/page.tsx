import Link from 'next/link';
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
  const kind = searchParams.k === 'idea' ? 'idea' : 'showcase';
  const trade = JOB_TYPES[searchParams.t ?? ''] ? (searchParams.t as string) : '';
  const { data: mem } = await db.from('company_members').select('company_id').eq('user_id', user.id).limit(1);
  const contractor = (mem ?? []).length > 0;

  let posts: Post[] = [];
  let trades: string[] = [];
  let missing = false;
  try {
    let q = db.from('community_posts').select('*').eq('status', 'live').eq('kind', kind).order('created_at', { ascending: false }).limit(30);
    if (trade) q = q.eq('trade', trade);
    posts = ((await q).data ?? []) as Post[];
    const { data: ts } = await db.from('community_posts').select('trade').eq('status', 'live').eq('kind', kind).neq('trade', '').limit(500);
    trades = Array.from(new Set(((ts ?? []) as any[]).map((t) => t.trade as string))).sort();
  } catch { missing = true; }

  const [names, stats, urls] = await Promise.all([
    nameMaps(posts.map((p) => p.author_id), posts.map((p) => p.company_id ?? '')),
    postStats(posts.map((p) => p.id), user.id),
    photoUrls(posts.flatMap((p) => [p.before_path, p.after_path, p.photo_path])),
  ]);
  const href = (k: string, t = '') => `/community${k === 'idea' || t ? `?${[k === 'idea' ? 'k=idea' : '', t ? `t=${encodeURIComponent(t)}` : ''].filter(Boolean).join('&')}` : ''}`;

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
        <Link className="chip" href={href('showcase')}><span style={kind === 'showcase' ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } : undefined}>Projects</span></Link>
        <Link className="chip" href={href('idea')}><span style={kind === 'idea' ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } : undefined}>Ideas</span></Link>
      </div>
      {trades.length > 0 ? (
        <div className="chips" aria-label="Kind of work">
          <Link className="chip" href={href(kind)}><span style={!trade ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } : undefined}>All</span></Link>
          {trades.map((t) => <Link key={t} className="chip" href={href(kind, t)}><span style={trade === t ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } : undefined}>{t}</span></Link>)}
        </div>
      ) : null}

      {posts.length === 0 && !missing ? (
        <div className="card" style={{ alignItems: 'flex-start' }}>
          <h2>{kind === 'idea' ? 'No questions yet' : 'No projects shared yet'}</h2>
          <p className="muted">{kind === 'idea' ? 'Ask the first one. Pros and neighbors reply with ideas.' : 'Finished a project on Jobfile? Share the before and after, and be the first one here.'}</p>
          <Link className="btn accent" href={kind === 'idea' ? '/community/ask' : '/community/share'}>{kind === 'idea' ? 'Ask for ideas' : 'Share a finished project'}</Link>
        </div>
      ) : null}
      {posts.map((p) => <CommunityCard key={p.id} p={p} urls={urls} names={names} stats={stats} contractor={contractor} />)}
    </div>
  );
}
