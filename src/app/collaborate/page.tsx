import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { dollars } from '@/lib/money';
import { listingTitle, requireMarketplace, type Listing } from '@/lib/marketplace';
import { companyOf, localPartners, PARTNER_LABEL, type TeamBid, type TeamPartner } from '@/lib/team';
import { myPartnerRows, PSTATUS, type ProjectPartner } from '@/lib/partners';
import { acceptCounter, cancelTeamBid, setOpenToPartner } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Collaborate · Jobfile' };

export default async function Collaborate({ searchParams }: { searchParams: { error?: string; ok?: string; q?: string } }) {
  requireMarketplace();
  const { user } = await requireUser();
  const me = await companyOf(user.id);
  if (!me) redirect('/marketplace');
  const db = supabaseAdmin();

  let setupMissing = false;
  let openToPartner = false;
  let mineBids: TeamBid[] = [];
  let myParts: TeamPartner[] = [];
  let inBids: TeamBid[] = [];
  let allParts: TeamPartner[] = [];
  try {
    const { data: co } = await db.from('companies').select('open_to_partner').eq('id', me!.id).maybeSingle<any>();
    openToPartner = !!co?.open_to_partner;
    const [{ data: a }, { data: b }] = await Promise.all([
      db.from('team_bids').select('*').eq('lead_company_id', me!.id).neq('status', 'canceled').order('created_at', { ascending: false }).limit(50),
      db.from('team_partners').select('*').eq('company_id', me!.id).order('created_at', { ascending: false }).limit(50),
    ]);
    mineBids = (a ?? []) as TeamBid[];
    myParts = (b ?? []) as TeamPartner[];
    const tbIds = Array.from(new Set([...mineBids.map((x) => x.id), ...myParts.map((x) => x.team_bid_id)]));
    if (tbIds.length) {
      const [{ data: c }, { data: d }] = await Promise.all([
        db.from('team_bids').select('*').in('id', myParts.map((x) => x.team_bid_id)).neq('status', 'canceled'),
        db.from('team_partners').select('*').in('team_bid_id', tbIds),
      ]);
      inBids = (c ?? []) as TeamBid[];
      allParts = (d ?? []) as TeamPartner[];
    }
  } catch { setupMissing = true; }

  const listingIds = Array.from(new Set([...mineBids, ...inBids].map((x) => x.listing_id)));
  const { data: ls } = listingIds.length ? await db.from('marketplace_listings').select('*').in('id', listingIds) : { data: [] as Listing[] };
  const listing = new Map(((ls ?? []) as Listing[]).map((l) => [l.id, l] as [string, Listing]));
  const companyIds = Array.from(new Set([...allParts.map((p) => p.company_id), ...mineBids.map((b) => b.lead_company_id), ...inBids.map((b) => b.lead_company_id)]));
  const { data: cos } = companyIds.length ? await db.from('companies').select('id,name').in('id', companyIds) : { data: [] as any[] };
  const name = new Map(((cos ?? []) as any[]).map((c) => [c.id as string, c.name as string] as [string, string]));
  const bidIds = [...mineBids, ...inBids].map((b) => b.bid_id).filter(Boolean) as string[];
  const { data: brs } = bidIds.length ? await db.from('marketplace_bids').select('id,status').in('id', bidIds) : { data: [] as any[] };
  const bidStatus = new Map(((brs ?? []) as any[]).map((b) => [b.id as string, b.status as string] as [string, string]));
  const inById = new Map(inBids.map((b) => [b.id, b] as [string, TeamBid]));

  const invites = myParts.filter((p) => p.status === 'invited' && inById.get(p.team_bid_id)?.status === 'pending');
  const waitingOnLead = myParts.filter((p) => p.status === 'countered' && inById.get(p.team_bid_id)?.status === 'pending');
  const confirmedIn = myParts.filter((p) => p.status === 'confirmed' && inById.get(p.team_bid_id));

  // Past partners: companies on a sent team bid with this one, on either side.
  const past = new Map<string, number>();
  mineBids.filter((b) => b.status === 'sent').forEach((b) => allParts.filter((p) => p.team_bid_id === b.id && p.status === 'confirmed').forEach((p) => past.set(p.company_id, (past.get(p.company_id) ?? 0) + 1)));
  confirmedIn.forEach((p) => { const tb = inById.get(p.team_bid_id); if (tb) past.set(tb.lead_company_id, (past.get(tb.lead_company_id) ?? 0) + 1); });
  const pastIds = Array.from(past.keys()).filter((id) => !name.has(id));
  if (pastIds.length) {
    const { data: more } = await db.from('companies').select('id,name').in('id', pastIds);
    ((more ?? []) as any[]).forEach((c) => name.set(c.id, c.name));
  }

  // Partner jobs: jobs other contractors invited this company to, and this company's own active projects (to add a partner).
  const jobsAsPartner: ProjectPartner[] = await myPartnerRows(user.id, me!.id);
  const pInfo = new Map<string, { project: string; lead: string }>();
  let myProjects: { id: string; name: string }[] = [];
  try {
    if (jobsAsPartner.length) {
      const [{ data: pj }, { data: lc }] = await Promise.all([
        db.from('projects').select('id,name').in('id', jobsAsPartner.map((j) => j.project_id)),
        db.from('companies').select('id,name').in('id', jobsAsPartner.map((j) => j.lead_company_id)),
      ]);
      const pn = new Map(((pj ?? []) as any[]).map((x) => [x.id as string, x.name as string] as [string, string]));
      const ln = new Map(((lc ?? []) as any[]).map((x) => [x.id as string, x.name as string] as [string, string]));
      jobsAsPartner.forEach((j) => pInfo.set(j.id, { project: pn.get(j.project_id) ?? 'A job', lead: ln.get(j.lead_company_id) ?? 'A contractor' }));
    }
    const { data: mp } = await db.from('projects').select('id,name').eq('company_id', me!.id).is('completed_at', null).order('created_at', { ascending: false }).limit(20);
    myProjects = (mp ?? []) as any[];
  } catch { /* partner tables not created yet */ }
  const partnerInvites = jobsAsPartner.filter((j) => j.status === 'invited');
  const partnerJobs = jobsAsPartner.filter((j) => j.status !== 'invited');

  const q = (searchParams.q ?? '').trim().slice(0, 60);
  let found: { id: string; name: string; open: boolean; miles: number }[] = [];
  let noZip = false;
  if (q.length >= 2) {
    try {
      const { data: mine } = await db.from('companies').select('business_zip').eq('id', me!.id).maybeSingle<any>();
      const zip = (mine?.business_zip as string | undefined) ?? '';
      if (!/^\d{5}$/.test(zip)) noZip = true;
      else found = await localPartners(zip, me!.id, { q });
    } catch { /* column missing */ }
  }

  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 90 }}>
      <h1>Collaborate</h1>
      <p className="muted">Team up with another company on a marketplace bid, or bring a contractor you work with onto a job you found yourself.</p>
      {searchParams.error ? <div className="box warn" role="alert">{searchParams.error}</div> : null}
      {searchParams.ok ? <div className="box ok" role="status">{searchParams.ok}</div> : null}
      {setupMissing ? <div className="box warn">Team bids need one database step. Ask Jobfile support to run it.</div> : null}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <b>Open to partnering</b>
          <span className={`pill${openToPartner ? ' ok' : ''}`}>{openToPartner ? 'On' : 'Off'}</span>
        </div>
        <p className="muted small">When on, an “Open to partnering” badge shows on your public profile and you appear first when nearby companies look for a partner.</p>
        <form action={setOpenToPartner}><input type="hidden" name="on" value={openToPartner ? '0' : '1'} /><button className="btn ghost" type="submit">{openToPartner ? 'Turn off' : 'Turn on'}</button></form>
      </div>

      <h2>Invites waiting ({invites.length + partnerInvites.length})</h2>
      {partnerInvites.map((j) => (
        <div className="card" key={j.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}><b>{pInfo.get(j.id)?.lead ?? 'A contractor'}</b><b>{dollars(j.price_cents)}</b></div>
          <span className="muted small">{j.scope} · {pInfo.get(j.id)?.project ?? 'A job'} · partner invite</span>
          <Link className="btn" href={`/partner/${j.id}`}>Review</Link>
        </div>
      ))}
      {invites.length === 0 && partnerInvites.length === 0 ? <div className="card"><p className="muted">No invites right now. When another company asks you to join a team bid, it shows up here.</p></div> : null}
      {invites.map((p) => {
        const tb = inById.get(p.team_bid_id)!;
        const l = listing.get(tb.listing_id);
        return (
          <div className="card" key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}><b>{name.get(tb.lead_company_id) ?? 'A contractor'}</b><b>{dollars(p.price_cents)}</b></div>
            <span className="muted small">{p.scope}{l ? ` · ${listingTitle(l)} · ${l.city || ''} ${l.zip}` : ''}</span>
            <Link className="btn" href={`/collaborate/${p.id}`}>Review</Link>
          </div>
        );
      })}
      {waitingOnLead.map((p) => {
        const tb = inById.get(p.team_bid_id)!;
        return <div className="card" key={p.id}><div className="row" style={{ justifyContent: 'space-between' }}><b>{name.get(tb.lead_company_id) ?? 'A contractor'}</b><span className="pill warn">You proposed {dollars(p.counter_cents ?? 0)}</span></div><p className="muted small">Waiting for the lead to accept your new price.</p></div>;
      })}

      <h2>My team bids</h2>
      {mineBids.length === 0 && confirmedIn.length === 0 ? <div className="card"><p className="muted">None yet. Open a project in the Marketplace and tap “Bid as a team”.</p></div> : null}
      {mineBids.map((b) => {
        const l = listing.get(b.listing_id);
        const ps = allParts.filter((p) => p.team_bid_id === b.id);
        const bs = b.bid_id ? bidStatus.get(b.bid_id) : undefined;
        const counter = ps.find((p) => p.status === 'countered');
        return (
          <div className="card" key={b.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <Link href={`/marketplace/${b.listing_id}`}><b>{l ? listingTitle(l) : 'Project'}</b></Link>
              <span className={`pill${bs === 'won' ? ' ok' : ''}`}>{b.status === 'pending' ? (counter ? 'New price to review' : ps.some((p) => p.status === 'declined') ? 'Partner declined' : `Waiting on ${name.get(ps[0]?.company_id ?? '') ?? 'partner'}`) : bs === 'won' ? 'Hired' : bs === 'not_selected' ? 'Not selected' : bs === 'withdrawn' ? 'Withdrawn' : 'Sent'}</span>
            </div>
            <div className="small muted">You {dollars(b.lead_cents)}{ps.map((p) => ` · ${name.get(p.company_id) ?? 'Partner'} ${dollars(p.status === 'countered' && p.counter_cents ? p.counter_cents : p.price_cents)} (${PARTNER_LABEL[p.status].toLowerCase()})`).join('')}</div>
            {counter ? <form action={acceptCounter}><input type="hidden" name="partner_row_id" value={counter.id} /><button className="btn" type="submit">Accept {dollars(counter.counter_cents ?? 0)} and send the bid</button></form> : null}
            {b.status === 'pending' ? <form action={cancelTeamBid}><input type="hidden" name="team_bid_id" value={b.id} /><button className="btn ghost" type="submit">Cancel this team bid</button></form> : null}
          </div>
        );
      })}
      {confirmedIn.map((p) => {
        const tb = inById.get(p.team_bid_id)!;
        const l = listing.get(tb.listing_id);
        const bs = tb.bid_id ? bidStatus.get(tb.bid_id) : undefined;
        return (
          <div className="card" key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}><b>{l ? listingTitle(l) : 'Project'}</b><span className={`pill${bs === 'won' ? ' ok' : ''}`}>{bs === 'won' ? 'Hired' : bs === 'not_selected' ? 'Not selected' : 'Partner · sent'}</span></div>
            <span className="muted small">Your part: {p.scope} · {dollars(p.price_cents)} · Lead: {name.get(tb.lead_company_id) ?? 'A contractor'}</span>
          </div>
        );
      })}

      <h2>Jobs where I’m a partner</h2>
      {partnerJobs.length === 0 ? <div className="card"><p className="muted">When a contractor you work with adds you to their job and you accept, it shows up here.</p></div> : null}
      {partnerJobs.map((j) => (
        <Link className="card row" key={j.id} href={`/partner/${j.id}`} style={{ justifyContent: 'space-between', gap: 8 }}>
          <span style={{ minWidth: 0 }}><b>{pInfo.get(j.id)?.project ?? 'A job'}</b><span className="muted small" style={{ display: 'block' }}>{j.scope} · {pInfo.get(j.id)?.lead}</span></span>
          <span className={`pill${j.status === 'accepted' ? ' ok' : ''}`}>{PSTATUS[j.status]}</span>
        </Link>
      ))}

      <h2>Invite someone you work with</h2>
      <p className="muted small">For a job you found yourself. Pick the project, then add the contractor by email. They only see their part.</p>
      {myProjects.length === 0 ? <div className="card"><p className="muted">You have no active projects yet.</p></div> : null}
      {myProjects.map((pr) => (
        <div className="card row" key={pr.id} style={{ justifyContent: 'space-between', gap: 8 }}><b style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{pr.name}</b><Link href={`/projects/${pr.id}/partners/new`} style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Add a partner ›</Link></div>
      ))}

      <h2>Past partners</h2>
      {past.size === 0 ? <div className="card"><p className="muted">Companies you win or bid with show up here.</p></div> : null}
      {Array.from(past.entries()).map(([id, n]) => (
        <div className="card row" key={id} style={{ justifyContent: 'space-between' }}><span><b>{name.get(id) ?? 'A contractor'}</b><span className="muted small"> · {n} team bid{n > 1 ? 's' : ''}</span></span><Link href={`/contractors/${id}`} style={{ fontWeight: 700 }}>View profile ›</Link></div>
      ))}

      <h2>Find a partner</h2>
      <form method="get" className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
        <input name="q" defaultValue={q} placeholder="Company name" aria-label="Company name" style={{ flex: 1 }} />
        <button className="btn" type="submit">Search</button>
      </form>
      {noZip ? <p className="muted small">Add your business ZIP in <Link href="/settings/business">Business profile</Link> to find partners near you.</p> : null}
      {q && !noZip && found.length === 0 ? <p className="muted small">No local verified companies match “{q}”. Team bids are for companies verified by Jobfile, near you.</p> : null}
      {found.map((c) => (
        <div className="card row" key={c.id} style={{ justifyContent: 'space-between' }}><span><b>{c.name}</b><span className="muted small"> · {Math.round(c.miles)} mi away</span>{c.open ? <span className="pill ok" style={{ marginLeft: 8 }}>Open to partnering</span> : null}</span><Link href={`/contractors/${c.id}`} style={{ fontWeight: 700 }}>View profile ›</Link></div>
      ))}
    </div>
  );
}
