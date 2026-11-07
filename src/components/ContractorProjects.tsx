import GroupTabs from '@/components/GroupTabs';
import Link from 'next/link';
import HomeScreenCard from '@/components/HomeScreenCard';
import { PushCard } from '@/components/PushAlerts';
import KitchenArt from '@/components/KitchenArt';
import StartProjectForm from '@/components/StartProjectForm';
import { withdrawBid } from '@/app/marketplace/actions';
import InviteCard from '@/components/InviteCard';
import { dollars } from '@/lib/money';
import AvailabilityBar from '@/components/AvailabilityBar';
import { listingTitle, type Listing } from '@/lib/marketplace';
import type { Summary } from '@/lib/homeSummary';

type Proj = { id: string; name: string; address: string; homeowner_name: string; completed_at: string | null; closeout_started_at: string | null };
export type BidRow = { id: string; price_cents: number; created_at: string; listing: Listing; view: { tone: 'none' | 'seen' | 'hot'; text: string } };

const short = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' });

/** The contractor's Projects page: needs you, ongoing work, bids, money, completed. */
export default function ContractorProjects(p: {
  firstName: string;
  availability: { availability?: string | null; booked_until?: string | null };
  companyId: string;
  companyName: string;
  needsCard: React.ReactNode;
  invites: React.ReactNode;
  alerts: React.ReactNode;
  error?: string;
  projects: Proj[];
  covers: Map<string, string>;
  summaries: Map<string, Summary>;
  bids: BidRow[];
  waitingCount: number;
  collected: number;
  toCollect: number;
  doneStats: Record<string, { billed: number; rating: number | null; comment: string }>;
  hasInvites: boolean;
}) {
  const ongoing = p.projects.filter((x) => !x.completed_at);
  const done = p.projects.filter((x) => x.completed_at);
  const billed = done.reduce((t, x) => t + (p.doneStats[x.id]?.billed ?? 0), 0);
  const rated = done.map((x) => p.doneStats[x.id]?.rating).filter((r): r is number => !!r);
  const avg = rated.length ? rated.reduce((t, r) => t + r, 0) / rated.length : 0;
  const first = !p.projects.length && !p.bids.length && !p.hasInvites;

  const Thumb = ({ id }: { id: string }) =>
    p.covers.get(id) ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={p.covers.get(id)} alt="" width={64} height={64} style={{ borderRadius: 14, objectFit: 'cover', flex: 'none' }} />
    ) : (
      <KitchenArt />
    );

  const DoneCard = ({ x }: { x: Proj }) => {
    const st = p.doneStats[x.id];
    return (
      <Link href={`/projects/${x.id}/overview`} className="card" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <Thumb id={x.id} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <b style={{ display: 'block', lineHeight: 1.3 }}>{x.name}</b>
            <span className="muted small">{[x.homeowner_name, x.address].filter(Boolean).join(' · ') || 'No address'}</span>
          </div>
          <span aria-hidden="true">›</span>
        </div>
        <div className="bar" role="img" aria-label="100 percent"><span style={{ width: '100%', background: 'var(--ok, #1f7a55)' }} /></div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="pill ok">Completed {x.completed_at ? short(x.completed_at) : ''}</span>
          {st && st.billed > 0 && <span className="muted small">{dollars(st.billed)} billed</span>}
        </div>
        {st?.rating ? (
          <div style={{ fontSize: 14 }}><span aria-label={`${st.rating} stars`} style={{ color: 'var(--accent)' }}>{'★'.repeat(st.rating)}{'☆'.repeat(5 - st.rating)}</span>{st.comment ? <span className="muted small"> &ldquo;{st.comment.length > 70 ? `${st.comment.slice(0, 70)}…` : st.comment}&rdquo;</span> : null}</div>
        ) : null}
      </Link>
    );
  };

  const ongoingPanel = (
        <section className="stack" id="ongoing" aria-label="Ongoing projects">
          {ongoing.map((x) => {
            const s = p.summaries.get(x.id);
            return (
              <Link key={x.id} href={`/projects/${x.id}/overview`} className="card" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <Thumb id={x.id} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <b style={{ display: 'block', lineHeight: 1.3 }}>{x.name}</b>
                    <span className="muted small">{[x.homeowner_name, x.address].filter(Boolean).join(' · ') || 'No address yet'}</span>
                  </div>
                  <span aria-hidden="true">›</span>
                </div>
                {s && (
                  <>
                    <div className="bar" role="img" aria-label={`${s.pct} percent`}><span style={{ width: `${s.pct}%` }} /></div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className={`pill ${x.closeout_started_at || s.stage === 'Agreement' ? 'warn' : 'ok'}`}>{s.stage}</span>
                      {s.paidText && <span className="muted small">{s.paidText}</span>}
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
  );
  const bidsPanel = (
        <section className="stack" id="bids" aria-label="Your bids">
          {p.bids.map((b) => (
            <div key={b.id} className="card">
              <Link href={`/marketplace/${b.listing.id}`} style={{ textDecoration: 'none', color: 'var(--ink)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <b style={{ lineHeight: 1.3 }}>{listingTitle(b.listing)}</b>
                <span className="muted small">ZIP {b.listing.zip} · your bid {dollars(b.price_cents)}</span>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className={`pill ${b.view.tone === 'none' ? '' : 'ok'}`}>{b.view.tone === 'none' ? 'Waiting' : b.view.text}</span>
                  <span className="muted small">Sent {short(b.created_at)}</span>
                </div>
              </Link>
              <details className="wd">
                <summary>Withdraw bid</summary>
                <form action={withdrawBid} className="stack" style={{ gap: 8 }}>
                  <input type="hidden" name="listing_id" value={b.listing.id} />
                  <input type="hidden" name="return_to" value="/projects" />
                  <p className="muted small" style={{ margin: 0 }}>The homeowner is told you withdrew. You can bid again while the job is still open.</p>
                  <div className="row"><button className="btn ghost" type="submit">Yes, withdraw my bid</button></div>
                </form>
              </details>
            </div>
          ))}
          <Link href="/marketplace/bids" style={{ fontWeight: 700 }}>See all bids ›</Link>
        </section>
  );
  const donePanel = (
        <section className="stack" id="done" aria-label="Completed projects">
          {done.length === 0 ? (
            <div className="card" style={{ alignItems: 'center', textAlign: 'center', borderStyle: 'dashed' }}>
              <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--ok-bg, #d9f1e6)', color: 'var(--ok, #1f7a55)', display: 'grid', placeItems: 'center' }}>
                <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              </span>
              <b>Nothing finished yet</b>
              <p className="muted" style={{ margin: 0 }}>Jobs you finish show here, with what you billed and the rating each homeowner gives you.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', background: 'var(--ok-bg, #d9f1e6)', borderRadius: 20, padding: '14px 8px', textAlign: 'center' }}>
                <div><b style={{ display: 'block', fontSize: 22, color: 'var(--ok, #1f7a55)' }}>{done.length}</b><span className="muted small">Jobs done</span></div>
                <div><b style={{ display: 'block', fontSize: 22, color: 'var(--ok, #1f7a55)' }}>{dollars(billed)}</b><span className="muted small">Billed</span></div>
                <div><b style={{ display: 'block', fontSize: 22, color: 'var(--ok, #1f7a55)' }}>{avg ? `${avg.toFixed(1)} ★` : '–'}</b><span className="muted small">{avg ? 'Avg rating' : 'No ratings yet'}</span></div>
              </div>
              {done.slice(0, 3).map((x) => <DoneCard key={x.id} x={x} />)}
              {done.length > 3 && (
                <details>
                  <summary className="btn ghost" style={{ cursor: 'pointer', listStyle: 'none', textAlign: 'center' }}>See all completed ({done.length})</summary>
                  <div className="stack" style={{ marginTop: 12 }}>{done.slice(3).map((x) => <DoneCard key={x.id} x={x} />)}</div>
                </details>
              )}
            </>
          )}
        </section>
  );

  return (
    <div className="cpage">
      <div className="stack" style={{ gap: 8 }}>
        <h1>{first ? `Welcome${p.firstName ? `, ${p.firstName}` : ''}` : `Hi ${p.firstName || 'there'}`}</h1>
        <p className="muted">{first ? 'Find jobs near you, bid on them, and run the work without the paperwork. It is free.' : `${p.companyName} · here is your work at a glance.`}</p>
      </div>

      <AvailabilityBar company={p.availability} />

      {p.error ? <div className="box bad">{p.error}</div> : null}
      {p.needsCard}
      {p.invites}

      <div className="startp-row">
        <Link className="ptile pri" href="/marketplace">
          <span className="pti" aria-hidden="true">&#128269;</span>
          <b>Find work</b>
          <span>Homeowners near you.</span>
        </Link>
        <StartProjectForm companyId={p.companyId} companyName={p.companyName} open={!!p.error} ghost />
      </div>

      {first && (
        <div className="card">
          <h2>Get started</h2>
          <p style={{ margin: 0 }}><b>1.</b> Finish your business profile so homeowners trust your bids.</p>
          <p style={{ margin: 0 }}><b>2.</b> Look through jobs near you and send a bid.</p>
          <p style={{ margin: 0 }}><b>3.</b> Got a customer already? Start a project and invite them.</p>
          <Link className="btn ghost" href="/settings/business">Finish my business profile</Link>
        </div>
      )}

      {!first && (ongoing.length > 0 || p.bids.length > 0 || done.length > 0) && (
        <GroupTabs
          initial={ongoing.length > 0 ? 'ongoing' : p.bids.length > 0 ? 'bids' : 'completed'}
          tabs={[
            { key: 'ongoing', label: 'Ongoing', count: ongoing.length, panel: ongoingPanel, empty: 'No hired projects yet. Win a bid and the project shows here.' },
            { key: 'bids', label: 'Bids', count: p.bids.length, panel: bidsPanel, empty: 'No open bids. Find work near you and send a bid.' },
            { key: 'completed', label: 'Completed', count: done.length, panel: donePanel, empty: 'Finished jobs show here.' },
          ]}
        />
      )}

      {(p.collected > 0 || p.toCollect > 0) && (
        <Link href="/settings/business/money" className="card cp-money" aria-label="Open My money">
          <span><b>{dollars(p.collected)}</b> <span className="muted small">collected</span> &middot; <b>{dollars(p.toCollect)}</b> <span className="muted small">to collect</span></span>
          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>My money &rsaquo;</span>
        </Link>
      )}

      {!first && <PushCard />}

      {!first && (
        <InviteCard title="Know a contractor who needs work?" body="Jobfile is free to join. Send it to a friend in the trades." cta="Invite a contractor" back="/projects" />
      )}

      {p.alerts}

      {!first && <HomeScreenCard />}
    </div>
  );
}
