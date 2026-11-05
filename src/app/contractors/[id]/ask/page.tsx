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
      {cands.length === 0 ? (
        <div className="card stack">
          <p>Questions are about one of your projects, so post it first. Then you can ask and invite them together.</p>
          <Link className="btn" href={`/marketplace/new?invite=${c.id}`}>Start a project and invite them</Link>
        </div>
      ) : (
        <form action={askContractor} className="card stack">
          <input type="hidden" name="company_id" value={c.id} />
          <label className="stack" style={{ gap: 6 }}>
            <b>About which project?</b>
            {cands.map((p, i) => (
              <label key={p.id} className="row" style={{ gap: 10, flexWrap: 'nowrap', alignItems: 'center' }}>
                <input type="radio" name="listing_id" value={p.id} defaultChecked={i === 0} />
                <span>{p.title} <span className="muted small">· ZIP {p.zip}</span></span>
              </label>
            ))}
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <b>Your question</b>
            <textarea name="body" required maxLength={1000} rows={4} placeholder="Do you do this kind of work? When could you start?" />
          </label>
          <p className="small muted">Contact details stay private. Do not add a phone number, email or link.</p>
          <button className="btn" type="submit">Send question</button>
        </form>
      )}
    </div>
  );
}
