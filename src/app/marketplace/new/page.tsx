import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { JOB_TYPES, requireMarketplace } from '@/lib/marketplace';
import { cleanDraft } from '@/lib/drafts';
import { aiConfigured } from '@/lib/marketplaceAI';
import MarketplacePost from '@/components/MarketplacePost';

export default async function NewListing({ searchParams }: { searchParams: { error?: string; draft?: string } }) {
  requireMarketplace();
  const { user } = await requireUser();
  const { data: mem } = await supabaseAdmin().from('company_members').select('company_id').eq('user_id', user.id).limit(1);
  if ((mem ?? []).length > 0) redirect('/marketplace?error=Contractors+bid+on+projects.+Homeowners+post+them.');
  let draft: { id: string; at: string; data: ReturnType<typeof cleanDraft> } | null = null;
  if (searchParams.draft && /^[0-9a-f-]{36}$/i.test(searchParams.draft)) {
    const { data: d } = await supabaseAdmin().from('marketplace_drafts').select('id,data,updated_at').eq('id', searchParams.draft).eq('user_id', user.id).maybeSingle();
    if (d) draft = { id: d.id as string, at: d.updated_at as string, data: cleanDraft(d.data) };
  }
  return (
    <>
      <div className="stack">
        <Link href="/marketplace" className="small">‹ Marketplace</Link>
        <h1>Post a project</h1>
        <p className="muted">Pick what you want done, and local contractors can send you bids.</p>
      </div>
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}
      <MarketplacePost types={JOB_TYPES} aiOn={aiConfigured()} draft={draft} />
    </>
  );
}
