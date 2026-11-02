import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { dollars } from '@/lib/money';
import { companyReviews, summarize } from '@/lib/reviews';
import { fmtDate, isCurrent, signedUrls } from '@/lib/companyProfile';
import { firstNameInitial, listingOpen, listingTitle, requireMarketplace, type Bid, type Listing } from '@/lib/marketplace';
import RangeBar from '@/components/RangeBar';
import ListingPhotoUploader from '@/components/ListingPhotoUploader';
import { acceptBid, closeListing, deleteListingPhoto, placeBid, withdrawBid } from '../actions';

export const dynamic = 'force-dynamic';
const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' });
const range = (a: number | null, b: number | null) => [a, b].filter((x) => x != null).map((x) => dollars(x as number)).join(' – ');

export default async function ListingPage({ params, searchParams }: { params: { id: string }; searchParams: { posted?: string; bid?: string; error?: string } }) {
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

  const [{ data: photoRows }, { data: bidRows }] = await Promise.all([
    db.from('marketplace_photos').select('id,path').eq('listing_id', l.id).order('created_at'),
    db.from('marketplace_bids').select('*').eq('listing_id', l.id).order('created_at'),
  ]);
  const photoUrls = await signedUrls('listing-photos', (photoRows ?? []).map((p) => p.path as string));
  const allBids = (bidRows ?? []) as Bid[];
  const visible = owner ? allBids.filter((b) => b.status !== 'withdrawn') : [];
  const myBid = companyId ? allBids.find((b) => b.company_id === companyId) : undefined;

  // For the homeowner: who each bidder is, their rating and whether their insurance is verified.
  const info = new Map<string, { name: string; avg: number; count: number; insured: boolean; until: string; logo: string }>();
  if (owner && visible.length) {
    const cids = Array.from(new Set(visible.map((b) => b.company_id)));
    const [{ data: cos }, { data: ins }] = await Promise.all([
      db.from('companies').select('id,name,logo_path').in('id', cids),
      db.from('company_insurance').select('company_id,status,expires_on').in('company_id', cids),
    ]);
    const logoUrls = await signedUrls('company-photos', (cos ?? []).map((c: any) => c.logo_path as string).filter(Boolean));
    for (const c of cos ?? []) {
      const s = summarize(await companyReviews(c.id as string));
      const good = (ins ?? []).filter((i: any) => i.company_id === c.id && isCurrent(i)).map((i: any) => i.expires_on as string).sort();
      info.set(c.id as string, { name: c.name as string, avg: s.avg, count: s.count, insured: good.length > 0, until: good[0] ?? '', logo: (c as any).logo_path ? logoUrls.get((c as any).logo_path as string) ?? '' : '' });
    }
  }

  const hasAI = l.ai_low_cents != null && l.ai_high_cents != null;
  const budget = range(l.budget_min_cents, l.budget_max_cents);

  return (
    <>
      <div className="stack">
        <Link href={owner ? '/marketplace' : '/marketplace'} className="small">‹ Marketplace</Link>
        <h1>{listingTitle(l)}</h1>
        <div className="row">
          <span className="pill">{l.job_type}</span>
          <span className={`pill ${open ? 'ok' : ''}`}>{l.status === 'awarded' ? 'Hired' : open ? 'Open for bids' : 'Closed'}</span>
          {l.is_homestead && <span className="pill warn">Homestead</span>}
        </div>
        <p className="muted small">{[l.city, `ZIP ${l.zip}`, l.size_sqft ? `${l.size_sqft.toLocaleString('en-US')} sq ft` : '', `Posted ${when(l.created_at)}`, owner ? '' : `by ${firstNameInitial(l.homeowner_name)}`].filter(Boolean).join(' · ')}</p>
      </div>
      {searchParams.posted ? <div className="box ok">Your project is posted. Contractors can now send bids. Add photos below to help them price it.</div> : null}
      {searchParams.bid ? <div className="box ok">Your bid was sent.</div> : null}
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}

      <div className="card">
        <h2>Scope of work</h2>
        {l.items.length > 0 ? <ul style={{ margin: 0, paddingLeft: 20 }}>{l.items.map((i) => <li key={i}>{i}</li>)}</ul> : <p className="muted">No items listed.</p>}
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

      {owner && (
        <>
          <h2>{visible.length} bid{visible.length === 1 ? '' : 's'}</h2>
          {visible.length === 0 && <div className="card"><p className="muted">No bids yet. Contractors on Jobfile can see your project and send bids.</p></div>}
          {visible.map((b) => {
            const c = info.get(b.company_id);
            const low = hasAI && b.price_cents < (l.ai_low_cents as number) * 0.8;
            const high = hasAI && b.price_cents > (l.ai_high_cents as number) * 1.2;
            return (
              <div className="card" key={b.id} style={b.status === 'won' ? { borderColor: 'var(--ok)' } : undefined}>
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
                  {b.status === 'won' ? <span className="pill ok">Hired</span> : b.status === 'not_selected' ? <span className="pill">Not selected</span> : null}
                </div>
                <div className="row small muted">
                  <span>{c && c.count > 0 ? `★ ${c.avg.toFixed(1)} · ${c.count} review${c.count > 1 ? 's' : ''}` : 'No reviews yet'}</span>
                  {c?.insured && <span className="pill ok">Insurance verified until {fmtDate(c.until)}</span>}
                </div>
                <div style={{ fontSize: 26, fontWeight: 800 }}>{dollars(b.price_cents)}</div>
                <p className="muted small">{[b.weeks ? `${b.weeks} week${b.weeks > 1 ? 's' : ''}` : '', b.start_date ? `starts ${fmtDate(b.start_date)}` : ''].filter(Boolean).join(' · ') || 'Timeline not given'}</p>
                {hasAI && <RangeBar price={b.price_cents} lo={l.ai_low_cents as number} hi={l.ai_high_cents as number} />}
                {low && <div className="box warn">This bid is well below the local range. Ask what is not included before you accept.</div>}
                {high && <div className="box warn">This bid is well above the local range. Ask what makes it higher.</div>}
                {b.inclusions ? <p className="small"><b>Included:</b> {b.inclusions}</p> : null}
                {b.note ? <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{b.note}</p> : null}
                {open && b.status === 'waiting' && (
                  <form action={acceptBid} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input type="hidden" name="bid_id" value={b.id} />
                    <p className="muted small">Accepting opens a Jobfile project with this price and your scope filled in, and tells the other bidders. Nothing is charged. You both still review and sign the agreement.</p>
                    <div className="row"><button className="btn" type="submit">Accept this bid</button></div>
                  </form>
                )}
              </div>
            );
          })}
          {l.status === 'awarded' && l.project_id && <Link className="btn" href={`/projects/${l.project_id}/overview`}>Open the project</Link>}
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
          {open && myBid && myBid.status === 'waiting' && (
            <form action={withdrawBid}><input type="hidden" name="listing_id" value={l.id} /><button className="btn ghost" type="submit">Withdraw my bid</button></form>
          )}
          {!open && !myBid && <p className="muted">This project is no longer taking bids.</p>}
        </div>
      )}
    </>
  );
}
