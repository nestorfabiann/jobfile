import Link from 'next/link';
import { cookies } from 'next/headers';
import CommunitySeen from '@/components/CommunitySeen';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { JOB_TYPES, requireMarketplace } from '@/lib/marketplace';
import { nameMaps, photoUrls, postStats, type Post } from '@/lib/community';
import CommunityCard from '@/components/CommunityCard';
import TradeIcon from '@/components/TradeIcon';

const Ico = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
const ICON = {
  cam: 'M3 9a3 3 0 013-3h1.5L9 4h6l1.5 2H18a3 3 0 013 3v8a3 3 0 01-3 3H6a3 3 0 01-3-3zM12 16.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
  tip: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0012 3z',
  mark: 'M6 3h12v18l-6-4-6 4z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
};

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Community · Jobfile' };

export default async function Community({ searchParams }: { searchParams: { k?: string; t?: string; error?: string; ok?: string } }) {
  requireMarketplace();
  const { user } = await requireUser();
  const db = supabaseAdmin();
  const kind: 'all' | 'idea' | 'showcase' | 'tip' = searchParams.k === 'idea' ? 'idea' : searchParams.k === 'tip' ? 'tip' : searchParams.k === 'showcase' ? 'showcase' : 'all';
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
  let newShow = 0, newIdeas = 0, newTips = 0, newMine = 0;
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
      const { count: t } = await db.from('community_posts').select('id', { count: 'exact', head: true }).eq('status', 'live').eq('kind', 'tip').gt('created_at', sinceIso).neq('author_id', user.id);
      newTips = t ?? 0;
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

  const todayCount = posts.filter((p) => nowMs - new Date(p.created_at).getTime() < 24 * 3600_000).length;
  const chipOn = { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } as const;
  const Chip = ({ to, on, icon, label, n }: { to: string; on: boolean; icon: string; label: string; n?: number }) => (
    <Link className="chip" href={to}><span className="cmchip" style={on ? chipOn : undefined}><Ico d={icon} />{label}{n ? <em className="cmn">{n}</em> : null}</span></Link>
  );

  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <section className="cmhero" aria-label="Community">
        {todayCount > 0 ? <span className="cmlive"><i />{todayCount} new today</span> : null}
        <h1>Community</h1>
        <p>Real Texas projects and ideas, shared by the people who did them.</p>
      </section>
      {searchParams.error ? <div className="box bad" role="alert">{searchParams.error}</div> : null}
      {searchParams.ok ? <div className="box ok" role="status">{searchParams.ok}</div> : null}
      {missing ? <div className="box warn">Community needs one database step. Ask Jobfile support to run it.</div> : null}
      <div className="cmtiles">
        <Link className="cmtile main" href="/community/share"><Ico d={ICON.cam} />Share a project</Link>
        <Link className="cmtile" href="/community/ask"><Ico d={ICON.bulb} />Ask for ideas</Link>
        <Link className="cmtile" href="/community/tip"><Ico d={ICON.tip} />Share a tip</Link>
        <Link className="cmtile" href="/community/mine"><Ico d={ICON.mark} />Mine and saved</Link>
      </div>
      <div className="chips" aria-label="Show">
        <Chip to={href('all')} on={kind === 'all'} icon={ICON.grid} label="All" />
        <Chip to={href('showcase')} on={kind === 'showcase'} icon={ICON.home} label="Projects" n={newShow} />
        <Chip to={href('idea')} on={kind === 'idea'} icon={ICON.bulb} label="Ideas" n={newIdeas} />
        <Chip to={href('tip')} on={kind === 'tip'} icon={ICON.tip} label="Tips" n={newTips} />
      </div>
      {since && (newShow || newIdeas || newTips || newMine) ? (
        <div className="box" role="status" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <b>Since your last visit</b>
          {newShow || newIdeas || newTips ? <span className="small">{[newShow ? `${newShow} new project${newShow > 1 ? 's' : ''}` : '', newIdeas ? `${newIdeas} new idea${newIdeas > 1 ? 's' : ''}` : '', newTips ? `${newTips} new tip${newTips > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')}</span> : null}
          {newMine ? <span className="small">{newMine} new repl{newMine > 1 ? 'ies' : 'y'} on your posts · <Link href="/community/mine">See them</Link></span> : null}
        </div>
      ) : null}
      <CommunitySeen since={since} />
      {trades.length > 0 ? (
        <div className="chips cmscroll" aria-label="Kind of work">
          <Link className="chip" href={href(kind)}><span className="cmchip" style={!trade ? chipOn : undefined}>All trades</span></Link>
          {trades.map((t) => <Link key={t} className="chip" href={href(kind, t)}><span className="cmchip" style={trade === t ? chipOn : undefined}><TradeIcon trade={t} size={15} />{t}</span></Link>)}
        </div>
      ) : null}

      {posts.length === 0 && !missing ? (
        <div className="card" style={{ alignItems: 'flex-start' }}>
          <h2>{kind === 'tip' ? 'No tips yet' : kind === 'idea' ? 'No questions yet' : kind === 'all' ? 'Nothing shared yet' : 'No projects shared yet'}</h2>
          <p className="muted">{kind === 'tip' ? 'Know a trick that saves time or money? Share the first tip.' : kind === 'idea' ? 'Ask the first one. Pros and neighbors reply with ideas.' : 'Finished a project on Jobfile? Share the before and after, and be the first one here.'}</p>
          <Link className="btn accent" href={kind === 'tip' ? '/community/tip' : kind === 'idea' ? '/community/ask' : '/community/share'}>{kind === 'tip' ? 'Share a tip' : kind === 'idea' ? 'Ask for ideas' : 'Share a finished project'}</Link>
        </div>
      ) : null}
      {posts.map((p) => <CommunityCard key={p.id} p={p} urls={urls} names={names} stats={stats} contractor={contractor} fresh={isNew(p)} active={isActive(p)} newReplies={freshReplies.get(p.id) ?? 0} />)}
    </div>
  );
}
