import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireMarketplace } from '@/lib/marketplace';
import { signedUrls } from '@/lib/companyProfile';
import { DESIGN_BUCKET, designEnabled, spaceLabel } from '@/lib/designIdeas';
import { deleteDesign } from '../actions';
import { finderLinks, shopItems, storesFor } from '@/lib/shopLook';

export const dynamic = 'force-dynamic';

export default async function DesignResult({ params, searchParams }: { params: { id: string }; searchParams: { zip?: string } }) {
  requireMarketplace();
  if (!designEnabled() || !/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const { user } = await requireUser();
  const { data: d } = await supabaseAdmin().from('design_ideas').select('*').eq('id', params.id).eq('user_id', user.id).maybeSingle<any>();
  if (!d) notFound();
  const results = (d.results ?? []) as string[];
  const urls = await signedUrls(DESIGN_BUCKET, [d.original_path as string, ...results]);
  const items = shopItems(d.space as string, (d.picks ?? {}) as Record<string, string>);
  let zip = /^\d{5}$/.test(searchParams.zip ?? '') ? (searchParams.zip as string) : '';
  if (!zip) {
    const { data: pr } = await supabaseAdmin().from('profiles').select('*').eq('id', user.id).maybeSingle<any>();
    zip = (pr?.zip as string | null) ?? '';
    if (!zip) {
      const { data: ls } = await supabaseAdmin().from('marketplace_listings').select('zip').eq('homeowner_id', user.id).order('created_at', { ascending: false }).limit(1);
      zip = ((ls ?? []) as any[])[0]?.zip ?? '';
    }
  }
  const picks = Object.entries((d.picks ?? {}) as Record<string, string>).filter(([, v]) => !/^keep/i.test(v));
  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Link href="/design" className="small">‹ Design ideas</Link>
      <h1>{spaceLabel(d.space)} ideas</h1>
      <p className="muted small" style={{ margin: 0 }}>AI ideas, not a plan, not a price. Real work depends on what is behind the walls.</p>
      {results.map((p, i) => (
        <figure key={p} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {urls.get(p) ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={urls.get(p)} alt={`AI idea ${i + 1}`} style={{ width: '100%', borderRadius: 16 }} /> : null}
          <figcaption className="muted small">Idea {i + 1} · {d.style || 'Your choices'} · AI idea{picks.length ? ` · changed only: ${picks.map(([k, v]) => `${k.toLowerCase()} ${v.toLowerCase()}`).join(', ')}` : ''}</figcaption>
          <Link className="btn" href={`/marketplace/new?idea=${d.id}&pick=${i}`}>Start a project with this one →</Link>
        </figure>
      ))}
      {items.length ? (
        <section className="card shop" aria-label="Shop this look">
          <h2>Shop this look</h2>
          <p className="muted small">Similar items to the ones in these ideas. Ideas only. Not a quote or an order. Colors and sizes can look different in your home, so check a real sample.</p>
          {items.map((it) => (
            <details key={`${it.label}-${it.desc}`} className="shop-it">
              <summary>
                <span className="shop-sw" style={{ background: it.swatch }} aria-hidden="true" />
                <span className="shop-tx"><b>{it.label}</b><span className="muted small">{it.desc}</span></span>
                <span className="shop-go">Find ›</span>
              </summary>
              <div className="shop-st">
                <span className="muted small">Search for something similar at:</span>
                <div className="chips">
                  {storesFor(it).map((s) => <a key={s.name} className="shop-chip" href={s.url} target="_blank" rel="noopener noreferrer">{s.name} ↗</a>)}
                </div>
              </div>
            </details>
          ))}
          <div className="shop-find">
            <b>Find a store near you</b>
            <form method="get" className="row" style={{ alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
              <label className="muted small" htmlFor="shopzip">ZIP</label>
              <input id="shopzip" name="zip" inputMode="numeric" maxLength={5} pattern="[0-9]{5}" defaultValue={zip} placeholder="75074" style={{ width: 96 }} />
              <button className="btn ghost" type="submit">Update</button>
            </form>
            {zip ? (
              <div className="chips">
                {finderLinks(zip).map((s) => <a key={s.name} className="shop-chip" href={s.url} target="_blank" rel="noopener noreferrer">{s.name} ↗</a>)}
              </div>
            ) : <span className="muted small">Enter your ZIP to see store links.</span>}
            <span className="muted small">These open the closest locations on a map. Jobfile does not know what a store has in stock. Links open other websites.</span>
          </div>
        </section>
      ) : null}
      {urls.get(d.original_path as string) ? (
        <details>
          <summary className="small">See your original photo</summary>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urls.get(d.original_path as string)} alt="Your original photo" style={{ width: '100%', borderRadius: 16, marginTop: 8 }} />
        </details>
      ) : null}
      {picks.length ? <p className="muted small" style={{ margin: 0 }}>You asked for: {picks.map(([k, v]) => `${k.toLowerCase()} ${v.toLowerCase()}`).join(', ')}.</p> : null}
      <Link className="btn ghost" href="/design">Try another look</Link>
      <form action={deleteDesign}><input type="hidden" name="id" value={d.id} /><button className="btn ghost" type="submit">Delete these ideas</button></form>
    </div>
  );
}
