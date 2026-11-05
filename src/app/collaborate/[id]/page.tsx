import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { dollars } from '@/lib/money';
import { listingTitle, requireMarketplace, scopeText, type Listing } from '@/lib/marketplace';
import { companyOf, type TeamBid, type TeamPartner } from '@/lib/team';
import { summarize, companyReviews } from '@/lib/reviews';
import { confirmPartner, counterPartner, declinePartner } from '../actions';

export const dynamic = 'force-dynamic';

export default async function Invite({ params, searchParams }: { params: { id: string }; searchParams: { error?: string } }) {
  requireMarketplace();
  const { user } = await requireUser();
  const me = await companyOf(user.id);
  const db = supabaseAdmin();
  const { data: p } = await db.from('team_partners').select('*').eq('id', params.id).maybeSingle<TeamPartner>();
  if (!me || !p || p.company_id !== me.id) redirect('/collaborate');
  const { data: tb } = await db.from('team_bids').select('*').eq('id', p.team_bid_id).maybeSingle<TeamBid>();
  if (!tb) redirect('/collaborate');
  const [{ data: l }, { data: lead }] = await Promise.all([
    db.from('marketplace_listings').select('*').eq('id', tb.listing_id).maybeSingle<Listing>(),
    db.from('companies').select('id,name').eq('id', tb.lead_company_id).maybeSingle(),
  ]);
  const s = summarize(await companyReviews(tb.lead_company_id));
  const answerable = tb.status === 'pending' && p.status === 'invited';

  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Link href="/collaborate" className="small" style={{ fontWeight: 700 }}>‹ Collaborate</Link>
      <h1>{(lead?.name as string | undefined) ?? 'A contractor'} invited you to a team bid</h1>
      {searchParams.error ? <div className="box warn" role="alert">{searchParams.error}</div> : null}
      {l ? <p className="muted">{listingTitle(l)} · {l.city ? `${l.city}, ` : ''}TX {l.zip}</p> : null}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="muted small">Your part</span>
        <b>{p.scope}</b>
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted small">Your price</span><b style={{ fontSize: 22 }}>{dollars(p.status === 'countered' && p.counter_cents ? p.counter_cents : p.price_cents)}</b></div>
        {p.status === 'countered' ? <span className="pill warn" style={{ width: 'max-content' }}>You proposed a new price. Waiting for the lead.</span> : null}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="muted small">The lead</span>
        <b>{(lead?.name as string | undefined) ?? 'A contractor'} <span className="pill ok">Lead</span></b>
        <span className="muted small">{s.count > 0 ? `★ ${s.avg.toFixed(1)} · ${s.count} finished project${s.count > 1 ? 's' : ''}` : 'No finished projects on Jobfile yet'}</span>
        <Link href={`/contractors/${tb.lead_company_id}`} className="small" style={{ fontWeight: 700 }}>View profile ›</Link>
      </div>

      {l ? <div className="card"><span className="muted small">The job</span><p className="small" style={{ whiteSpace: 'pre-wrap', margin: '4px 0 0' }}>{scopeText(l)}</p></div> : null}

      <div className="box" style={{ background: 'var(--accent-soft, #f9efe4)' }}>
        <b>What you will see:</b> the job scope, your part, the schedule and project photos. <b>What you will not see:</b> the homeowner’s contact details or the other company’s price, unless the lead shares them. One lead is accountable to the homeowner, and Jobfile records payments but does not move money.
      </div>

      {answerable ? (
        <>
          <form action={confirmPartner}><input type="hidden" name="partner_row_id" value={p.id} /><button className="btn" type="submit" style={{ width: '100%' }}>Confirm my part at {dollars(p.price_cents)}</button></form>
          <form action={counterPartner} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input type="hidden" name="partner_row_id" value={p.id} />
            <label className="fld">Change my price ($)<input name="price" inputMode="decimal" placeholder="700" /></label>
            <button className="btn ghost" type="submit">Send my new price</button>
            <span className="muted small">The lead has to accept it before the bid goes to the homeowner.</span>
          </form>
          <form action={declinePartner}><input type="hidden" name="partner_row_id" value={p.id} /><button className="btn ghost" type="submit" style={{ width: '100%' }}>Decline</button></form>
        </>
      ) : <div className="box">{tb.status !== 'pending' ? 'This invite is closed.' : p.status === 'confirmed' ? 'You confirmed this part.' : p.status === 'declined' ? 'You declined this invite.' : 'Waiting for the lead.'}</div>}
    </div>
  );
}
