import Link from 'next/link';
import HomeScreenCard from '@/components/HomeScreenCard';
import { PushCard } from '@/components/PushAlerts';
import TradeIcon from '@/components/TradeIcon';
import KitchenArt from '@/components/KitchenArt';
import InviteCard from '@/components/InviteCard';
import { createCompany } from '@/app/projects/actions';
import DraftDelete from '@/components/DraftDelete';
import { listingOpen, listingTitle, type Listing } from '@/lib/marketplace';
import type { Summary } from '@/lib/homeSummary';

type Proj = { id: string; name: string; address: string; created_at: string; completed_at: string | null; closeout_started_at: string | null };
type Stat = { n: number; lo: number; hi: number; fresh: number };
type Draft = { id: string; updated_at: string; data: { type: string; picks: string[]; zip?: string; details?: string; bmin?: string; bmax?: string } };

const TRADE_COLORS = ['#c4813f', '#1f4d3a', '#2f5f8a', '#7a4a6b', '#1d6f73', '#a2503a', '#6b7a2a', '#4a5568'];
const colorFor = (t: string) => TRADE_COLORS[Array.from(t).reduce((n, c) => n + c.charCodeAt(0), 0) % TRADE_COLORS.length];
/** How far along a draft is: five steps (kind of work is always done), and what is still missing, named for the person. */
function draftProgress(d: Draft['data']) {
  const miss: string[] = [];
  if (!d.picks.length) miss.push('choices');
  if (!(d.details ?? '').trim()) miss.push('details');
  if (!/^\d{5}$/.test(d.zip ?? '')) miss.push('your ZIP');
  if (!(d.bmin || d.bmax)) miss.push('a budget');
  const done = 5 - miss.length;
  return { done, pct: Math.round((done / 5) * 100), missing: miss.length ? `Add ${miss.slice(0, 2).join(' and ')}` : 'Ready to publish' };
}

const left = (l: Listing) => Math.max(0, Math.ceil((new Date(l.expires_at).getTime() - Date.now()) / 86400000));
const short = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' });

