import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { requireMarketplace, listingOpen, listingTitle } from '@/lib/marketplace';
import { supabaseAdmin } from '@/lib/supabase/server';
import { companyOf } from '@/lib/team';
import { replyInvite, declineInvite, suggestPost } from '@/app/invitebid/actions';
import type { BidInvite, InviteMsg } from '@/lib/bidInvites';

export const dynamic = 'force-dynamic';

export default async function InviteThread({ params, searchParams }: { params: { id: string; inviteId: string }; searchParams: { ok?: string; error?: string } }) {
  requireMarketplace();
  const { user } = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(params.inviteId)) notFound();
  const general = params.id === 'general';
  if (!general && !/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const db = supabaseAdmin();
  const iq = db.from('bid_invites').select('*').eq('id', params.inviteId);
  const { data: inv } = await (general ? iq.is('listing_id', null) : iq.eq('listing_id', params.id)).maybeSingle<BidInvite>();
  if (!inv) notFound();
  const me = await companyOf(user.id);
  const side = inv.homeowner_id === user.id ? 'homeowner' : me && me.id === inv.company_id ? 'contractor' : null;
  if (!side) notFound();
  const { data: l } = inv.listing_id ? await db.from('marketplace_listings').select('id,job_type,items,status,expires_at,zip').eq('id', inv.listing_id).maybeSingle<any>() : { data: null as any };
  if (inv.listing_id && !l) notFound();
  const { data: co } = await db.from('companies').select('name').eq('id', inv.company_id).maybeSingle<any>();
  const { data: ms } = await db.from('invite_messages').select('id,sender_side,body,created_at').eq('invite_id', inv.id).order('created_at');
  const msgs = (ms ?? []) as InviteMsg[];
  const live = (!l || listingOpen(l)) && inv.status !== 'declined';
  const homeSent = msgs.some((m) => m.sender_side === 'homeowner');
  const theySent = msgs.some((m) => m.sender_side === 'contractor');
  const waitingReply = side === 'homeowner' && !l && homeSent && !theySent;
  const other = side === 'homeowner' ? (co?.name ?? 'The contractor') : 'The homeowner';
  return (
    <div className="stack">
      {l ? <Link href={`/marketplace/${l.id}`} className="small">‹ {listingTitle(l)}</Link> : <Link href={side === 'homeowner' ? `/contractors/${inv.company_id}` : '/marketplace'} className="small">‹ {side === 'homeowner' ? (co?.name ?? 'Contractor') : 'Marketplace'}</Link>}
      <h1>{side === 'homeowner' ? co?.name ?? 'Contractor' : 'Homeowner question'}</h1>
      <p className="muted small">{l ? `About ${listingTitle(l)} · ZIP ${l.zip}` : 'General question. Not about a posted project, and not a bid request.'}{inv.status === 'declined' ? ' · Passed' : ''}</p>
      {searchParams.ok ? <div className="box ok">{searchParams.ok}</div> : null}
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}
      {inv.note ? <div className="box"><b>Invite note:</b> &ldquo;{inv.note}&rdquo;</div> : null}
      <div className="card stack" id="messages" style={{ gap: 10 }}>
        {msgs.length === 0 ? <p className="muted">No messages yet.</p> : msgs.map((m) => (
          <div key={m.id} style={{ alignSelf: m.sender_side === side ? 'flex-end' : 'flex-start', maxWidth: '85%', background: m.sender_side === side ? 'var(--accent-soft, #f9efe4)' : 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '8px 12px' }}>
            <div className="small muted">{m.sender_side === side ? 'You' : other}</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
          </div>
        ))}
      </div>
      {!l && side === 'homeowner' && live ? (
        <div className="box" style={{ background: 'var(--accent-soft, #f9efe4)' }}>
          <b>Ready for a price?</b> Post your project and invite {co?.name ?? 'them'} to bid. This conversation moves with it.
          <div className="row" style={{ marginTop: 8 }}><Link className="btn" href={`/marketplace/new?invite=${inv.company_id}`}>Post a project</Link></div>
        </div>
      ) : null}
      {waitingReply ? <div className="box">You asked. {co?.name ?? 'They'} will see it and can reply. You can write again after they do.</div> : null}
      {live && !waitingReply ? (
        <form action={replyInvite} className="card stack">
          <input type="hidden" name="id" value={inv.id} />
          <textarea name="body" required maxLength={1000} rows={3} placeholder="Write a message" />
          <p className="small muted">Phone numbers, emails and web links are blocked until a bid is accepted.</p>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn" type="submit">Send</button>
          </div>
        </form>
      ) : waitingReply ? null : <div className="box">This conversation is closed.</div>}
      {live && side === 'contractor' && (
        <div className="row" style={{ gap: 10 }}>
          {l ? <Link className="btn ghost" href={`/marketplace/${l.id}#your-bid`}>Bid on this project</Link> : <form action={suggestPost}><input type="hidden" name="id" value={inv.id} /><button className="btn ghost" type="submit">Suggest posting a project</button></form>}
          <form action={declineInvite}><input type="hidden" name="id" value={inv.id} /><button className="btn ghost" type="submit">Pass on this one</button></form>
        </div>
      )}
    </div>
  );
}
