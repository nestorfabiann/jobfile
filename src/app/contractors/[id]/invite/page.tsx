import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { requireMarketplace } from '@/lib/marketplace';
import { supabaseAdmin } from '@/lib/supabase/server';
import { companyOf } from '@/lib/team';
import { inviteCandidates } from '@/lib/bidInvites';
import { sendBidInvite } from '@/app/invitebid/actions';

export const dynamic = 'force-dynamic';

export default async function InvitePage({ params, searchParams }: { params: { id: string }; searchParams: { error?: string } }) {
  requireMarketplace();
  const { user } = await requireUser();
  if (await companyOf(user.id)) redirect(`/contractors/${params.id}`);
  const { data: c } = await supabaseAdmin().from('companies').select('id,name,hidden_at').eq('id', params.id).maybeSingle<any>();
  if (!c || c.hidden_at) notFound();
  const cands = await inviteCandidates(user.id, c.id);
  return (
    <div className="stack">
      <Link href={`/contractors/${c.id}`} className="small">‹ {c.name}</Link>
      <h1>Invite {c.name} to bid</h1>
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}
      {cands.length === 0 ? (
        <div className="card stack">
          <p>You have no open project this contractor can bid on. Post one and invite them.</p>
          <Link className="btn" href={`/marketplace/new?invite=${c.id}`}>Start a project and invite them</Link>
        </div>
      ) : (
        <form action={sendBidInvite} className="card stack">
          <input type="hidden" name="company_id" value={c.id} />
          <label className="stack" style={{ gap: 6 }}>
            <b>Which project?</b>
            {cands.map((p, i) => (
              <label key={p.id} className="row" style={{ gap: 10, flexWrap: 'nowrap', alignItems: 'center' }}>
                <input type="radio" name="listing_id" value={p.id} defaultChecked={i === 0} />
                <span>{p.title} <span className="muted small">· ZIP {p.zip} · {p.bids} bid{p.bids === 1 ? '' : 's'} · {p.daysLeft} days left</span></span>
              </label>
            ))}
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <b>Add a note <span className="muted small">(optional)</span></b>
            <textarea name="note" maxLength={300} rows={3} placeholder="Why you picked them, or when you would like to start" />
          </label>
          <p className="small muted">Contact details stay private. Do not add a phone number, email or link. They are shared only after you accept a bid.</p>
          <button className="btn" type="submit">Send invite</button>
        </form>
      )}
    </div>
  );
}
