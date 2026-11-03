import Link from 'next/link';
import TradeIcon from '@/components/TradeIcon';
import KitchenArt from '@/components/KitchenArt';
import InviteCard from '@/components/InviteCard';
import { createCompany } from '@/app/projects/actions';
import { listingOpen, listingTitle, type Listing } from '@/lib/marketplace';
import type { Summary } from '@/lib/homeSummary';

type Proj = { id: string; name: string; address: string; created_at: string; completed_at: string | null; closeout_started_at: string | null };
type Stat = { n: number; lo: number; hi: number; fresh: number };
type Draft = { id: string; updated_at: string; data: { type: string; picks: string[]; zip?: string } };

const left = (l: Listing) => Math.max(0, Math.ceil((new Date(l.expires_at).getTime() - Date.now()) / 86400000));
const short = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' });

/** The homeowner's Projects page, ordered the way a homeowner thinks: needs you, waiting for bids, hired, completed. */
export default function HomeownerProjects(p: {
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
    <>
      <div className="stack">
        <h1>{first ? `Welcome${p.firstName ? `, ${p.firstName}` : ''}` : `Hi${p.firstName ? ` ${p.firstName}` : ''}`}</h1>
        <p className="muted">{first ? 'Tell us about your project and local contractors will send bids. It is free.' : 'Here is where your projects stand.'}</p>
      </div>

      <div className="stack" style={{ gap: 4 }}>
        <Link className="btn" href="/marketplace/new">{first ? 'Post your first project' : 'Post a project'}</Link>
        <Link href="/invites/new" style={{ fontWeight: 700, padding: '10px 0', display: 'inline-block' }}>I already have a contractor</Link>
      </div>

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

      {(waiting.length > 0 || p.drafts.length > 0) && (
        <section className="stack" aria-label="Waiting for bids">
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><h2>Waiting for bids</h2><span className="muted small">{waiting.length}</span></div>
          {p.drafts.map((d) => (
            <div className="card" key={d.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="pill warn">Draft</span><span className="muted small">Saved {short(d.updated_at)}</span></div>
              <b>{d.data.type}{d.data.picks.length ? ` · ${d.data.picks.length} choice${d.data.picks.length === 1 ? '' : 's'} picked` : ''}</b>
              <span className="muted small">Not visible to contractors until you publish</span>
              <Link className="btn ghost" href={`/marketplace/new?draft=${d.id}`}>Continue your post</Link>
            </div>
          ))}
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

      {done.length > 0 && (
        <details className="card" aria-label="Completed">
          <summary style={{ fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>Completed</span><span className="muted small">{done.length}</span></summary>
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
    </>
  );
}
