import TradeIcon from '@/components/TradeIcon';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { dollars } from '@/lib/money';
import { companyReviews, summarize } from '@/lib/reviews';
import { fmtDate, INSURANCE_KINDS, isCurrent, signedUrls } from '@/lib/companyProfile';
import { firstNameInitial, listingOpen, listingTitle, requireMarketplace, type Bid, type Listing } from '@/lib/marketplace';
import RangeBar from '@/components/RangeBar';
import AcceptBid from '@/components/AcceptBid';
import BidCompare, { type CompareCol } from '@/components/BidCompare';
import CompareBar from '@/components/CompareBar';
import InsuranceBadge from '@/components/InsuranceBadge';
import BidThread, { type ThreadMsg } from '@/components/BidThread';
import ListingPhotoUploader from '@/components/ListingPhotoUploader';
import BidViewNotice from '@/components/BidViewNotice';
import { answerRows, detailPercent } from '@/lib/scopeQuestions';
import { ackBidView, recordBidViews, recordCompared } from '@/lib/bidViews';
import { acceptBid, closeListing, deleteListingPhoto, deleteListingVideo, placeBid, withdrawBid } from '../actions';

export const dynamic = 'force-dynamic';
const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' });
const range = (a: number | null, b: number | null) => [a, b].filter((x) => x != null).map((x) => dollars(x as number)).join(' – ');