/** The homeowner's Projects page, ordered the way a homeowner thinks: needs you, waiting for bids, hired, completed. */
export default function HomeownerProjects(p: {
  needsName?: boolean;
  firstName: string;
  email: string;
  needsCard: React.ReactNode;
  zipCard: React.ReactNode;
  invites: React.ReactNode;
  alerts: React.ReactNode;
  error?: string;
  posted: Listing[];
  stats: Map<string, Stat>;
  drafts: Draft[];
  projects: Proj[];
  covers: Map<string, string>;
  summaries: Map<string, Summary>;
  rated: Set<string>;
  hasInvites: boolean;
}) {
  const waiting = p.posted.filter((l) => listingOpen(l));
  const ongoing = p.projects.filter((x) => !x.completed_at);
  const done = p.projects.filter((x) => x.completed_at);
  const first = !p.projects.length && !p.posted.length && !p.drafts.length && !p.hasInvites;

  const Thumb = ({ id }: { id: string }) =>
    p.covers.get(id) ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={p.covers.get(id)} alt="" width={64} height={64} style={{ borderRadius: 14, objectFit: 'cover', flex: 'none' }} />
    ) : (
      <KitchenArt />
    );

  return (
    <div className="cpage">
      <div className="stack">
        <h1>{first ? `Welcome${p.firstName ? `, ${p.firstName}` : ''}` : `Hi ${p.firstName || 'there'}`}</h1>
        <p className="muted">{first ? 'Tell us about your project and local contractors will send bids. It is free.' : 'Here is where your projects stand.'}</p>
        {p.needsName && <Link href="/settings" className="small" style={{ fontWeight: 700 }}>Add your name in Settings</Link>}
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <Link className="btn" href="/marketplace/new">{first ? 'Post your first project' : 'Post a project'}</Link>
        <Link className="btn ghost" href="/invites/new">I already have a contractor</Link>
        <p className="muted small" style={{ margin: 0, textAlign: 'center' }}>Hired someone on your own? Add them here to keep the agreement, photos, payments and messages in one place. They do not need a Jobfile account yet.</p>
      </div>

      {!first && <PushCard />}
      {p.error ? <div className="box bad">{p.error}</div> : null}
      {p.needsCard}
      {p.zipCard}
      {p.invites}

      {first && (
        <div className="card">
          <h2>How it works</h2>
          <p style={{ margin: 0 }}><b>1.</b> Tell us what you want done and add photos.</p>
          <p style={{ margin: 0 }}><b>2.</b> Local contractors send bids.</p>
          <p style={{ margin: 0 }}><b>3.</b> Pick one, sign the agreement, and track the work in one place.</p>
        </div>
      )}

      {ongoing.length > 0 && (
        <section className="stack" aria-label="Hired and ongoing">
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><h2>Hired and ongoing</h2><span className="muted small">{ongoing.length}</span></div>
          {ongoing.map((x) => {
            const s = p.summaries.get(x.id);
            return (
              <Link key={x.id} href={`/projects/${x.id}/overview`} className="card" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <Thumb id={x.id} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <b style={{ display: 'block', lineHeight: 1.3 }}>{x.name}</b>
                    {s?.contractor ? (
                      <span className="row" style={{ gap: 6, marginTop: 4, flexWrap: 'nowrap' }}>
                        <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'inline-grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flex: 'none' }}>{s.contractor.trim()[0]?.toUpperCase()}</span>
                        <span className="muted small" style={{ minWidth: 0 }}>{s.contractor}</span>
                      </span>
                    ) : <span className="muted small">{x.address || 'No address yet'}</span>}
                  </div>
                  <span aria-hidden="true">›</span>
                </div>
                {s && (
                  <>
                    <div className="bar" role="img" aria-label={`${s.pct} percent`}><span style={{ width: `${s.pct}%` }} /></div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className={`pill ${x.closeout_started_at ? 'warn' : 'ok'}`}>{s.stage}</span>
                      {s.payTotal > 0 && <span className="muted small">{s.payDone} of {s.payTotal} payments recorded</span>}
                    </div>
                    {s.next && (
                      <div style={{ borderRadius: 12, padding: '8px 10px', fontSize: 14, fontWeight: 600, lineHeight: 1.35, background: s.action ? 'var(--warn-bg, #fbeccd)' : 'var(--surface-2)', color: s.action ? 'var(--warn, #9a5b00)' : 'var(--ink-2)' }}>
                        Next: {s.next}
                      </div>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </section>
      )}

      {(waiting.length > 0 || p.drafts.length > 0) && (
        <section className="stack" aria-label="Waiting for bids">
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><h2>Waiting for bids</h2><span className="muted small">{waiting.length}</span></div>
          {p.drafts.map((d) => {
            const col = colorFor(d.data.type);
            const g = draftProgress(d.data);
            return (
              <div className="card" key={d.id} style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
                <div style={{ height: 5, background: col }} />
                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="row" style={{ gap: 12, flexWrap: 'nowrap', alignItems: 'center' }}>
                    <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 13, background: col, color: '#fff', display: 'grid', placeItems: 'center', flex: 'none' }}><TradeIcon trade={d.data.type} size={26} /></span>
                    <span style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 18, display: 'block' }}>{d.data.type}</b><span className="muted small">Saved {short(d.updated_at)}</span></span>
                    <span className="pill" style={{ background: `${col}22`, color: col, borderColor: 'transparent', fontWeight: 700 }}>Draft</span>
                  </div>
                  {d.data.picks.length ? (
                    <div className="row" style={{ gap: 6 }}>
                      {d.data.picks.slice(0, 3).map((x) => <span key={x} className="pill" style={{ background: 'var(--surface-2)' }}>{x}</span>)}
                      {d.data.picks.length > 3 ? <span className="pill" style={{ background: 'var(--surface-2)' }}>+{d.data.picks.length - 3} more</span> : null}
                    </div>
                  ) : null}
                  <div>
                    <div className="bar" role="img" aria-label={`${g.done} of 5 steps done`}><span style={{ width: `${g.pct}%`, background: col }} /></div>
                    <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}><span className="muted small">{g.done} of 5 steps</span><span className="muted small">{g.missing}</span></div>
                  </div>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Link className="btn" href={`/marketplace/new?draft=${d.id}`} style={{ flex: 1, background: col, borderColor: col, color: '#fff', textAlign: 'center' }}>{g.pct >= 80 ? 'Finish your post' : 'Keep going'}</Link>
                    <DraftDelete id={d.id} back="/projects" />
                  </div>
                </div>
              </div>
            );
          })}
          {waiting.map((l) => {
            const st = p.stats.get(l.id);
            return (
              <Link key={l.id} href={`/marketplace/${l.id}`} className="card" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <span aria-hidden="true" style={{ flex: 'none', width: 56, height: 56, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'var(--accent-soft, #f9efe4)', color: 'var(--accent)' }}><TradeIcon trade={l.job_type} size={28} /></span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <b style={{ display: 'block', lineHeight: 1.3 }}>{listingTitle(l)}</b>
                    <span className="muted small">ZIP {l.zip} · {left(l)} day{left(l) === 1 ? '' : 's'} left</span>
                  </div>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className={`pill ${st?.fresh ? 'warn' : ''}`}>{st ? `${st.n} bid${st.n === 1 ? '' : 's'}${st.fresh ? ` · ${st.fresh} new` : ''}` : 'No bids yet'}</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{st ? 'Compare bids ›' : 'View ›'}</span>
                </div>
              </Link>
            );
          })}
          <Link href="/projects?tab=posted" className="muted small">See all your posted jobs</Link>
        </section>
      )}

      {done.length > 0 && (
        <details className="card" aria-label="Completed" style={{ display: 'block', padding: '14px 16px' }}>
          <summary style={{ fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, listStyle: 'none', minHeight: 32 }}>
            <span aria-hidden="true" style={{ flex: 'none', width: 28, height: 28, borderRadius: '50%', background: 'var(--ok-bg, #d9f1e6)', color: 'var(--ok, #1f7a55)', display: 'grid', placeItems: 'center' }}>
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </span>
            <span style={{ flex: 1 }}>Completed</span>
            <span className="pill ok">{done.length}</span>
            <span aria-hidden="true" className="muted">›</span>
          </summary>
          <div className="stack" style={{ marginTop: 12 }}>
            {done.map((x) => (
              <div key={x.id} className="stack" style={{ gap: 8 }}>
                <Link href={`/projects/${x.id}/overview`} className="row" style={{ flexWrap: 'nowrap', textDecoration: 'none', color: 'var(--ink)' }}>
                  <Thumb id={x.id} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <b style={{ display: 'block', lineHeight: 1.3 }}>{x.name}</b>
                    <span className="muted small">{[x.address, x.completed_at ? `finished ${short(x.completed_at)}` : ''].filter(Boolean).join(' · ')}</span>
                  </div>
                  <span aria-hidden="true">›</span>
                </Link>
                {!p.rated.has(x.id) && (
                  <Link className="btn ghost" href={`/projects/${x.id}/rating`}>Rate your contractor</Link>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      {!first && (
        <InviteCard title="Happy with Jobfile?" body="Tell a neighbor. It is free." cta="Invite a friend" back="/projects" />
      )}

      {first && (
        <form action={createCompany} className="card">
          <h2>I&rsquo;m a contractor</h2>
          <p className="muted">Set up your company, then open a project and invite your customer.</p>
          <label className="fld">
            Company name
            <input name="name" required placeholder="Ridgeline Builders" autoComplete="organization" />
          </label>
          <div className="row"><button className="btn" type="submit">Create my company</button></div>
        </form>
      )}

      {p.alerts}

      {!first && <HomeScreenCard />}
    </div>
  );
}
