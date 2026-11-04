import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { JOB_TYPES, requireMarketplace } from '@/lib/marketplace';
import { nearbyCards } from '@/lib/nearby';
import { saveZip } from '@/app/projects/zipActions';

export const dynamic = 'force-dynamic';

const pill = (on: boolean): React.CSSProperties => ({
  minHeight: 40, display: 'inline-flex', alignItems: 'center', padding: '0 14px', borderRadius: 999, fontSize: 14, fontWeight: 600,
  border: `1.5px solid ${on ? 'var(--brand)' : 'var(--line)'}`, background: on ? 'var(--brand)' : 'var(--surface)', color: on ? '#fff' : 'var(--ink)',
});

export default async function Find({ searchParams }: { searchParams: { trade?: string; zip_error?: string } }) {
  requireMarketplace();
  const { user } = await requireUser();
  const { data: pr } = await supabaseAdmin().from('profiles').select('*').eq('id', user.id).maybeSingle();
  const zip = ((pr as any)?.zip as string | null) ?? null;
  const trade = searchParams.trade && JOB_TYPES[searchParams.trade] ? searchParams.trade : '';
  const list = zip ? await nearbyCards(zip, trade) : [];

  return (
    <>
      <div className="stack">
        <h1>Find contractors</h1>
        <p className="muted">{zip ? `Contractors on Jobfile within 50 miles of ${zip}.` : 'Enter your ZIP code to see contractors near you.'}</p>
      </div>

      {!zip ? (
        <div className="card">
          {searchParams.zip_error ? <div className="box bad">{searchParams.zip_error}</div> : null}
          <form action={saveZip} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input type="hidden" name="back" value="/find" />
            <input name="zip" inputMode="numeric" maxLength={5} pattern="[0-9]{5}" placeholder="75074" autoComplete="postal-code" required style={{ fontSize: 20, fontWeight: 700 }} aria-label="ZIP code" />
            <button className="btn" type="submit">Save ZIP</button>
          </form>
        </div>
      ) : (
        <>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <Link href="/find" style={pill(!trade)}>All trades</Link>
            {Object.keys(JOB_TYPES).map((t) => (
              <Link key={t} href={`/find?trade=${encodeURIComponent(t)}`} style={pill(trade === t)}>{t}</Link>
            ))}
          </div>
          {list.length === 0 ? (
            <div className="card"><p className="muted" style={{ margin: 0 }}>No contractors found{trade ? ` for ${trade}` : ''} near {zip} yet. Post a project and we will tell contractors in your area.</p></div>
          ) : list.map((c) => {
            const initials = c.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
            const shownTrades = c.trades.slice(0, 2);
            const more = c.trades.length - shownTrades.length;
            const chip = (bg: string, fg: string): React.CSSProperties => ({ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: bg, color: fg, whiteSpace: 'nowrap' });
            return (
              <div key={c.id} className="card">
                <div className="row" style={{ gap: 12, flexWrap: 'nowrap', alignItems: 'center' }}>
                  {c.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.logo} alt="" width={56} height={56} style={{ borderRadius: 16, objectFit: 'cover', flex: 'none' }} />
                  ) : (
                    <div aria-hidden="true" style={{ width: 56, height: 56, borderRadius: 16, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 20 }}>{initials || '?'}</div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="row" style={{ gap: 6 }}>
                      <b style={{ fontSize: 17 }}>{c.name}</b>
                      {c.verified ? <span style={chip('var(--ok-bg)', 'var(--ok)')}>✓ Verified</span> : null}
                    </div>
                    <div className="muted small">
                      {c.count ? <><b style={{ color: 'var(--warn)' }}>★ {c.avg.toFixed(1)}</b> ({c.count} rating{c.count === 1 ? '' : 's'})</> : 'New on Jobfile · no ratings yet'}
                      {c.since ? ` · ${Math.max(1, new Date().getFullYear() - c.since)} yr${new Date().getFullYear() - c.since > 1 ? 's' : ''}` : ''}
                    </div>
                  </div>
                  <span className="muted small" style={{ flex: 'none', alignSelf: 'flex-start' }}>{c.miles} mi</span>
                </div>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {c.insured ? <span style={chip('var(--home-bg)', 'var(--home)')}>Insured</span> : null}
                  {shownTrades.map((t) => <span key={t} style={chip('var(--con-bg)', 'var(--con)')}>{t}</span>)}
                  {more > 0 ? <span style={{ ...chip('transparent', 'var(--ink-2)'), border: '1px solid var(--line)', fontWeight: 500 }}>+ {more} more</span> : null}
                </div>
                {c.photos.length ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {c.photos.map((u, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={u} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 12 }} />
                    ))}
                  </div>
                ) : null}
                <Link href={`/contractors/${c.id}`} className={`btn${c.count || c.verified ? '' : ' ghost'}`}>View profile</Link>
              </div>
            );
          })}
          <p className="muted small">Change your ZIP in <Link href="/settings">Settings</Link>.</p>
        </>
      )}
    </>
  );
}
