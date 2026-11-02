import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { JOB_TYPES, requireMarketplace } from '@/lib/marketplace';
import { aiConfigured } from '@/lib/marketplaceAI';
import MarketplacePost from '@/components/MarketplacePost';

export default async function NewListing({ searchParams }: { searchParams: { error?: string } }) {
  requireMarketplace();
  const { user } = await requireUser();
  const { data: mem } = await supabaseAdmin().from('company_members').select('company_id').eq('user_id', user.id).limit(1);
  if ((mem ?? []).length > 0) redirect('/marketplace?error=Contractors+bid+on+projects.+Homeowners+post+them.');
  return (
    <>
      <div className="stack">
        <Link href="/marketplace" className="small">‹ Marketplace</Link>
        <h1>Post a project</h1>
        <p className="muted">Pick what you want done, and local contractors can send you bids.</p>
      </div>
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}
      <MarketplacePost types={JOB_TYPES} aiOn={aiConfigured()} />
    </>
  );
}
