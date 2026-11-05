import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { dollars } from '@/lib/money';
import { listingOpen, listingTitle, requireMarketplace, type Listing } from '@/lib/marketplace';
import { companyOf, isVerified } from '@/lib/team';
import { createTeamBid } from '@/app/collaborate/actions';

export const dynamic = 'force-dynamic';

export default async function BidAsTeam({ params, searchParams }: { params: { id: string }; searchParams: { error?: string; q?: string; partner?: string } }) {
  requireMarketplace();
  const { user } = await requireUser();
  const db = supabaseAdmin();
  const { data: l } = await db.from('marketplace_listings').select('*').eq('id', params.id).maybeSingle<Listing>();
  if (!l) notFound();
  const me = await companyOf(user.id);
  if (!me || l.homeowner_id === user.id) redirect(`/marketplace/${params.id}`);
  const open = listingOpen(l);
  const base = `/marketplace/${l.id}/team`;
  const verified = await isVerified(me!.id);

  const q = (searchParams.q ?? '').trim().slice(0, 60);
  let chosen: { id: string; name: string } | null = null;
  if (searchParams.partner && searchParams.partner !== me!.id) {
    const { data: c } = await db.from('companies').select('id,name,verified_at,hidden_at').eq('id', searchParams.partner).maybeSingle<any>();
    if (c?.verified_at && !c?.hidden_at) chosen = { id: c.id, name: c.name };
  }
  let found: { id: string; name: string; open: boolean }[] = [];
  let past: { id: string; name: string }[] = [];
  if (!chosen) {
    try {
      let query = db.from('companies').select('id,name,open_to_partner').not('verified_at', 'is', null).is('hidden_at', null).neq('id', me!.id).limit(10);
      if (q.length >= 2) query = query.ilike('name', `%${q.replace(/[%_]/g, '')}%`);
      else query = query.eq('open_to_partner', true);
      const { data } = await query;
      found = ((data ?? []) as any[]).map((c) => ({ id: c.id, name: c.name, open: !!c.open_to_partner }));
      const { data: mine } = await db.from('team_bids').select('id').eq('lead_company_id', me!.id).eq('status', 'sent');
      const ids = (mine ?? []).map((x: any) => x.id as string);
      if (ids.length) {
        const { data: ps } = await db.from('team_partners').select('company_id').in('team_bid_id', ids).eq('status', 'confirmed');
        const cids = Array.from(new Set((ps ?? []).map((x: any) => x.company_id as string)));
        if (cids.length) {
          const { data: cs } = await db.from('companies').select('id,name').in('id', cids).not('verified_at', 'is', null).is('hidden_at', null);
          past = ((cs ?? []) as any[]).map((c) => ({ id: c.id, name: c.name }));
        }
      }
    } catch { /* team tables not created yet */ }
  }

  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Link href={`/marketplace/${l.id}`} className="small" style={{ fontWeight: 700 }}>‹ Back to the project</Link>
      <h1>Bid as a team</h1>
      <p className="muted">{listingTitle(l)} · {l.city ? `${l.city}, ` : ''}TX {l.zip}</p>
      <p className="muted">Add a partner for the part you do not cover. You stay the lead and the homeowner’s contact. Your partner confirms their price before anything goes to the homeowner.</p>
      {searchParams.error ? <div className="box warn" role="alert">{searchParams.error}</div> : null}
      {!open ? <div className="box warn">This project is no longer taking bids.</div> : null}
      {!verified ? <div className="box warn">Your company needs to be verified by Jobfile before it can lead a team bid.</div> : null}

      {!chosen ? (
        <>
          <h2>1. Pick your partner</h2>
          <form method="get" className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
            <input name="q" defaultValue={q} placeholder="Search by company name" aria-label="Company name" style={{ flex: 1 }} />
            <button className="btn" type="submit">Search</button>
          </form>
          {past.length > 0 ? <><span className="muted small">Past partners</span>{past.map((c) => <Link key={c.id} className="card" href={`${base}?partner=${c.id}`} style={{ fontWeight: 700 }}>{c.name} ›</Link>)}</> : null}
          <span className="muted small">{q.length >= 2 ? 'Verified companies matching your search' : 'Verified companies open to partnering'}</span>
          {found.length === 0 ? <div className="card"><p className="muted">{q.length >= 2 ? `No verified companies match “${q}”.` : 'No one has turned on “Open to partnering” yet. Search by company name.'}</p></div> : null}
          {found.map((c) => (
            <Link key={c.id} className="card row" href={`${base}?partner=${c.id}`} style={{ justifyContent: 'space-between' }}><b>{c.name}</b>{c.open ? <span className="pill ok">Open to partnering</span> : <span className="muted small">Verified</span>}</Link>
          ))}
          <p className="muted small">Only companies verified by Jobfile can join a team bid. Not on the list? Ask them to join Jobfile and get verified.</p>
        </>
      ) : (
        <form action={createTeamBid} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="hidden" name="listing_id" value={l.id} />
          <input type="hidden" name="partner_id" value={chosen.id} />
          <div className="card row" style={{ justifyContent: 'space-between' }}><span><span className="muted small">Your partner</span><br /><b>{chosen.name}</b></span><Link href={base} style={{ fontWeight: 700 }}>Change</Link></div>
          <h2>Your part</h2>
          <label className="fld">Your price ($)<input name="price" required inputMode="decimal" placeholder="2200" /></label>
          <h2>{chosen.name}’s part</h2>
          <label className="fld">What they will do<input name="partner_scope" required maxLength={300} placeholder="Drywall repair, texture" /></label>
          <label className="fld">Their price ($)<input name="partner_price" required inputMode="decimal" placeholder="650" /></label>
          <span className="muted small">They can confirm this price or propose a different one.</span>
          <h2>The bid</h2>
          <div className="grid2">
            <label className="fld">How many weeks?<input name="weeks" inputMode="numeric" placeholder="3" /></label>
            <label className="fld">Earliest start date<input name="start_date" type="date" /></label>
          </div>
          <label className="fld">What is included (permits, materials…)<textarea name="inclusions" rows={2} maxLength={500} /></label>
          <label className="fld">Note to the homeowner<textarea name="note" rows={3} maxLength={1000} placeholder="No phone numbers or emails. You can talk once the homeowner accepts." /></label>
          <p className="muted small">The homeowner sees one team bid with both companies, each part, and each company’s rating and insurance. Payments stay between the homeowner and you; Jobfile only records them.</p>
          <button className="btn" type="submit" disabled={!open || !verified}>Invite {chosen.name} and hold the bid</button>
        </form>
      )}
    </div>
  );
}
