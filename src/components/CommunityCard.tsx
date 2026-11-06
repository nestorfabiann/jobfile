import Link from 'next/link';
import BeforeAfter from '@/components/BeforeAfter';
import PostActions from '@/components/PostActions';
import { ago, costText, type Post } from '@/lib/community';

type Names = { person: Map<string, string>; company: Map<string, { name: string; verified: boolean }> };
type Stats = { likes: Map<string, number>; comments: Map<string, number>; votes: Map<string, number>; liked: Set<string>; saved: Set<string> };

export const authorLabel = (p: Post, n: Names) => (p.kind === 'showcase' || p.author_role === 'contractor') && p.company_id && n.company.get(p.company_id) ? n.company.get(p.company_id)!.name : n.person.get(p.author_id) ?? 'A neighbor';

/** One post in the feed: a showcase with its before and after, or a question people can answer. */
export default function CommunityCard({ p, urls, names, stats, contractor, fresh = false, active = false, newReplies = 0 }: { p: Post; urls: Map<string, string>; names: Names; stats: Stats; contractor: boolean; fresh?: boolean; active?: boolean; newReplies?: number }) {
  const who = authorLabel(p, names);
  const pro = p.author_role === 'contractor' && !!p.company_id;
  const before = p.before_path ? urls.get(p.before_path) : undefined;
  const after = p.after_path ? urls.get(p.after_path) : undefined;
  const photo = p.photo_path ? urls.get(p.photo_path) : undefined;
  const meta = [p.city ? `${p.city}, TX` : '', p.days ? `${p.days} day${p.days > 1 ? 's' : ''}` : '', costText(p)].filter(Boolean).join(' · ');
  return (
    <article className="card cmcard">
      {p.kind === 'showcase' && before && after ? <BeforeAfter before={before} after={after} alt={p.title} /> : null}
      {(p.kind === 'idea' || p.kind === 'tip') && photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="cmphoto" />
      ) : null}
      <div className="cmpad">
        <div className="row" style={{ justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
          <Link href={`/community/${p.id}`} className="cmtitle" style={{ minWidth: 0 }}>{p.title}</Link>
          {fresh ? <span className="pill" style={{ background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' }}>New</span> : active ? <span className="pill ok">Active now</span> : null}
        </div>
        <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
          <span className="small" style={{ minWidth: 0 }}><b>{who}</b>{pro && p.kind !== 'showcase' ? <span className="pill ok" style={{ marginLeft: 6 }}>Pro</span> : null}<br /><span className="muted">{meta || ago(p.created_at)}</span></span>
          {p.kind === 'showcase' ? <span className="pill ok">✓ Finished on Jobfile</span> : null}
        </div>
        {p.kind === 'tip' ? <span className="row" style={{ gap: 6 }}><span className="pill ok">{pro ? 'Pro tip' : 'Homeowner tip'}</span>{p.trade ? <span className="pill">{p.trade}</span> : null}</span> : null}
        {p.kind === 'tip' && p.body ? <p className="small" style={{ margin: 0, overflowWrap: 'anywhere' }}>{p.body.length > 140 ? `${p.body.slice(0, 140)}…` : p.body}</p> : null}
        {p.kind === 'idea' ? <span className="small muted">{p.poll.length ? `${stats.votes.get(p.id) ?? 0} votes · ` : ''}{stats.comments.get(p.id) ?? 0} repl{(stats.comments.get(p.id) ?? 0) === 1 ? 'y' : 'ies'} · {ago(p.created_at)}</span> : null}
        {newReplies > 0 ? <span className="small"><b>{newReplies} new repl{newReplies > 1 ? 'ies' : 'y'} since your last visit</b></span> : null}
        <PostActions postId={p.id} title={p.title} liked={stats.liked.has(p.id)} likes={stats.likes.get(p.id) ?? 0} saved={stats.saved.has(p.id)} helpful={p.kind === 'tip'} />
        {p.kind === 'showcase' ? (
          contractor
            ? <Link className="btn ghost" href={`/community/${p.id}`}>See the details</Link>
            : <Link className="btn accent" href={`/marketplace/new?like=${p.id}`}>Start a project like this</Link>
        ) : <Link className="btn ghost" href={`/community/${p.id}`}>{p.kind === 'tip' ? 'Read the tip' : p.poll.length ? 'Vote and reply' : 'Read and reply'}</Link>}
      </div>
    </article>
  );
}
