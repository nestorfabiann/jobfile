import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireMarketplace } from '@/lib/marketplace';
import { signedUrls } from '@/lib/companyProfile';
import { DESIGN_BUCKET, designEnabled, PICKS, SPACES, STYLES } from '@/lib/designIdeas';
import DesignForm from '@/components/DesignForm';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function Design({ searchParams }: { searchParams: { error?: string } }) {
  requireMarketplace();
  if (!designEnabled()) notFound();
  const { user } = await requireUser();
  const db = supabaseAdmin();
  const { data: mem } = await db.from('company_members').select('company_id').eq('user_id', user.id).limit(1);
  if ((mem ?? []).length > 0) redirect('/marketplace');
  const { data: rows } = await db.from('design_ideas').select('id,space,style,results,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(6);
  const past = (rows ?? []) as { id: string; space: keyof typeof SPACES; style: string; results: string[]; created_at: string }[];
  const urls = await signedUrls(DESIGN_BUCKET, past.map((p) => p.results[0]).filter(Boolean));
  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h1>Design ideas</h1>
      <p className="muted">Add a photo of your kitchen or bathroom and see new looks. Then start a project from the one you like.</p>
      {searchParams.error ? <div className="box bad" role="alert">{searchParams.error}</div> : null}
      <DesignForm picks={PICKS} styles={[...STYLES]} />
      {past.length > 0 ? (
        <section className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Your ideas</h2>
          {past.map((p) => (
            <Link key={p.id} href={`/design/${p.id}`} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {urls.get(p.results[0]) ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={urls.get(p.results[0])} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 12 }} /> : null}
              <span><b>{SPACES[p.space]}</b><br /><span className="muted small">{p.style} · {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></span>
            </Link>
          ))}
        </section>
      ) : null}
    </div>
  );
}
