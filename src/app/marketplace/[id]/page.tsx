import BidChoice from '@/components/BidChoice';
import { localPartners } from '@/lib/team';
import TradeIcon from '@/components/TradeIcon';
import Link from 'next/link';
import { declineInvite } from '@/app/invitebid/actions';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { dollars } from '@/lib/money';
import { companyReviews, summarize } from '@/lib/reviews';
import { outsideRatingsFor } from '@/lib/googleRatings';
import { fmtDate, INSURANCE_KINDS, isCurrent, signedUrls } from '@/lib/companyProfile';
import { firstNameInitial, JOB_TYPES, listingOpen, listingTitle, requireMarketplace, type Bid, type Listing } from '@/lib/marketplace';
import RangeBar from '@/components/RangeBar';
import AcceptBid from '@/components/AcceptBid';
import HireTeam from '@/components/HireTeam';
import ProgressStrip from '@/components/ProgressStrip';
import BidCompare, { type CompareCol } from '@/components/BidCompare';
import CompareBar from '@/components/CompareBar';
import InsuranceBadge from '@/components/InsuranceBadge';
import BidThread, { type ThreadMsg } from '@/components/BidThread';
import ListingPhotoUploader from '@/components/ListingPhotoUploader';
import BidViewNotice from '@/components/BidViewNotice';
import { answerRows, detailPercent } from '@/lib/scopeQuestions';
import { ackBidView, recordBidViews, recordCompared } from '@/lib/bidViews';
import { acceptBid, acceptTeamBoth, closeListing, deleteListingPhoto, deleteListingVideo, extendListing, placeBid, withdrawBid } from '../actions';
import VisitCard, { NewVisit, VisitPrefEditor } from '@/components/VisitCard';
import type { Visit } from '@/lib/visits';
import { countMatchingContractors, DEFAULT_RADIUS } from '@/lib/matching';

export const dynamic = 'force-dynamic';
const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' });
const range = (a: number | null, b: number | null) => [a, b].filter((x) => x != null).map((x) => dollars(x as number)).join(' – ');