export default async function ListingPage({ params, searchParams }: { params: { id: string }; searchParams: { compare?: string | string[]; insured?: string; open?: string; posted?: string; media?: string; bid?: string; error?: string } }) {
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

  const [{ data: photoRows }, { data: bidRows }, { data: videoRows }] = await Promise.all([
    db.from('marketplace_photos').select('id,path').eq('listing_id', l.id).order('created_at'),
    db.from('marketplace_bids').select('*').eq('listing_id', l.id).order('created_at'),
    db.from('marketplace_videos').select('id,path').eq('listing_id', l.id).order('created_at'),
  ]);
  const photoUrls = await signedUrls('listing-photos', (photoRows ?? []).map((p) => p.path as string));
  const videoUrls = await signedUrls('listing-videos', (videoRows ?? []).map((v) => v.path as string));
  const allBids = (bidRows ?? []) as Bid[];
  // The homeowner has now seen the bids; the Projects page stops calling them new. Ignored if the 014 column is not there yet.
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
  // Viewed signals: the homeowner's visit is noted for the contractor; the contractor opening their bid clears the Needs you row.
  if (owner) await recordBidViews(db, visible as any[]);
  else if (myBid) await ackBidView(db, myBid as any);

  // For the homeowner: who each bidder is, their rating and whether their insurance is verified.
  const info = new Map<string, { name: string; avg: number; count: number; insured: boolean; pending: boolean; kinds: string[]; until: string; logo: string }>();
  if (owner && visible.length) {
    const cids = Array.from(new Set(visible.map((b) => b.company_id)));
    const [{ data: cos }, { data: ins }] = await Promise.all([
      db.from('companies').select('id,name,logo_path').in('id', cids),
      db.from('company_insurance').select('company_id,status,expires_on,kind').in('company_id', cids),
    ]);
    const logoUrls = await signedUrls('company-photos', (cos ?? []).map((c: any) => c.logo_path as string).filter(Boolean));
    for (const c of cos ?? []) {
      const s = summarize(await companyReviews(c.id as string));
      const good = (ins ?? []).filter((i: any) => i.company_id === c.id && isCurrent(i)).map((i: any) => i.expires_on as string).sort();
      const kinds: string[] = Array.from(new Set<string>((ins ?? []).filter((i: any) => i.company_id === c.id && isCurrent(i)).map((i: any) => (INSURANCE_KINDS as Record<string, string>)[i.kind as string] ?? ''))).filter(Boolean);
      const pending = (ins ?? []).some((i: any) => i.company_id === c.id && i.status === 'pending');
      info.set(c.id as string, { name: c.name as string, avg: s.avg, count: s.count, insured: good.length > 0, pending, kinds, until: good[0] ?? '', logo: (c as any).logo_path ? logoUrls.get((c as any).logo_path as string) ?? '' : '' });
    }
  }

  const onlyInsured = searchParams.insured === '1';
  const shown = onlyInsured ? visible.filter((b) => info.get(b.company_id)?.insured) : visible;
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
      {searchParams.posted ? <div className="box ok">Your project is posted. Contractors can now send bids. Add photos below to help them price it.</div> : null}
      {searchParams.media === 'partial' ? <div className="box bad">Your project is posted, but some photos or videos did not upload. You can add them again below.</div> : null}
      {searchParams.bid ? <div className="box ok">Your bid was sent.</div> : null}
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}

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

      {((photoRows ?? []).length > 0 || owner) && (
        <div className="card">
          <h2>Photos</h2>
          <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
            {(photoRows ?? []).map((p) => (
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
              cols={compareBids.map((b): CompareCol => {
                const c = info.get(b.company_id);
                return {
                  id: b.id, name: c?.name ?? 'Contractor', priceCents: b.price_cents, price: dollars(b.price_cents),
                  range: hasAI ? (b.price_cents < (l.ai_low_cents as number) * 0.8 ? 'low' : b.price_cents > (l.ai_high_cents as number) * 1.2 ? 'high' : 'in') : null,
                  weeks: b.weeks, start: b.start_date ? fmtDate(b.start_date) : '',
                  rating: c && c.count > 0 ? { avg: c.avg, count: c.count } : null,
                  insurance: c?.insured ? 'ok' : c?.pending ? 'wait' : 'none', until: c?.until ? fmtDate(c.until) : '',
                  inclusions: b.inclusions, canAccept: open && b.status === 'waiting', messageHref: `/marketplace/${l.id}?open=${b.id}#bid-${b.id}`,
                };
              })}
            />
          )}
          {shown.length === 0 && visible.length > 0 && <div className="card"><p className="muted">No bids with verified insurance yet. Turn off the filter to see all bids.</p></div>}
          {visible.length === 0 && <div className="card"><p className="muted">No bids yet. Contractors on Jobfile can see your project and send bids.</p></div>}
          {shown.map((b) => {
            const c = info.get(b.company_id);
            const low = hasAI && b.price_cents < (l.ai_low_cents as number) * 0.8;
            const high = hasAI && b.price_cents > (l.ai_high_cents as number) * 1.2;
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
                  {shown.length > 1 && b.status === 'waiting' ? <label className="row small" style={{ gap: 8, fontWeight: 700, minHeight: 44, cursor: 'pointer' }}><input type="checkbox" name="compare" form="cmpform" value={b.id} defaultChecked={cmpIds.has(b.id)} style={{ width: 22, height: 22 }} />Compare</label> : null}
                  {b.status === 'won' ? <span className="pill ok">Hired</span> : b.status === 'not_selected' ? <span className="pill">Not selected</span> : null}
                </div>
                <div className="row small muted">
                  <span>{c && c.count > 0 ? `★ ${c.avg.toFixed(1)} · ${c.count} review${c.count > 1 ? 's' : ''}` : 'No reviews yet'}</span>
                </div>
                <InsuranceBadge state={c?.insured ? 'ok' : c?.pending ? 'wait' : 'none'} name={c?.name ?? 'This contractor'} until={c?.until ?? ''} kinds={c?.kinds ?? []} />
                <div style={{ fontSize: 26, fontWeight: 800 }}>{dollars(b.price_cents)}</div>
                <p className="muted small">{[b.weeks ? `${b.weeks} week${b.weeks > 1 ? 's' : ''}` : '', b.start_date ? `starts ${fmtDate(b.start_date)}` : ''].filter(Boolean).join(' · ') || 'Timeline not given'}</p>
                {hasAI && <RangeBar price={b.price_cents} lo={l.ai_low_cents as number} hi={l.ai_high_cents as number} />}
                {low && <div className="box warn">This bid is well below the local range. Ask what is not included before you accept.</div>}
                {high && <div className="box warn">This bid is well above the local range. Ask what makes it higher.</div>}
                {b.inclusions ? <p className="small"><b>Included:</b> {b.inclusions}</p> : null}
                {b.note ? <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{b.note}</p> : null}
                {thread(b.id, c?.name ?? 'the contractor', b.status === 'waiting')}
                {open && b.status === 'waiting' && (
                  <AcceptBid action={acceptBid} bidId={b.id} name={c?.name ?? 'this contractor'} price={dollars(b.price_cents)} />
                )}
              </div>
            );
          })}
          {l.status === 'awarded' && l.project_id && <Link className="btn" href={`/projects/${l.project_id}/overview`}>Open the project</Link>}
          {shown.length > 1 && <CompareBar action={`/marketplace/${l.id}`} />}
          {open && (
            <form action={closeListing}><input type="hidden" name="listing_id" value={l.id} /><button className="btn ghost" type="submit">Close this project (no more bids)</button></form>
          )}
        </>
      )}

      {!owner && companyId && (
        <div className="card">
          <h2>{myBid && myBid.status !== 'withdrawn' ? 'Your bid' : 'Place a bid'}</h2>
          {myBid && myBid.status === 'won' && l.project_id && <><div className="box ok">You won this job.</div><Link className="btn" href={`/projects/${l.project_id}/overview`}>Open the project</Link></>}
          {myBid && myBid.status === 'not_selected' && <div className="box warn">This project went to another contractor or was closed.</div>}
          {open && needsInsurance && (
            <div className="box" style={{ background: 'var(--accent-soft, #f9efe4)' }}>
              <b>Add your insurance to show a verified badge on your bids.</b>
              <span className="small" style={{ display: 'block' }}>Homeowners see it next to your name. Upload your certificate in <Link href="/settings/business">Settings &gt; Business profile</Link>.</span>
            </div>
          )}
          {open && (!myBid || myBid.status === 'waiting' || myBid.status === 'withdrawn') ? (
            <form action={placeBid} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="hidden" name="listing_id" value={l.id} />
              {hasAI && <p className="muted small">AI reference for this scope: {dollars(l.ai_low_cents as number)} – {dollars(l.ai_high_cents as number)}. Bid what the work really costs you.</p>}
              <div className="grid2">
                <label className="fld">Your price ($)<input name="price" required inputMode="decimal" defaultValue={myBid && myBid.status !== 'withdrawn' ? String(myBid.price_cents / 100) : ''} placeholder="31400" /></label>
                <label className="fld">How many weeks?<input name="weeks" inputMode="numeric" defaultValue={myBid?.weeks ?? ''} placeholder="8" /></label>
                <label className="fld">Earliest start date<input name="start_date" type="date" defaultValue={myBid?.start_date ?? ''} /></label>
              </div>
              <label className="fld">What is included (permits, materials…)<textarea name="inclusions" rows={2} maxLength={500} defaultValue={myBid?.inclusions ?? ''} /></label>
              <label className="fld">Note to the homeowner<textarea name="note" rows={3} maxLength={1000} defaultValue={myBid?.note ?? ''} placeholder="No phone numbers or emails. You can talk once the homeowner accepts." /></label>
              <div className="row"><button className="btn" type="submit">{myBid && myBid.status === 'waiting' ? 'Update my bid' : 'Send bid'}</button></div>
            </form>
          ) : null}
          {myBid && myBid.status !== 'withdrawn' && thread(myBid.id, 'the homeowner', myBid.status === 'waiting')}
          {open && myBid && myBid.status === 'waiting' && (
            <form action={withdrawBid}><input type="hidden" name="listing_id" value={l.id} /><button className="btn ghost" type="submit">Withdraw my bid</button></form>
          )}
          {!open && !myBid && <p className="muted">This project is no longer taking bids.</p>}
        </div>
      )}
    </>
  );
}
