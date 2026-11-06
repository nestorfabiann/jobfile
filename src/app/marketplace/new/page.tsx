import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { JOB_TYPES, requireMarketplace } from '@/lib/marketplace';
import { cleanDraft } from '@/lib/drafts';
import { aiConfigured } from '@/lib/marketplaceAI';
import { designEnabled } from '@/lib/designIdeas';
import MarketplacePost from '@/components/MarketplacePost';

export default async function NewListing({ searchParams }: { searchParams: { error?: string; draft?: string; like?: string; invite?: string; idea?: string } }) {
  requireMarketplace();
  const { user } = await requireUser();
  const { data: mem } = await supabaseAdmin().from('company_members').select('company_id').eq('user_id', user.id).limit(1);
  if ((mem ?? []).length > 0) redirect('/marketplace?error=Contractors+bid+on+projects.+Homeowners+post+them.');
  let draft: { id: string; at: string; data: ReturnType<typeof cleanDraft> } | null = null;
  if (searchParams.draft && /^[0-9a-f-]{36}$/i.test(searchParams.draft)) {
    const { data: d } = await supabaseAdmin().from('marketplace_drafts').select('id,data,updated_at').eq('id', searchParams.draft).eq('user_id', user.id).maybeSingle();
    if (d) draft = { id: d.id as string, at: d.updated_at as string, data: cleanDraft(d.data) };
  }
  // "Start a project like this" from Community: pick the kind of work and add a note about the post.
  if (!draft && searchParams.like && /^[0-9a-f-]{36}$/i.test(searchParams.like)) {
    try {
      const { data: lp } = await supabaseAdmin().from('community_posts').select('title,trade,city,status').eq('id', searchParams.like).maybeSingle();
      if (lp && lp.status === 'live') draft = { id: '', at: new Date().toISOString(), data: cleanDraft({ type: lp.trade, city: lp.city, details: `I would like something like this: ${lp.title}` }) };
    } catch { /* community tables not created yet */ }
  }
  // "Start a project from this idea" on Design ideas: pick the room and carry the choices into the details.
  if (!draft && designEnabled() && /^[0-9a-f-]{36}$/i.test(searchParams.idea ?? '')) {
    try {
      const { data: di } = await supabaseAdmin().from('design_ideas').select('space,style,picks,notes').eq('id', searchParams.idea as string).eq('user_id', user.id).maybeSingle<any>();
      if (di) {
        const ch = Object.entries((di.picks ?? {}) as Record<string, string>).filter(([, v]) => !/^keep/i.test(v)).map(([k, v]) => `${k.toLowerCase()} ${v.toLowerCase()}`);
        const details = `I tried an AI design idea${di.style ? ` (${di.style} style)` : ''}${ch.length ? `: ${ch.join(', ')}` : ''}.${di.notes ? ` ${di.notes}` : ''}`;
        draft = { id: '', at: new Date().toISOString(), data: cleanDraft({ type: di.space === 'bathroom' ? 'Bathroom' : 'Kitchen remodel', details }) };
      }
    } catch { /* design table not created yet */ }
  }
  // Coming from a contractor's profile: say who will be invited.
  let inviteId: string | undefined;
  let inviteName = '';
  if (/^[0-9a-f-]{36}$/i.test(searchParams.invite ?? '')) {
    const { data: ic } = await supabaseAdmin().from('companies').select('id,name,hidden_at').eq('id', searchParams.invite as string).maybeSingle<any>();
    if (ic && !ic.hidden_at) { inviteId = ic.id as string; inviteName = ic.name as string; }
  }
  return (
    <>
      <div className="stack">
        <Link href="/marketplace" className="small">‹ Marketplace</Link>
        <h1>Post a project</h1>
        <p className="muted">Pick what you want done, and local contractors can send you bids.</p>
      </div>
      {designEnabled() ? (
        <Link href="/design" className="box" style={{ background: 'var(--accent-soft, #f9efe4)', display: 'block' }}>
          <b>Not sure what you want?</b>
          <span className="small" style={{ display: 'block' }}>Add a photo of your kitchen or bathroom and see AI design ideas first. →</span>
        </Link>
      ) : null}
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}
      {inviteId ? (
        <div className="box" style={{ background: 'var(--accent-soft, #f9efe4)' }}>
          <b>You will invite {inviteName} to bid when you post.</b>
          <span className="small" style={{ display: 'block' }}>Other local contractors can still bid on your project. {inviteName} must serve your ZIP code to be invited.</span>
        </div>
      ) : null}
      <MarketplacePost types={JOB_TYPES} aiOn={aiConfigured()} draft={draft} inviteCompany={inviteId} inviteName={inviteName} />
    </>
  );
}
