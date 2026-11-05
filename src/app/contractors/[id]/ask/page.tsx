import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { requireMarketplace } from '@/lib/marketplace';
import { supabaseAdmin } from '@/lib/supabase/server';
import { companyOf } from '@/lib/team';
import { inviteCandidates } from '@/lib/bidInvites';
import { askContractor } from '@/app/invitebid/actions';

export const dynamic = 'force-dynamic';

export default async function AskPage({ params, searchParams }: { params: { id: string }; searchParams: { error?: string } }) {
  requireMarketplace();
  const { user } = await requireUser();
  if (await companyOf(user.id)) redirect(`/contractors/${params.id}`);
  const { data: c } = await supabaseAdmin().from('companies').select('id,name,hidden_at').eq('id', params.id).maybeSingle<any>();
  if (!c || c.hidden_at) notFound();
  const cands = await inviteCandidates(user.id, c.id);
  return (
    <div className="stack">
      <Link href={`/contractors/${c.id}`} className="small">‹ {c.name}</Link>
      <h1>Ask {c.name} a question</h1>
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}
      <form action={askContractor} className="card stack">
        <input type="hidden" name="company_id" value={c.id} />
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <legend style={{ fontWeight: 700, padding: 0, marginBottom: 6 }}>What is it about?</legend>
          <label className="row" style={{ gap: 10, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <input type="radio" name="listing_id" value="general" defaultChecked style={{ marginTop: 4 }} />
            <span><b>A general question</b><span className="muted small" style={{ display: 'block' }}>No project needed. For example: do you do this kind of work, or when are you free?</span></span>
          </label>
          {cands.map((p) => (
            <label key={p.id} className="row" style={{ gap: 10, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <input type="radio" name="listing_id" value={p.id} style={{ marginTop: 4 }} />
              <span><b>{p.title}</b><span className="muted small" style={{ display: 'block' }}>ZIP {p.zip} · {p.bids} bid{p.bids === 1 ? '' : 's'}</span></span>
            </label>
          ))}
        </fieldset>
        <label className="stack" style={{ gap: 6 }}>
          <b>Your question</b>
          <textarea name="body" required maxLength={1000} rows={4} placeholder="Do you do this kind of work? When could you start?" />
        </label>
        <p className="small muted">Phone numbers, emails and web links are blocked until a bid is accepted. A general question is not a bid request. To get a price, post a project.</p>
        <button className="btn" type="submit">Send question</button>
      </form>
    </div>
  );
}
