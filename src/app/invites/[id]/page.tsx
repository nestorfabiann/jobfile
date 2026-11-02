import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isExpired, loadInvite, MAX_SENDS } from '@/lib/invites';
import { acceptInvite, cancelInvite, declineInvite, resendInvite } from '../actions';

export const dynamic = 'force-dynamic';
const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' });

export default async function InvitePage({ params, searchParams }: { params: { id: string }; searchParams: { sent?: string; resent?: string; error?: string } }) {
  const { user, invite, side } = await loadInvite(params.id);
  if (!invite || !side) notFound();
  const expired = isExpired(invite);
  const open = invite.status === 'pending' && !expired;
  const status = expired ? 'Expired' : invite.status === 'pending' ? 'Waiting for the contractor' : invite.status === 'accepted' ? 'Accepted' : invite.status === 'declined' ? 'Declined' : 'Cancelled';

  let hasCompany = true;
  if (side === 'contractor' && open) {
    const { data: mem } = await supabaseAdmin().from('company_members').select('company_id').eq('user_id', user.id).limit(1);
    hasCompany = (mem ?? []).length > 0;
  }
  const from = invite.homeowner_name || 'A homeowner';

  return (
    <>
      <div className="stack">
        <Link href="/projects" className="small">‹ Projects</Link>
        <h1>{invite.project_name}</h1>
        <div className="row"><span className={`pill ${invite.status === 'accepted' ? 'ok' : open ? 'warn' : ''}`}>{status}</span></div>
      </div>
      {searchParams.sent ? <div className="box ok">Invite sent to {invite.contractor_email}.</div> : null}
      {searchParams.resent ? <div className="box ok">Invite sent again.</div> : null}
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}

      <div className="card">
        <h2>{side === 'contractor' ? `${from} invited you` : 'Your invitation'}</h2>
        {invite.address ? <p className="muted">{invite.address}</p> : null}
        {invite.is_homestead ? <p className="small"><span className="pill warn">Homestead job</span> Texas homestead contract rules apply.</p> : null}
        {invite.description ? <p style={{ whiteSpace: 'pre-wrap' }}>{invite.description}</p> : <p className="muted">No description yet.</p>}
        {invite.message ? <div className="reply"><b>{side === 'contractor' ? `Message from ${from}:` : 'Your message:'}</b> {invite.message}</div> : null}
        <p className="muted small">
          {side === 'homeowner' ? `Invited: ${invite.contractor_email}. ` : ''}
          {open ? `Expires ${when(invite.expires_at)}.` : ''}
        </p>
      </div>

      {side === 'contractor' && open && (
        <div className="card">
          <form action={acceptInvite} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input type="hidden" name="id" value={invite.id} />
            {!hasCompany && (
              <label className="fld">Your company name<input name="company_name" required maxLength={120} placeholder="Ridgeline Builders" autoComplete="organization" /></label>
            )}
            <p className="muted small">Accepting opens the project for both of you. You then write up the scope and price in the Agreement tab, and the homeowner approves it.</p>
            <div className="row"><button className="btn" type="submit">Accept and open the project</button></div>
          </form>
          <form action={declineInvite}><input type="hidden" name="id" value={invite.id} /><button className="btn ghost" type="submit">Decline</button></form>
        </div>
      )}

      {side === 'homeowner' && open && (
        <div className="card">
          <p className="muted small">Prices, the agreement and payments open after the contractor accepts. You can add photos once the project is open.</p>
          <div className="row">
            {invite.send_count < MAX_SENDS && (
              <form action={resendInvite}><input type="hidden" name="id" value={invite.id} /><button className="btn ghost" type="submit">Resend invite</button></form>
            )}
            <form action={cancelInvite}><input type="hidden" name="id" value={invite.id} /><button className="btn ghost" type="submit">Cancel invite</button></form>
          </div>
        </div>
      )}

      {invite.status === 'accepted' && invite.project_id && (
        <Link className="btn" href={`/projects/${invite.project_id}/overview`}>Open the project</Link>
      )}
      {side === 'homeowner' && !open && invite.status !== 'accepted' && <Link className="btn" href="/invites/new">Invite someone else</Link>}
    </>
  );
}
