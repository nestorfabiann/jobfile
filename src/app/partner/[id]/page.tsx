import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { dollars } from '@/lib/money';
import { companyOf } from '@/lib/team';
import { partnerFor, PSTATUS } from '@/lib/partners';
import { answerPartner } from '../actions';
import PartnerThread, { type PMsg } from '@/components/PartnerThread';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Partner job · Jobfile' };

/** What a partner sees: their own part of the job and nothing about the homeowner's contact details or the total. */
export default async function PartnerJob({ params, searchParams }: { params: { id: string }; searchParams: { error?: string; ok?: string } }) {
  const { user } = await requireUser();
  const me = await companyOf(user.id);
  const p = await partnerFor(user.id, me?.id ?? null, params.id);
  if (!p) redirect('/collaborate');
  const db = supabaseAdmin();
  const [{ data: proj }, { data: lead }, { data: ms }] = await Promise.all([
    db.from('projects').select('name,address').eq('id', p.project_id).maybeSingle<any>(),
    db.from('companies').select('name').eq('id', p.lead_company_id).maybeSingle<any>(),
    db.from('partner_messages').select('id,sender_side,body,created_at').eq('partner_id', p.id).order('created_at').limit(200),
  ]);
  const leadName = (lead?.name as string | undefined) ?? 'The lead';
  const answerable = p.status === 'invited' || p.status === 'countered';
  const price = p.status === 'countered' && p.counter_cents ? p.counter_cents : p.price_cents;
  const on = p.status === 'accepted';
  const open = ['invited', 'countered', 'accepted'].includes(p.status);
  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 90 }}>
      <Link href="/collaborate" className="small" style={{ fontWeight: 700 }}>‹ Collaborate</Link>
      <h1>{on ? (proj?.name ?? 'Job') : `${leadName} invited you to a job`}</h1>
      {searchParams.error ? <div className="box warn" role="alert">{searchParams.error}</div> : null}
      {searchParams.ok ? <div className="box ok" role="status">{searchParams.ok}</div> : null}
      {!open ? <div className="box">You are no longer on this job ({PSTATUS[p.status].toLowerCase()}).</div> : null}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted small">Your part</span><span className={`pill${on ? ' ok' : ''}`}>{PSTATUS[p.status]}</span></div>
        <b>{p.scope}</b>
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted small">Your price</span><b style={{ fontSize: 22 }}>{dollars(price)}</b></div>
        {p.start_date || p.end_date ? <span className="muted small">Dates: {p.start_date ?? '…'} to {p.end_date ?? '…'}</span> : null}
        {p.status === 'countered' ? <span className="pill warn" style={{ width: 'max-content' }}>You proposed a new price. Waiting for {leadName}.</span> : null}
        {on && p.paid_cents > 0 ? <span className="muted small">Paid so far: {dollars(p.paid_cents)} of {dollars(p.price_cents)} (recorded by {leadName})</span> : null}
        {on && proj?.address ? <span className="muted small">Job address: {proj.address}</span> : null}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="muted small">The lead</span>
        <b>{leadName} <span className="pill">Lead</span></b>
        <Link href={`/contractors/${p.lead_company_id}`} className="small" style={{ fontWeight: 700 }}>View profile ›</Link>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <b>What stays private</b>
        <span className="muted small">The homeowner’s phone and email, the total price, and other partners’ prices. {leadName} stays the contact for the whole job.</span>
      </div>

      {answerable && p.status === 'invited' ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!me ? <div className="box warn">You need a company on Jobfile to accept. Add it in <Link href="/settings/business">Business profile</Link>, then come back here.</div> : null}
          <form action={answerPartner}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="answer" value="accept" /><button className="btn" type="submit" disabled={!me}>Accept at {dollars(p.price_cents)}</button></form>
          <form action={answerPartner} className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
            <input type="hidden" name="id" value={p.id} /><input type="hidden" name="answer" value="counter" />
            <input name="price" inputMode="decimal" placeholder="Your price" aria-label="Your price" style={{ flex: 1 }} required />
            <button className="btn ghost" type="submit" disabled={!me}>Change price</button>
          </form>
          <form action={answerPartner}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="answer" value="decline" /><button className="btn ghost" type="submit">Decline</button></form>
        </div>
      ) : null}

      {open ? <PartnerThread id={p.id} msgs={(ms ?? []) as PMsg[]} me="partner" other={leadName} /> : null}
    </div>
  );
}