export default async function ListingPage({ params, searchParams }: { params: { id: string }; searchParams: { compare?: string | string[]; insured?: string; open?: string; posted?: string; extended?: string; media?: string; bid?: string; error?: string; inv?: string; invc?: string } }) {
  requireMarketplace();
  const { user } = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const db = supabaseAdmin();
  const { data: l } = await db.from('marketplace_listings').select('*').eq('id', params.id).maybeSingle<Listing>();
  if (!l) notFound();
  const owner = l.homeowner_id === user.id;
  const { data: mem } = await db.from('company_members').select('company_id').eq('user_id', user.id).limit(1);
  const companyId = (mem ?? [])[0]?.company_id as string | undefined;
  if (!owner && !companyId) notFound();
  const open = listingOpen(l);
  const told = owner && searchParams.posted ? await countMatchingContractors({ id: l.id, homeowner_id: l.homeowner_id, job_type: l.job_type, zip: l.zip, city: l.city, items: (l as any).items ?? [], ai_low_cents: l.ai_low_cents, ai_high_cents: l.ai_high_cents } as any) : 0;
  const msLeft = new Date(l.expires_at).getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86400_000));
  const showExtend = owner && l.status === 'open' && daysLeft <= 7;

  const [{ data: photoRows }, { data: bidRows }, { data: videoRows }] = await Promise.all([
    db.from('marketplace_photos').select('id,path').eq('listing_id', l.id).order('created_at'),
    db.from('marketplace_bids').select('*').eq('listing_id', l.id).order('created_at'),
    db.from('marketplace_videos').select('id,path').eq('listing_id', l.id).order('created_at'),
  ]);
  const photoUrls = await signedUrls('listing-photos', (photoRows ?? []).map((p) => p.path as string));
  const ideaUrls = (l as any).idea_path ? await signedUrls('listing-photos', [(l as any).idea_path as string]) : new Map<string, string>();
  const videoUrls = await signedUrls('listing-videos', (videoRows ?? []).map((v) => v.path as string));
  const allBids = (bidRows ?? []) as Bid[];
  // The homeowner has now seen the bids; the Projects page stops calling them new. Ignored if the 014 column is not there yet.
  // Invites and questions for this project (ignored if the 041 tables are not there yet).
  let invRows: any[] = [];
  let invNames = new Map<string, string>();
  try {
    const q = db.from('bid_invites').select('id,company_id,status,note,created_at').eq('listing_id', l.id);
    const { data: iv } = owner ? await q : companyId ? await q.eq('company_id', companyId) : { data: [] };
    invRows = (iv ?? []) as any[];
    if (owner && invRows.length) {
      const { data: cn } = await db.from('companies').select('id,name').in('id', invRows.map((r) => r.company_id));
      invNames = new Map(((cn ?? []) as any[]).map((r) => [r.id as string, r.name as string]));
    }
  } catch { /* table missing */ }
  if (owner && searchParams.invc && /^[0-9a-f-]{36}$/i.test(searchParams.invc) && !invNames.has(searchParams.invc)) {
    try { const { data: ic } = await db.from('companies').select('id,name').eq('id', searchParams.invc).maybeSingle<any>(); if (ic) invNames.set(ic.id as string, ic.name as string); } catch { /* ignore */ }
  }
  const bidders = new Set(allBids.map((b) => b.company_id as string));
  if (owner) await db.from('marketplace_listings').update({ bids_seen_at: new Date().toISOString() }).eq('id', l.id);
  // Pre-accept messages. Homeowners see every bid's thread; a contractor sees only their own. Opening the page marks the other side's messages read.
  const threadBids = owner ? allBids.filter((b) => b.status !== 'withdrawn').map((b) => b.id) : allBids.filter((b) => b.company_id === companyId).map((b) => b.id);
  const msgRows = threadBids.length ? ((await db.from('marketplace_messages').select('id,bid_id,sender_id,body,created_at,read_at').in('bid_id', threadBids).order('created_at')).data ?? []) as any[] : [];
  const unreadBy = new Map<string, number>();
  msgRows.forEach((m) => { if (m.sender_id !== user.id && !m.read_at) unreadBy.set(m.bid_id, (unreadBy.get(m.bid_id) ?? 0) + 1); });
  if (unreadBy.size) await db.from('marketplace_messages').update({ read_at: new Date().toISOString() }).in('bid_id', threadBids).neq('sender_id', user.id).is('read_at', null);
  const thread = (bidId: string, other: string, bidOpen: boolean) => (
    <BidThread
      listingId={l.id}
      bidId={bidId}
      messages={msgRows.filter((m) => m.bid_id === bidId).map((m): ThreadMsg => ({ id: m.id, mine: m.sender_id === user.id, body: m.body, at: m.created_at }))}
      unread={unreadBy.get(bidId) ?? 0}
      canSend={open && bidOpen}
      otherName={other}
      open={searchParams.open === bidId}
    />
  );
  const visible = owner ? allBids.filter((b) => b.status !== 'withdrawn') : [];
  const myBid = companyId ? allBids.find((b) => b.company_id === companyId) : undefined;
  // Site visits on bids: the homeowner sees them for every bid, a contractor only for their own.
  const visitBidIds = owner ? visible.map((b) => b.id) : myBid ? [myBid.id] : [];
  const visitRows = visitBidIds.length ? (((await db.from('visits').select('*').in('bid_id', visitBidIds).neq('status', 'canceled')).data ?? []) as unknown as Visit[]) : [];
  // Visits asked for before any bid: the homeowner sees them all, a contractor only their own.
  const preRows = (((await db.from('visits').select('*').eq('listing_id', l.id).is('bid_id', null).neq('status', 'canceled')).data ?? []) as unknown as Visit[]).filter((v) => owner || v.created_by === user.id);
  const preNames = new Map<string, string>();
  if (owner && preRows.length) {
    const ids = Array.from(new Set(preRows.map((v) => v.created_by).filter(Boolean))) as string[];
    const { data: ms } = await db.from('company_members').select('user_id,company_id').in('user_id', ids);
    const { data: cos } = ms?.length ? await db.from('companies').select('id,name').in('id', (ms as any[]).map((m) => m.company_id)) : { data: [] };
    (ms ?? []).forEach((m: any) => preNames.set(m.user_id, ((cos ?? []) as any[]).find((c) => c.id === m.company_id)?.name ?? 'A contractor'));
  }
  const preWhere = { scope: 'listing' as const, listingId: l.id, returnPath: `/marketplace/${l.id}`, free: l.visit_free || undefined };
  const visitFor = (bidId: string, role: 'homeowner' | 'contractor', bidOpen: boolean) => {
    const mine = visitRows.filter((x) => x.bid_id === bidId);
    const where = { scope: 'bid' as const, bidId, returnPath: `/marketplace/${l.id}?open=${bidId}#bid-${bidId}` };
    const active = mine.some((x) => x.status !== 'done');
    return (
      <>
        {mine.map((v) => <VisitCard key={v.id} visit={v} role={role} where={where} />)}
        {!active && open && bidOpen ? <NewVisit role={role} where={where} again={mine.length > 0} /> : null}
      </>
    );
  };
  // Viewed signals: the homeowner's visit is noted for the contractor; the contractor opening their bid clears the Needs you row.
  if (owner) await recordBidViews(db, visible as any[]);
  else if (myBid) await ackBidView(db, myBid as any);

  // Team bids: the homeowner sees each part; a lead sees whether theirs is still waiting on a partner.
  const teamByBid = new Map<string, { lead: number; partners: { company_id: string; scope: string; price: number; bid_id: string | null }[]; separate: boolean; pkg: boolean; note: string; tbId: string }>();
  const partnerBidIds = new Set<string>();
  let myPendingTeam: { partnerName: string } | null = null;
  let myTeamPart: { leadName: string } | null = null;
  let myTeamLead = false;
  try {
    if (owner && visible.length) {
      const { data: tbs } = await db.from('team_bids').select('*').in('bid_id', visible.map((b) => b.id)).eq('status', 'sent');
      const tids = (tbs ?? []).map((t: any) => t.id as string);
      const { data: tps } = tids.length ? await db.from('team_partners').select('team_bid_id,company_id,scope,price_cents,bid_id').in('team_bid_id', tids).eq('status', 'confirmed') : { data: [] as any[] };
      const liveIds = new Set(visible.map((b) => b.id));
      for (const t of (tbs ?? []) as any[]) {
        const separate = t.structure === 'separate';
        // Separate contracts: a partner who withdrew simply drops out; the lead's bid then stands alone.
        const partners = ((tps ?? []) as any[]).filter((x) => x.team_bid_id === t.id && (!separate || (x.bid_id && liveIds.has(x.bid_id)))).map((x) => ({ company_id: x.company_id as string, scope: x.scope as string, price: x.price_cents as number, bid_id: (x.bid_id as string | null) ?? null }));
        if (separate && !partners.length) continue;
        teamByBid.set(t.bid_id as string, { lead: t.lead_cents as number, partners, separate, pkg: t.hire_mode === 'package', note: (t.schedule_note as string) ?? '', tbId: t.id as string });
        if (separate) partners.forEach((x) => x.bid_id && partnerBidIds.add(x.bid_id));
      }
    } else if (!owner && companyId) {
      const { data: pend } = await db.from('team_bids').select('id').eq('listing_id', l.id).eq('lead_company_id', companyId).eq('status', 'pending').maybeSingle();
      if (pend) {
        const { data: pp } = await db.from('team_partners').select('company_id').eq('team_bid_id', pend.id).limit(1);
        const pid = (pp ?? [])[0]?.company_id as string | undefined;
        const { data: pc } = pid ? await db.from('companies').select('name').eq('id', pid).maybeSingle() : { data: null };
        myPendingTeam = { partnerName: (pc?.name as string | undefined) ?? 'your partner' };
      }
      if (myBid && myBid.status !== 'withdrawn') {
        const { data: lt } = await db.from('team_bids').select('id').eq('bid_id', myBid.id).eq('status', 'sent').maybeSingle();
        if (lt) myTeamLead = true;
        const { data: mp } = await db.from('team_partners').select('team_bid_id').eq('bid_id', myBid.id).maybeSingle();
        if (mp) {
          const { data: tb } = await db.from('team_bids').select('lead_company_id').eq('id', mp.team_bid_id).maybeSingle();
          const { data: lc } = tb ? await db.from('companies').select('name').eq('id', tb.lead_company_id).maybeSingle() : { data: null };
          myTeamPart = { leadName: (lc?.name as string | undefined) ?? 'the lead company' };
        }
      }
    }
  } catch { /* team tables not created yet */ }

  // For the homeowner: who each bidder is, their rating and whether their insurance is verified.
  let idBy = new Map<string, string>();
  let credBy = new Map<string, import('@/lib/credentials').Credential[]>();
  const info = new Map<string, { name: string; avg: number; count: number; insured: boolean; pending: boolean; kinds: string[]; until: string; logo: string; verified: boolean }>();
  if (owner && visible.length) {
    const cids = Array.from(new Set([...visible.map((b) => b.company_id), ...Array.from(teamByBid.values()).flatMap((t) => t.partners.map((p) => p.company_id))]));
    const [{ data: cos }, { data: ins }] = await Promise.all([
      db.from('companies').select('*').in('id', cids),
      db.from('company_insurance').select('company_id,status,expires_on,kind').in('company_id', cids),
    ]);
    const logoUrls = await signedUrls('company-photos', (cos ?? []).map((c: any) => c.logo_path as string).filter(Boolean));
    credBy = await (await import('@/lib/credentials')).publicCredentials(cids);
    idBy = await (await import('@/lib/idCheck')).idVerifiedMap(cids);
    for (const c of cos ?? []) {
      const s = summarize(await companyReviews(c.id as string));
      const good = (ins ?? []).filter((i: any) => i.company_id === c.id && isCurrent(i)).map((i: any) => i.expires_on as string).sort();
      const kinds: string[] = Array.from(new Set<string>((ins ?? []).filter((i: any) => i.company_id === c.id && isCurrent(i)).map((i: any) => (INSURANCE_KINDS as Record<string, string>)[i.kind as string] ?? ''))).filter(Boolean);
      const pending = (ins ?? []).some((i: any) => i.company_id === c.id && i.status === 'pending');
      info.set(c.id as string, { name: c.name as string, avg: s.avg, count: s.count, insured: good.length > 0, pending, kinds, until: good[0] ?? '', logo: (c as any).logo_path ? logoUrls.get((c as any).logo_path as string) ?? '' : '', verified: !!(c as any).verified_at && !(c as any).hidden_at });
    }
  }

  const gRatings = owner && visible.length ? await outsideRatingsFor(Array.from(new Set([...visible.map((b: any) => b.company_id as string), ...Array.from(teamByBid.values()).flatMap((t) => t.partners.map((p) => p.company_id))]))) : new Map();
  // How many trades the job lists, from the groups its items belong to.
  const tradeGroups = (JOB_TYPES[l.job_type]?.groups ?? []).filter(([, its]) => its.some((i) => l.items.includes(i))).map(([g]) => g);
  const teamTrades = tradeGroups.length;
  let myCompanyName = '';
  let nearbyOpen = 0;
  if (!owner && companyId && open) {
    try {
      const { data: mc } = await db.from('companies').select('name').eq('id', companyId).maybeSingle<any>();
      myCompanyName = (mc?.name as string | undefined) ?? '';
      nearbyOpen = (await localPartners(String(l.zip ?? ''), companyId, { openOnly: true })).length;
    } catch { /* columns missing */ }
  }
  const onlyInsured = searchParams.insured === '1';
  const shown = (onlyInsured ? visible.filter((b) => info.get(b.company_id)?.insured) : visible).filter((b) => !partnerBidIds.has(b.id));
  // A contractor without current verified insurance gets a nudge, since the badge helps them stand out.
  let needsInsurance = false;
  if (!owner && companyId) {
    const { data: mine } = await db.from('company_insurance').select('status,expires_on').eq('company_id', companyId);
    needsInsurance = !(mine ?? []).some((i: any) => isCurrent(i));
  }

  // Side-by-side view: ?compare=<bid id>&compare=<bid id> (2 or 3 bids, homeowner only).
  const wanted = (Array.isArray(searchParams.compare) ? searchParams.compare : searchParams.compare ? [searchParams.compare] : []).slice(0, 3);
  const compareBids = owner ? visible.filter((b) => wanted.includes(b.id)) : [];
  const cmpIds = new Set(compareBids.map((b) => b.id));
  if (compareBids.length >= 2) await recordCompared(db, compareBids.map((b) => b.id));
  const waitingN = visible.filter((b) => b.status === 'waiting').length;
  const strip = !owner ? null
    : l.status === 'awarded' ? { now: l.project_id ? 4 : 3, title: l.project_id ? 'Hired. Your project has started.' : 'Hired.', text: l.project_id ? 'Everything now happens in your shared project: messages, agreement, photos and payments.' : 'Your contractor has been chosen.', action: l.project_id ? { href: `/projects/${l.project_id}`, label: 'Open your project' } : undefined }
    : !open ? null
    : waitingN === 0 ? { now: 1, title: 'Next: wait for bids, or add photos.', text: 'No bids yet. Most bids arrive within 2 days. Photos and a budget range help contractors price it.' }
    : waitingN === 1 ? { now: 1, title: 'Next: wait for more bids, or message this contractor.', text: '1 contractor has bid. Having 2 or 3 lets you compare side by side.' }
    : { now: 2, title: `Next: compare your ${waitingN} bids.`, text: 'Tick Compare on up to 3 bids to see price, time, rating and insurance side by side. When you are ready, accept one to hire.' };
  const rows = answerRows(l.job_type, l.answers);
  const pctDetail = detailPercent(l.job_type, l.answers);
  const hasAI = l.ai_low_cents != null && l.ai_high_cents != null;
  const budget = range(l.budget_min_cents, l.budget_max_cents);

  return (
    <>
      <div className="stack">
        <Link href={owner ? '/marketplace' : '/marketplace'} className="small">‹ Marketplace</Link>
        <h1>{listingTitle(l)}</h1>
        <div className="row">
          <span className="pill"><TradeIcon trade={l.job_type} size={15} />{l.job_type}</span>
          <span className={`pill ${open ? 'ok' : ''}`}>{l.status === 'awarded' ? 'Hired' : open ? 'Open for bids' : 'Closed'}</span>
          {l.is_homestead && <span className="pill warn">Homestead</span>}
        </div>
        <p className="muted small">{[l.city, `ZIP ${l.zip}`, l.size_sqft ? `${l.size_sqft.toLocaleString('en-US')} sq ft` : '', `Posted ${when(l.created_at)}`, owner ? '' : `by ${firstNameInitial(l.homeowner_name)}`].filter(Boolean).join(' · ')}</p>
      </div>
      {strip && <ProgressStrip {...strip} />}
      {searchParams.posted && told > 0 ? <div className="box ok"><b>Your project is posted.</b> We told {told} contractor{told === 1 ? '' : 's'} within {DEFAULT_RADIUS} miles of {l.zip} who do {l.job_type.toLowerCase()}. Add photos below to help them price it.</div> : null}
      {owner && searchParams.posted && searchParams.inv ? (() => {
        const nm = invNames.get(searchParams.invc ?? '') ?? 'The contractor';
        return searchParams.inv === 'ok'
          ? <div className="box ok"><b>{nm} was invited to bid.</b> They will see your project and can send a bid.</div>
          : <div className="box warn"><b>We could not invite {nm}.</b> {searchParams.inv === 'zip' ? 'They do not serve your ZIP code.' : 'They could not be invited right now.'} Your project is still posted for other contractors.</div>;
      })() : null}
      {searchParams.posted && told === 0 ? (
        <div className="box warn">
          <b>Your project is posted.</b> No contractors on Jobfile near {l.zip} do this kind of work yet, so nobody was alerted. You can still invite someone you know, or look for one yourself.
          <div className="row" style={{ marginTop: 8, gap: 8 }}>
            <Link href="/invites/new" className="btn">Invite a contractor</Link>
            <Link href="/find" className="btn ghost">Find contractors</Link>
          </div>
        </div>
      ) : null}
      {searchParams.extended ? <div className="box ok">Done. This project stays open for 30 more days.</div> : null}
      {showExtend ? (
        <div className="box warn">
          <b>{daysLeft > 0 ? `This post ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.` : 'This post has ended.'}</b> After it ends, contractors can no longer bid.
          <form action={extendListing} style={{ marginTop: 8 }}>
            <input type="hidden" name="listing_id" value={l.id} />
            <button className="btn" type="submit">Keep it open 30 more days</button>
          </form>
        </div>
      ) : null}
      {searchParams.media === 'partial' ? <div className="box bad">Your project is posted, but some photos or videos did not upload. You can add them again below.</div> : null}
      {searchParams.bid ? <div className="box ok">Your bid was sent.</div> : null}
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}
      {!owner && invRows[0] && invRows[0].status !== 'declined' && !bidders.has(companyId as string) && (
        <div className="box" style={{ background: 'var(--accent-soft, #f9efe4)' }}>
          <b>{invRows[0].note === 'Started a project with you' ? 'Your customer posted this project.' : invRows[0].status === 'invited' ? 'The homeowner invited you to bid.' : 'The homeowner asked you a question.'}</b>
          {invRows[0].note === 'Started a project with you' ? <span className="small" style={{ display: 'block' }}>They started a project with you on Jobfile. You can bid like everyone else, and your own quote and notes stay private.</span> : invRows[0].note ? <span className="small" style={{ display: 'block' }}>&ldquo;{invRows[0].note}&rdquo;</span> : null}
          <span className="row" style={{ gap: 10, marginTop: 8 }}>
            <Link className="btn ghost" href={`/marketplace/${l.id}/invite/${invRows[0].id}`}>{invRows[0].status === 'asked' ? 'Read and reply' : 'Ask a question'}</Link>
            <form action={declineInvite}><input type="hidden" name="id" value={invRows[0].id} /><button className="btn ghost" type="submit">Pass on this one</button></form>
          </span>
        </div>
      )}
      {owner && invRows.length > 0 && (
        <div className="card">
          <h2>Invited contractors</h2>
          <div className="stack" style={{ gap: 8 }}>
            {invRows.map((r) => (
              <div className="row" key={r.id} style={{ justifyContent: 'space-between', gap: 10 }}>
                <span><Link href={`/contractors/${r.company_id}`}><b>{invNames.get(r.company_id) ?? 'Contractor'}</b></Link> <span className="muted small">· {bidders.has(r.company_id) ? 'Bid sent' : r.status === 'declined' ? 'Passed' : r.status === 'asked' ? 'You asked a question' : 'Invited, no bid yet'}</span></span>
                {r.status !== 'declined' && <Link className="small" href={`/marketplace/${l.id}/invite/${r.id}`}>Messages</Link>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2>Scope of work</h2>
        {l.items.length > 0 ? <ul style={{ margin: 0, paddingLeft: 20 }}>{l.items.map((i) => <li key={i}>{i}</li>)}</ul> : <p className="muted">No items listed.</p>}
        {rows.length > 0 ? (
          <>
            <span className="pill ok">Detail level: {pctDetail >= 80 ? 'high' : pctDetail >= 40 ? 'medium' : 'low'} ({pctDetail}%)</span>
            <h3 style={{ margin: '4px 0 0', fontSize: 16 }}>What the homeowner told us</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.3fr)', gap: '6px 12px', fontSize: 14 }}>
              {rows.map((r) => (
                <div key={r.label} style={{ display: 'contents' }}>
                  <span className="muted">{r.label}</span>
                  <span style={r.unsure ? { color: 'var(--warn, #9a5b00)', fontWeight: 700 } : undefined}>{r.unsure ? 'Not sure, check on site' : r.value}</span>
                </div>
              ))}
            </div>
            {rows.some((r) => r.unsure) ? <p className="muted small" style={{ margin: 0 }}>Items marked &quot;Not sure&quot; are flagged so you can raise them in your bid note or ask before bidding.</p> : null}
          </>
        ) : null}
        {rows.length === 0 ? <p className="muted small" style={{ margin: 0 }}>{owner ? 'No detail answers were saved with this project.' : 'The homeowner did not answer the detail questions. You can ask before bidding, or raise anything unclear in your bid note.'}</p> : null}
        {l.details ? <p style={{ whiteSpace: 'pre-wrap' }}><b>Notes:</b> {l.details}</p> : null}
        {budget ? <p><b>Homeowner budget:</b> {budget}</p> : null}
        {owner && l.address ? <p className="muted small">Your address ({l.address}) is shared only with the contractor you hire.</p> : null}
        {!owner ? <p className="muted small">The street address is shared with the contractor the homeowner hires.</p> : null}
      </div>

      {hasAI && (
        <div className="card">
          <div className="row"><span className="pill warn">✦ AI cost reference</span></div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{dollars(l.ai_low_cents as number)} – {dollars(l.ai_high_cents as number)}</div>
          <p className="muted small">Typical range for this scope in the area{l.ai_confidence ? ` (${l.ai_confidence} confidence)` : ''}. Most likely about {dollars((l.ai_likely_cents ?? l.ai_low_cents) as number)}.</p>
          {(l.ai_breakdown ?? []).map((b) => (
            <div className="row small" key={b.group} style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><span>{b.group}</span><b>{dollars(b.low * 100)}–{dollars(b.high * 100)}</b></div>
          ))}
          <p className="muted small">{l.ai_notes || 'Made by AI from the scope and size. A reference only, not a quote. Final price comes from contractor bids.'}</p>
        </div>
      )}

      {(l as any).idea_path ? (
        <div className="card" style={{ borderColor: '#ecd4a8' }}>
          <h2>Homeowner’s idea</h2>
          <div style={{ display: 'grid', gridTemplateColumns: (l as any).before_path && photoUrls.get((l as any).before_path) ? '1fr 1fr' : '1fr', gap: 8 }}>
            {(l as any).before_path && photoUrls.get((l as any).before_path) ? (
              <figure style={{ margin: 0, position: 'relative' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrls.get((l as any).before_path)} alt="The room today" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 12 }} />
                <figcaption className="small" style={{ position: 'absolute', left: 8, bottom: 8, background: 'rgba(27,26,24,.78)', color: '#fff', borderRadius: 99, padding: '2px 10px', fontWeight: 700 }}>Before · their photo</figcaption>
              </figure>
            ) : null}
            <figure style={{ margin: 0, position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {ideaUrls.get((l as any).idea_path) ? <img src={ideaUrls.get((l as any).idea_path)} alt="AI design idea" style={{ width: '100%', aspectRatio: (l as any).before_path ? '1' : undefined, objectFit: 'cover', borderRadius: 12 }} /> : null}
              <figcaption className="small" style={{ position: 'absolute', left: 8, top: 8, background: 'rgba(27,26,24,.78)', color: '#fff', borderRadius: 99, padding: '2px 10px', fontWeight: 700 }}>AI idea{(l as any).before_path ? ' · after' : ''}</figcaption>
            </figure>
          </div>
          <p className="muted small" style={{ margin: 0 }}>{(l as any).idea_label ? `${(l as any).idea_label}. ` : ''}An AI picture of the look the homeowner likes. Not a plan, not a price.</p>
        </div>
      ) : null}

      {((photoRows ?? []).filter((p) => p.path !== (l as any).before_path).length > 0 || owner) && (
        <div className="card">
          <h2>Photos</h2>
          <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
            {(photoRows ?? []).filter((p) => p.path !== (l as any).before_path).map((p) => (
              <form key={p.id} action={deleteListingPhoto} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <input type="hidden" name="id" value={p.id} /><input type="hidden" name="listing_id" value={l.id} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {photoUrls.get(p.path as string) ? <img src={photoUrls.get(p.path as string)} alt="Project photo" loading="lazy" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 12 }} /> : null}
                {owner && open && <button className="btn ghost" style={{ minHeight: 32, padding: '4px 10px' }}>Remove</button>}
              </form>
            ))}
          </div>
          {owner && open && <ListingPhotoUploader listingId={l.id} />}
        </div>
      )}

      {((videoRows ?? []).length > 0) && (
        <div className="card">
          <h2>Videos</h2>
          <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(videoRows ?? []).map((v) => (
              <form key={v.id} action={deleteListingVideo} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <input type="hidden" name="id" value={v.id} /><input type="hidden" name="listing_id" value={l.id} />
                {videoUrls.get(v.path as string) ? <video src={videoUrls.get(v.path as string)} controls playsInline preload="metadata" style={{ width: '100%', borderRadius: 12, background: '#000' }} /> : null}
                {owner && open && <button className="btn ghost" style={{ minHeight: 32, padding: '4px 10px' }}>Remove video</button>}
              </form>
            ))}
          </div>
        </div>
      )}

      {owner && open && <VisitPrefEditor listingId={l.id} returnPath={`/marketplace/${l.id}`} pref={l.visit_pref ?? 'yes'} free={l.visit_free ?? ''} />}

      {owner && preRows.length > 0 && (
        <div className="card stack">
          <h2>Visit requests</h2>
          <p className="muted small">These contractors asked to see the job before bidding. Your address stays private until you hire.</p>
          {preRows.map((v) => (
            <div key={v.id} className="stack" style={{ gap: 6 }}>
              <b>{preNames.get(v.created_by ?? '') ?? 'A contractor'}</b>
              <VisitCard visit={v} role="homeowner" where={preWhere} />
            </div>
          ))}
        </div>
      )}

      {owner && (
        <>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2>{shown.length} bid{shown.length === 1 ? '' : 's'}</h2>
            {visible.length > 0 && <Link className="pill" href={onlyInsured ? `/marketplace/${l.id}` : `/marketplace/${l.id}?insured=1`} aria-pressed={onlyInsured}>{onlyInsured ? '✓ Insured only' : 'Insured only'}</Link>}
          </div>
          {visible.length > 0 && <BidViewNotice />}
          {onlyInsured && shown.length < visible.length && <p className="muted small">Hiding {visible.length - shown.length} bid{visible.length - shown.length === 1 ? '' : 's'} without current verified insurance.</p>}
          {compareBids.length >= 2 && (
            <BidCompare
              backHref={`/marketplace/${l.id}`}
              aiRange={hasAI ? { lo: l.ai_low_cents as number, hi: l.ai_high_cents as number, likely: l.ai_likely_cents ?? null } : null}
              cols={compareBids.map((b): CompareCol => {
                const c = info.get(b.company_id);
                return {
                  id: b.id, name: c?.name ?? 'Contractor', priceCents: b.price_cents, price: dollars(b.price_cents),
                  range: hasAI ? (b.price_cents < (l.ai_low_cents as number) * 0.8 ? 'low' : b.price_cents > (l.ai_high_cents as number) * 1.2 ? 'high' : 'in') : null,
                  weeks: b.weeks, start: b.start_date ? fmtDate(b.start_date) : '',
                  rating: c && c.count > 0 ? { avg: c.avg, count: c.count } : null,
                  insurance: c?.insured ? 'ok' : c?.pending ? 'wait' : 'none', until: c?.until ? fmtDate(c.until) : '',
                  inclusions: b.inclusions, canAccept: open && b.status === 'waiting', messageHref: `/marketplace/${l.id}?open=${b.id}#bid-${b.id}`,
                  logo: c?.logo ?? '', verified: !!c?.verified, profileHref: `/contractors/${b.company_id}`,
                };
              })}
            />
          )}
          {shown.length === 0 && visible.length > 0 && <div className="card"><p className="muted">No bids with verified insurance yet. Turn off the filter to see all bids.</p></div>}
          {visible.length === 0 && <div className="card"><p className="muted">No bids yet. Contractors on Jobfile can see your project and send bids.</p></div>}
          {shown.map((b) => {
            const c = info.get(b.company_id);
            const sep = !!teamByBid.get(b.id)?.separate;
            const low = !sep && hasAI && b.price_cents < (l.ai_low_cents as number) * 0.8;
            const high = !sep && hasAI && b.price_cents > (l.ai_high_cents as number) * 1.2;
            return (
              <div className="card" id={`bid-${b.id}`} key={b.id} style={b.status === 'won' ? { borderColor: 'var(--ok)' } : undefined}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="row" style={{ gap: 12, flexWrap: 'nowrap', minWidth: 0 }}>
                    {c?.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.logo} alt="" width={48} height={48} style={{ borderRadius: 14, objectFit: 'cover', flex: 'none' }} />
                    ) : (
                      <span aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 14, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--accent-soft, #f9efe4)', color: 'var(--accent, #cd7d2e)', fontWeight: 800, fontSize: 20 }}>
                        {(c?.name ?? 'C').trim().charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                      <b>{c?.name ?? 'Contractor'}</b>
                      <Link href={`/contractors/${b.company_id}`} className="small" style={{ fontWeight: 700 }}>View profile ›</Link>
                    </span>
                  </span>
                  {shown.length > 1 && b.status === 'waiting' && !teamByBid.get(b.id)?.separate ? <label className="row small" style={{ gap: 8, fontWeight: 700, minHeight: 44, cursor: 'pointer' }}><input type="checkbox" name="compare" form="cmpform" value={b.id} defaultChecked={cmpIds.has(b.id)} style={{ width: 22, height: 22 }} />Compare</label> : null}
                  {b.status === 'won' ? <span className="pill ok">Hired</span> : b.status === 'not_selected' ? <span className="pill">Not selected</span> : null}
                </div>
                <div className="row small muted">
                  <span>{c && c.count > 0 ? `★ ${c.avg.toFixed(1)} · ${c.count} review${c.count > 1 ? 's' : ''}` : 'No reviews yet'}</span>
                  {gRatings.get(b.company_id) ? <span className="pill warn" title="Linked by the contractor, as shown on Google Maps">★ {gRatings.get(b.company_id)!.rating.toFixed(1)} · {gRatings.get(b.company_id)!.count} on Google Maps</span> : null}
                </div>
                {c?.verified ? <span className="pill ok" style={{ width: 'max-content' }}>✓ Verified by Jobfile</span> : null}
                {idBy.has(b.company_id) ? <span className="pill ok" style={{ width: 'max-content' }}>✓ ID verified</span> : null}
                <InsuranceBadge state={c?.insured ? 'ok' : c?.pending ? 'wait' : 'none'} name={c?.name ?? 'This contractor'} until={c?.until ?? ''} kinds={c?.kinds ?? []} />
                {(credBy.get(b.company_id) ?? []).length > 0 && (
                  <div className="credchips" aria-label="Credentials">
                    {(credBy.get(b.company_id) ?? []).slice(0, 3).map((x) => <span key={x.id} className={x.status === 'checked' ? 'v' : ''}>{x.status === 'checked' ? '✓ ' : ''}{x.kind === 'bbb' ? 'BBB' : x.kind === 'epa' ? 'EPA lead-safe' : x.name.length > 22 ? x.name.slice(0, 21) + '…' : x.name}</span>)}
                    {(credBy.get(b.company_id) ?? []).length > 3 && <span>+{(credBy.get(b.company_id) ?? []).length - 3}</span>}
                  </div>
                )}
                {!teamByBid.get(b.id)?.separate ? <div style={{ fontSize: 26, fontWeight: 800 }}>{dollars(b.price_cents)}</div> : null}
                {teamByBid.get(b.id) ? (() => {
                  const tm = teamByBid.get(b.id)!;
                  const total = tm.lead + tm.partners.reduce((n, x) => n + x.price, 0);
                  return (
                    <div className="box" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <b>Team bid · {1 + tm.partners.length} companies{tm.separate ? ' · Separate contracts' : ''}</b>
                      {tm.separate ? <span className="row" style={{ justifyContent: 'space-between' }}><span className="muted small">Combined</span><b style={{ fontSize: 22 }}>{dollars(total)}</b></span> : null}
                      <span className="row small" style={{ justifyContent: 'space-between' }}><span><b>{c?.name ?? 'Contractor'}</b>{tm.separate ? '' : ' · Lead'}</span><b>{dollars(tm.lead)}</b></span>
                      {tm.partners.map((tp) => {
                        const pc = info.get(tp.company_id);
                        const pg = gRatings.get(tp.company_id);
                        return (
                          <span key={tp.company_id} className="stack small" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span className="row" style={{ justifyContent: 'space-between' }}><span><b>{pc?.name ?? 'Partner'}</b>{tm.separate ? '' : ' · Partner'}</span><b>{dollars(tp.price)}</b></span>
                            <span className="muted">{tp.scope}</span>
                            <span className="row" style={{ gap: 6 }}>
                              <span className="pill">{pc && pc.count > 0 ? `★ ${pc.avg.toFixed(1)} · ${pc.count} review${pc.count > 1 ? 's' : ''}` : 'No reviews yet'}</span>
                              {pg ? <span className="pill warn">★ {pg.rating.toFixed(1)} on Google Maps</span> : null}
                              {pc?.insured ? <span className="pill ok">Insured</span> : null}
                              {pc?.verified ? <span className="pill ok">✓ Verified</span> : null}
                              <Link href={`/contractors/${tp.company_id}`} style={{ fontWeight: 700 }}>Profile ›</Link>
                            </span>
                            {tm.separate && tp.bid_id ? <>{thread(tp.bid_id, pc?.name ?? 'the contractor', tp.bid_id ? allBids.find((x) => x.id === tp.bid_id)?.status === 'waiting' : false)}{visitFor(tp.bid_id, 'homeowner', allBids.find((x) => x.id === tp.bid_id)?.status === 'waiting')}</> : null}
                          </span>
                        );
                      })}
                      {tm.separate && tm.note ? <span className="small"><b>Schedule note:</b> {tm.note}</span> : null}
                      <span className="muted small">{tm.separate ? 'Two contracts: you hire and pay each company directly.' : 'One lead is accountable to you. If you hire this team, you hire and rate the lead.'}</span>
                    </div>
                  );
                })() : null}
                <p className="muted small">{[b.weeks ? `${b.weeks} week${b.weeks > 1 ? 's' : ''}` : '', b.start_date ? `starts ${fmtDate(b.start_date)}` : ''].filter(Boolean).join(' · ') || 'Timeline not given'}</p>
                {hasAI && !sep && <RangeBar price={b.price_cents} lo={l.ai_low_cents as number} hi={l.ai_high_cents as number} />}
                {low && <div className="box warn">This bid is well below the local range. Ask what is not included before you accept.</div>}
                {high && <div className="box warn">This bid is well above the local range. Ask what makes it higher.</div>}
                {b.inclusions ? <p className="small"><b>Included:</b> {b.inclusions}</p> : null}
                {b.note ? <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{b.note}</p> : null}
                {thread(b.id, c?.name ?? 'the contractor', b.status === 'waiting')}
                {visitFor(b.id, 'homeowner', b.status === 'waiting')}
                {open && b.status === 'waiting' && (sep ? (() => {
                  const tm = teamByBid.get(b.id)!;
                  return <HireTeam bothAction={acceptTeamBoth} singleAction={acceptBid} teamBidId={tm.tbId} pkg={tm.pkg} total={dollars(tm.lead + tm.partners.reduce((n, x) => n + x.price, 0))} options={[{ bidId: b.id, name: c?.name ?? 'this company', price: dollars(tm.lead) }, ...tm.partners.filter((x) => x.bid_id).map((x) => ({ bidId: x.bid_id as string, name: info.get(x.company_id)?.name ?? 'the partner', price: dollars(x.price) }))]} />;
                })() : (
                  <AcceptBid action={acceptBid} bidId={b.id} name={c?.name ?? 'this contractor'} price={dollars(b.price_cents)} />
                ))}
              </div>
            );
          })}
          {l.status === 'awarded' && l.project_id && <Link className="btn" href={`/projects/${l.project_id}/overview`}>Open the project</Link>}
          {shown.length > 1 && <CompareBar action={`/marketplace/${l.id}`} />}
          {open && (
            <form action={closeListing} className="stack" style={{ gap: 6 }}>
              <input type="hidden" name="listing_id" value={l.id} />
              <label className="small muted" htmlFor="close-reason">Why are you closing it? (optional, contractors see this)</label>
              <select id="close-reason" name="reason" defaultValue="other"><option value="other">Prefer not to say</option><option value="other_pro">Went with someone else</option><option value="changed_mind">Changed my mind</option><option value="price">Prices were too high</option></select>
              <button className="btn ghost" type="submit">Close this project (no more bids)</button>
            </form>
          )}
        </>
      )}

      {!owner && companyId && (
        <div className="card">
          <h2 id="your-bid">{myBid && myBid.status !== 'withdrawn' ? 'Your bid' : 'Place a bid'}</h2>
          {open && (!myBid || myBid.status === 'withdrawn') && (
            <>
              {preRows.map((v) => <VisitCard key={v.id} visit={v} role="contractor" where={preWhere} />)}
              {!preRows.some((v) => v.status !== 'done') && <NewVisit role="contractor" where={preWhere} noDetails={rows.length === 0} pref={l.visit_pref ?? 'yes'} free={l.visit_free ?? ''} />}
            </>
          )}
          {myBid && myBid.status === 'won' && l.project_id && <><div className="box ok">You won this job.</div><Link className="btn" href={`/projects/${l.project_id}/overview`}>Open the project</Link></>}
          {myBid && myBid.status === 'not_selected' && <div className="box warn">This project went to another contractor or was closed.</div>}
          {open && needsInsurance && (
            <div className="box" style={{ background: 'var(--accent-soft, #f9efe4)' }}>
              <b>Add your insurance to show a verified badge on your bids.</b>
              <span className="small" style={{ display: 'block' }}>Homeowners see it next to your name. Upload your certificate in <Link href="/settings/business">Settings &gt; Business profile</Link>.</span>
            </div>
          )}
          {myTeamLead && myBid && myBid.status === 'waiting' ? (
            <div className="box" style={{ background: 'var(--accent-soft, #f9efe4)' }}>
              <b>This is your team bid.</b>
              <span className="small" style={{ display: 'block' }}>To change a price, withdraw it below and start a new team bid in <Link href="/collaborate">Collaborate</Link>.</span>
            </div>
          ) : null}
          {myTeamPart && myBid && myBid.status === 'waiting' ? (
            <div className="box" style={{ background: 'var(--accent-soft, #f9efe4)' }}>
              <b>This is your part of a team bid with {myTeamPart.leadName}.</b>
              <span className="small" style={{ display: 'block' }}>Your price: {dollars(myBid.price_cents)}. If the homeowner hires you, you get your own project and agreement. To leave the team bid, withdraw below.</span>
            </div>
          ) : null}
          {open && myPendingTeam ? (
            <div className="box" style={{ background: 'var(--accent-soft, #f9efe4)' }}>
              <b>Your team bid is waiting on {myPendingTeam.partnerName}.</b>
              <span className="small" style={{ display: 'block' }}>It goes to the homeowner when they confirm. <Link href="/collaborate">Open Collaborate</Link></span>
            </div>
          ) : null}
          {(() => {
            const showForm = open && !myTeamPart && !myTeamLead && (!myBid || myBid.status === 'waiting' || myBid.status === 'withdrawn');
            const showTeam = open && !myPendingTeam && (!myBid || myBid.status === 'withdrawn');
            const formJsx = (<form action={placeBid} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="hidden" name="listing_id" value={l.id} />
              {hasAI && <p className="muted small">AI reference for this scope: {dollars(l.ai_low_cents as number)} – {dollars(l.ai_high_cents as number)}. Bid what the work really costs you.</p>}
              <div className="grid2">
                <label className="fld">Your price ($)<input name="price" required inputMode="decimal" defaultValue={myBid && myBid.status !== 'withdrawn' ? String(myBid.price_cents / 100) : ''} placeholder="31400" /></label>
                <label className="fld">How many weeks?<input name="weeks" inputMode="numeric" defaultValue={myBid?.weeks ?? ''} placeholder="8" /></label>
                <label className="fld">Earliest start date<input name="start_date" type="date" defaultValue={myBid?.start_date ?? ''} /></label>
              </div>
              <label className="fld">What is included (permits, materials…)<textarea name="inclusions" rows={2} maxLength={500} defaultValue={myBid?.inclusions ?? ''} /></label>
              <label className="fld">Note to the homeowner<textarea name="note" rows={3} maxLength={1000} defaultValue={myBid?.note ?? ''} placeholder="No phone numbers or emails. You can talk once the homeowner accepts." /></label>
              <button className="btn" type="submit" style={{ width: '100%' }}>{myBid && myBid.status === 'waiting' ? 'Update my bid' : 'Send bid'}</button>
            </form>);
            const hint = teamTrades > 1 ? (
              <div className="box" style={{ background: 'var(--accent-soft, #f9efe4)', display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }}>
                <b>This job needs {teamTrades} trades</b>
                <span className="row" style={{ gap: 6 }}>{tradeGroups.map((g) => <span key={g} className="pill">{g}</span>)}</span>
                <span className="small">Teaming up lets you bid on all of it.</span>
              </div>
            ) : null;
            const teamCard = (
              <div style={{ borderRadius: 18, background: 'linear-gradient(135deg, #1f4d3a, #2c6a50)', color: '#fff', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="row" style={{ gap: 12, flexWrap: 'nowrap', alignItems: 'center' }}>
                  <span aria-hidden="true" style={{ display: 'flex' }}>
                    <span style={{ width: 40, height: 40, borderRadius: '50%', background: '#c4813f', border: '2px solid #1f4d3a', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{(myCompanyName[0] ?? 'Y').toUpperCase()}</span>
                    <span style={{ width: 40, height: 40, borderRadius: '50%', background: '#2f5f8a', border: '2px solid #1f4d3a', display: 'grid', placeItems: 'center', fontWeight: 800, marginLeft: -12 }}>?</span>
                  </span>
                  <span><b style={{ fontSize: 18, display: 'block' }}>Pair up with a local pro</b><span className="small" style={{ opacity: 0.88 }}>{teamTrades > 1 ? `Bid on all ${teamTrades} trades together` : 'Bid on the whole job together'}</span></span>
                </div>
                {['Pick a partner within 50 miles', 'Set each part and price', 'They confirm, then the bid goes out'].map((t, i) => (
                  <div key={t} className="row" style={{ gap: 10, flexWrap: 'nowrap', alignItems: 'center' }}>
                    <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,.18)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, flex: 'none' }}>{i + 1}</span>
                    <span className="small">{t}</span>
                  </div>
                ))}
                <Link href={`/marketplace/${l.id}/team`} style={{ background: '#fff', color: '#1f4d3a', borderRadius: 14, padding: '13px 10px', textAlign: 'center', fontWeight: 700, textDecoration: 'none' }}>Choose a partner</Link>
                <span className="small" style={{ opacity: 0.88, textAlign: 'center' }}>{nearbyOpen > 0 ? `${nearbyOpen} ${nearbyOpen === 1 ? 'company' : 'companies'} nearby ${nearbyOpen === 1 ? 'is' : 'are'} open to partnering. ` : ''}You stay the lead. Your partner confirms their price before it is sent.</span>
              </div>
            );
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 6 }}>
                {showTeam ? hint : null}
                {showForm && showTeam ? <BidChoice alone={formJsx} team={teamCard} /> : showForm ? formJsx : showTeam ? teamCard : null}
              </div>
            );
          })()}
          {myBid && myBid.status !== 'withdrawn' && thread(myBid.id, 'the homeowner', myBid.status === 'waiting')}
          {myBid && myBid.status !== 'withdrawn' && visitFor(myBid.id, 'contractor', myBid.status === 'waiting')}
          {open && myBid && myBid.status === 'waiting' && (
            <form action={withdrawBid}><input type="hidden" name="listing_id" value={l.id} /><button className="btn ghost" type="submit">Withdraw my bid</button></form>
          )}
          {!open && !myBid && <p className="muted">This project is no longer taking bids.</p>}
        </div>
      )}
    </>
  );
}
