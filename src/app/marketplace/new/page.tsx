import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { JOB_TYPES, requireMarketplace } from '@/lib/marketplace';
import { cleanDraft } from '@/lib/drafts';
import { aiConfigured } from '@/lib/marketplaceAI';
import { designEnabled, DESIGN_BUCKET, SPACE_JOB, spaceLabel, ideaItems } from '@/lib/designIdeas';
import { signedUrls } from '@/lib/companyProfile';
import MarketplacePost from '@/components/MarketplacePost';

export default async function NewListing({ searchParams }: { searchParams: { error?: string; draft?: string; like?: string; invite?: string; idea?: string; pick?: string } }) {
  requireMarketplace();
  const { user } = await requireUser();
  const { data: mem } = await supabaseAdmin().from('company_members').select('company_id').eq('user_id', user.id).limit(1);
  if ((mem ?? []).length > 0) redirect('/marketplace?error=Contractors+bid+on+projects.+Homeowners+post+them.');
  let ideaPicks: string[] = [];
  let ideaCard: { id: string; pick: number; thumb: string | null; label: string; blurb: string } | null = null;
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
        ideaPicks = ideaItems(di.space, (di.picks ?? {}) as Record<string, string>);
        draft = { id: '', at: new Date().toISOString(), data: cleanDraft({ type: SPACE_JOB[di.space as keyof typeof SPACE_JOB] ?? 'Painting', details, picks: ideaPicks }) };
        const pickN = Math.max(0, Math.min(1, parseInt(searchParams.pick ?? '0', 10) || 0));
        const { data: full } = await supabaseAdmin().from('design_ideas').select('results').eq('id', searchParams.idea as string).maybeSingle<any>();
        const rp = ((full?.results ?? []) as string[])[pickN] ?? ((full?.results ?? []) as string[])[0];
        const thumb = rp ? (await signedUrls(DESIGN_BUCKET, [rp])).get(rp) ?? null : null;
        ideaCard = { id: searchParams.idea as string, pick: pickN, thumb, label: `${spaceLabel(di.space)}${di.style ? ` · ${di.style}` : ''}`, blurb: ch.length ? ch.join(', ') : 'Your chosen look' };
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
  const { leadCompanies } = await import('@/lib/leadProtect');
  const leads = (await leadCompanies(user.email)).map((c) => ({ name: c.name, trades: c.trades }));
  return (
    <>
      <div className="stack ph-head">
        <Link href="/marketplace" className="ph-back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          Marketplace
        </Link>
        <div className="ph-ttl">
          <span className="ph-tile" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg></span>
          <h1>Post a project</h1>
        </div>
        <p className="muted ph-sub">Pick what you want done and local contractors can send you bids.</p>
        <div className="ph-steps" aria-label="Three short steps">
          <b className="on"><i>1</i>What</b><b><i>2</i>Details</b><b><i>3</i>Send</b>
        </div>
      </div>
      {designEnabled() && !ideaCard ? (
        <Link href="/design" className="box idea-card">
          <span className="idea-tile" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></svg></span>
          <span className="idea-txt"><b>Not sure what you want?</b><span className="small">Add a photo of a room or your home and see AI design ideas first.</span></span>
          <span className="idea-go" aria-hidden="true">›</span>
        </Link>
      ) : null}
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}
      {inviteId ? (
        <div className="box" style={{ background: 'var(--accent-soft, #f9efe4)' }}>
          <b>You will invite {inviteName} to bid when you post.</b>
          <span className="small" style={{ display: 'block' }}>Other local contractors can still bid on your project. {inviteName} must serve your ZIP code to be invited.</span>
        </div>
      ) : null}
      <MarketplacePost leads={leads} ideaPicks={ideaPicks} idea={ideaCard} types={JOB_TYPES} aiOn={aiConfigured()} draft={draft} inviteCompany={inviteId} inviteName={inviteName} />
    </>
  );
}
