import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireMarketplace } from '@/lib/marketplace';
import { signedUrls } from '@/lib/companyProfile';
import { DESIGN_BUCKET, designEnabled, SPACES } from '@/lib/designIdeas';
import { deleteDesign } from '../actions';

export const dynamic = 'force-dynamic';

export default async function DesignResult({ params }: { params: { id: string } }) {
  requireMarketplace();
  if (!designEnabled() || !/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const { user } = await requireUser();
  const { data: d } = await supabaseAdmin().from('design_ideas').select('*').eq('id', params.id).eq('user_id', user.id).maybeSingle<any>();
  if (!d) notFound();
  const results = (d.results ?? []) as string[];
  const urls = await signedUrls(DESIGN_BUCKET, [d.original_path as string, ...results]);
  const picks = Object.entries((d.picks ?? {}) as Record<string, string>).filter(([, v]) => !/^keep/i.test(v));
  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Link href="/design" className="small">‹ Design ideas</Link>
      <h1>{SPACES[d.space as keyof typeof SPACES]} ideas</h1>
      <p className="muted small" style={{ margin: 0 }}>AI ideas, not a plan, not a price. Real work depends on what is behind the walls.</p>
      {results.map((p, i) => (
        <figure key={p} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {urls.get(p) ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={urls.get(p)} alt={`AI idea ${i + 1}`} style={{ width: '100%', borderRadius: 16 }} /> : null}
          <figcaption className="muted small">Idea {i + 1} · {d.style || 'Your choices'} · AI idea</figcaption>
        </figure>
      ))}
      {urls.get(d.original_path as string) ? (
        <details>
          <summary className="small">See your original photo</summary>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urls.get(d.original_path as string)} alt="Your original photo" style={{ width: '100%', borderRadius: 16, marginTop: 8 }} />
        </details>
      ) : null}
      {picks.length ? <p className="muted small" style={{ margin: 0 }}>You asked for: {picks.map(([k, v]) => `${k.toLowerCase()} ${v.toLowerCase()}`).join(', ')}.</p> : null}
      <Link className="btn" href={`/marketplace/new?idea=${d.id}`}>Start a project from this idea →</Link>
      <Link className="btn ghost" href="/design">Try another look</Link>
      <form action={deleteDesign}><input type="hidden" name="id" value={d.id} /><button className="btn ghost" type="submit">Delete these ideas</button></form>
    </div>
  );
}
