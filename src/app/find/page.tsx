import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { JOB_TYPES, requireMarketplace } from '@/lib/marketplace';
import { nearbyAll } from '@/lib/nearby';
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
  const list = zip ? await nearbyAll(zip, trade) : [];

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
          ) : list.map((c) => (
            <div key={c.id} className="card">
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                <b>{c.name}</b>
                <span className="muted small">{c.miles} mi</span>
              </div>
              {c.trades.length ? <p className="muted small" style={{ margin: 0 }}>{c.trades.join(', ')}</p> : null}
              <Link href={`/contractors/${c.id}`} className="btn ghost">View profile</Link>
            </div>
          ))}
          <p className="muted small">Change your ZIP in <Link href="/settings">Settings</Link>.</p>
        </>
      )}
    </>
  );
}
