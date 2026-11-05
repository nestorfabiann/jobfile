import TradeIcon from '@/components/TradeIcon';
import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { dollars } from '@/lib/money';
import { DEFAULT_RADIUS, miles, zipCoords } from '@/lib/matching';
import { detailPercent } from '@/lib/scopeQuestions';
import { firstNameInitial, JOB_TYPES, listingOpen, listingTitle, requireMarketplace, type Listing } from '@/lib/marketplace';

export const dynamic = 'force-dynamic';

const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' });
const TRADE_COLORS = ['#c4813f', '#1f4d3a', '#2f5f8a', '#7a4a6b', '#1d6f73', '#a2503a', '#6b7a2a', '#4a5568'];
const colorFor = (t: string) => TRADE_COLORS[Array.from(t).reduce((n, c) => n + c.charCodeAt(0), 0) % TRADE_COLORS.length];
const budget = (l: Listing) =>
  l.budget_min_cents || l.budget_max_cents ? [l.budget_min_cents, l.budget_max_cents].filter((x) => x != null).map((x) => dollars(x as number)).join(' – ') : '';

export default async function Marketplace({ searchParams }: { searchParams: { type?: string; error?: string; mi?: string; trades?: string } }) {
  requireMarketplace();
  const { user } = await requireUser();
  const db = supabaseAdmin();
  const { data: mem } = await db.from('company_members').select('company_id').eq('user_id', user.id).limit(1);
  const companyId = (mem ?? [])[0]?.company_id as string | undefined;
  const isPro = !!companyId;
  const type = searchParams.type && JOB_TYPES[searchParams.type] ? searchParams.type : '';

  // The contractor's own area and trades (columns exist after the 012 database step).
  const { data: co } = isPro ? await db.from('companies').select('business_zip,service_radius_mi,trades').eq('id', companyId).maybeSingle<any>() : { data: null as any };
  const bizZip: string = co?.business_zip ?? '';
  const radius: number = co?.service_radius_mi ?? DEFAULT_RADIUS;
  const trades: string[] = co?.trades ?? [];
  const allTrades = searchParams.trades === 'all' || trades.length === 0;
  const miParam = searchParams.mi === 'any' ? 'any' : /^\d{1,3}$/.test(searchParams.mi ?? '') ? (searchParams.mi as string) : String(radius);
  const limitMi = miParam === 'any' ? Infinity : parseInt(miParam, 10);

  let q = db.from('marketplace_listings').select('*').order('created_at', { ascending: false }).limit(isPro ? 200 : 60);
  q = isPro ? q.eq('status', 'open').gt('expires_at', new Date().toISOString()) : q.eq('homeowner_id', user.id);
  if (isPro && type) q = q.eq('job_type', type);
  const { data } = await q;
  let listings = (data ?? []) as Listing[];
  const away = new Map<string, number>();
  let hiddenByTrade = 0;
  if (isPro) {
    if (!allTrades) {
      const before = listings.length;
      listings = listings.filter((l) => trades.includes(l.job_type));
      hiddenByTrade = before - listings.length;
    }
    if (bizZip) {
      const coords = await zipCoords([bizZip, ...listings.map((l) => l.zip)]);
      const me = coords.get(bizZip);
      if (me) {
        listings.forEach((l) => { const at = coords.get(l.zip); if (at) away.set(l.id, miles(me, at)); });
        listings = listings.filter((l) => !away.has(l.id) || (away.get(l.id) as number) <= limitMi);
        listings.sort((a, b) => (away.get(a.id) ?? Infinity) - (away.get(b.id) ?? Infinity));
      }
    }
    listings = listings.slice(0, 60);
  }
  const qs = (p: Record<string, string>) => {
    const u = new URLSearchParams();
    if (type) u.set('type', type);
    if (searchParams.mi) u.set('mi', searchParams.mi);
    if (searchParams.trades) u.set('trades', searchParams.trades);
    Object.entries(p).forEach(([k, v]) => (v ? u.set(k, v) : u.delete(k)));
    const t = u.toString();
    return `/marketplace${t ? `?${t}` : ''}`;
  };
  const miOptions = Array.from(new Set([10, 25, 50, radius])).sort((a, b) => a - b).map(String);
  const typeChips = allTrades ? Object.keys(JOB_TYPES) : trades.filter((t) => JOB_TYPES[t]);

  const ids = listings.map((l) => l.id);
  const counts = new Map<string, number>();
  const mine = new Set<string>();
  const fresh = new Map<string, number>();
  const seenAt = new Map<string, number>(listings.map((l) => [l.id, (l as any).bids_seen_at ? new Date((l as any).bids_seen_at).getTime() : 0]));
  if (ids.length) {
    const { data: bids } = await db.from('marketplace_bids').select('listing_id,company_id,status,created_at').in('listing_id', ids);
    (bids ?? []).forEach((b: any) => {
      if (b.status !== 'withdrawn') counts.set(b.listing_id, (counts.get(b.listing_id) ?? 0) + 1);
      if (!isPro && b.status === 'waiting' && new Date(b.created_at).getTime() > (seenAt.get(b.listing_id) ?? 0)) fresh.set(b.listing_id, (fresh.get(b.listing_id) ?? 0) + 1);
      if (companyId && b.company_id === companyId && b.status !== 'withdrawn') mine.add(b.listing_id);
    });
  }

  const openN = listings.filter((l) => listingOpen(l)).length;
  const hiredN = listings.filter((l) => l.status === 'awarded').length;
  const newN = Array.from(fresh.values()).reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="stack">
        <h1>{isPro ? 'Projects near you' : 'Your marketplace projects'}</h1>
        <p className="muted">{isPro ? 'Real jobs from homeowners, waiting for bids.' : 'Post a job, compare bids from local contractors, and hire who you choose.'}</p>
      </div>
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}

      {isPro ? (
        <>
          <div className="row">
            <Link className="btn ghost" href="/marketplace/bids">My bids</Link>
          </div>
          <div className="chips" aria-label="Filter by job type">
            <Link className="chip" href={qs({ type: '' })}><span style={!type ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } : undefined}>All</span></Link>
            {typeChips.map((t) => (
              <Link className="chip" key={t} href={qs({ type: t })}><span style={type === t ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } : undefined}><TradeIcon trade={t} size={15} />{t}</span></Link>
            ))}
          </div>
          {bizZip ? (
            <div className="chips" aria-label="Filter by distance">
              {miOptions.map((m) => (
                <Link className="chip" key={m} href={qs({ mi: m })}><span style={miParam === m ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } : undefined}>{m} mi</span></Link>
              ))}
              <Link className="chip" href={qs({ mi: 'any' })}><span style={miParam === 'any' ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } : undefined}>Any distance</span></Link>
            </div>
          ) : (
            <div className="box warn">Add your business ZIP code to see how far each job is and to get alerts for jobs near you. <Link href="/settings/business">Open business profile</Link></div>
          )}
        </>
      ) : (
        <>
          {listings.length > 0 && (
            <div className="pcsum">
              <div className={newN > 0 ? 'hot' : ''}><b>{newN}</b><span>New bid{newN === 1 ? '' : 's'}</span></div>
              <div><b>{openN}</b><span>Open</span></div>
              <div><b>{hiredN}</b><span>Hired</span></div>
            </div>
          )}
          <div className="stack" style={{ gap: 6 }}>
            <Link className="btn" href="/marketplace/new">＋ Post a project</Link>
            <span className="muted small" style={{ textAlign: 'center' }}>Takes about 3 minutes</span>
          </div>
        </>
      )}

      {listings.length === 0 && (
        <div className="card"><p className="muted">{isPro ? 'No open projects right now. Check back soon.' : 'You have not posted a project yet.'}</p></div>
      )}

      {listings.map((l) => {
        const open = listingOpen(l);
        const status = l.status === 'awarded' ? 'Hired' : !open ? 'Closed' : 'Open';
        const n = counts.get(l.id) ?? 0;
        if (!isPro) {
          const col = colorFor(l.job_type);
          const f = fresh.get(l.id) ?? 0;
          const days = Math.max(0, Math.ceil((new Date(l.expires_at).getTime() - Date.now()) / 86400000));
          const lo = l.budget_min_cents ?? null, hi = l.budget_max_cents ?? null;
          let pct = 0;
          try { pct = detailPercent(l.job_type, (l as any).answers); } catch { pct = 0; }
          const action = l.status === 'awarded'
            ? { tone: 'g', text: 'You hired a contractor', go: 'Open' }
            : !open ? { tone: 'n', text: 'This project is closed', go: 'View' }
            : f > 0 ? { tone: 'g', text: `${f} new bid${f === 1 ? '' : 's'}`, go: 'Compare bids' }
            : n > 0 ? { tone: 'g', text: `${n} bid${n === 1 ? '' : 's'} so far`, go: n > 1 ? 'Compare bids' : 'View bid' }
            : days <= 7 ? { tone: 'o', text: `No bids yet. ${days} day${days === 1 ? '' : 's'} left`, go: 'Extend' }
            : { tone: 'o', text: 'No bids yet. Photos help contractors price it', go: 'Add photos' };
          return (
            <Link key={l.id} href={`/marketplace/${l.id}`} className="card pcard" style={{ color: 'inherit', textDecoration: 'none', ['--pc' as any]: col }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                  <span className="pctile" style={{ color: col, background: `${col}1f` }}><TradeIcon trade={l.job_type} size={18} /></span>
                  <span className="pill">{l.job_type}</span>
                </span>
                <span className={`pill ${open ? 'ok' : ''}`}>{open ? `Open · ${days} day${days === 1 ? '' : 's'} left` : status}</span>
              </div>
              <h3>{listingTitle(l)}</h3>
              <p className="muted small">{[l.city, `ZIP ${l.zip}`, l.size_sqft ? `${l.size_sqft.toLocaleString('en-US')} sq ft` : ''].filter(Boolean).join(' · ')}</p>
              {lo != null || hi != null ? (
                <div className="stack" style={{ gap: 6 }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}><b>{lo != null ? dollars(lo) : ''}</b><b>{hi != null ? dollars(hi) : ''}</b></div>
                  <div className="pcbar"><i style={{ background: col }} /></div>
                </div>
              ) : <b>Budget not shared</b>}
              <div className={`pcact ${action.tone}`}><span>{action.text}</span><span className="pcgo">{action.go}</span></div>
              {open && n === 0 && pct > 0 ? (
                <div className="pcdet"><span>Detail level</span><span className="pcb2"><i style={{ width: `${pct}%` }} /></span><span>{pct}%</span></div>
              ) : null}
            </Link>
          );
        }
        return (
          <Link key={l.id} href={`/marketplace/${l.id}`} className="card" style={{ color: 'inherit', textDecoration: 'none' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="pill"><TradeIcon trade={l.job_type} size={15} />{l.job_type}</span>
              <span className={`pill ${open ? 'ok' : ''}`}>{status}</span>
            </div>
            <h3>{listingTitle(l)}</h3>
            <p className="muted small">{[l.city, `ZIP ${l.zip}`, away.has(l.id) ? `${Math.round(away.get(l.id) as number)} mi away` : '', l.size_sqft ? `${l.size_sqft.toLocaleString('en-US')} sq ft` : ''].filter(Boolean).join(' · ')}</p>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>{budget(l) || 'Budget not shared'}</b>
              <span className="muted small">
                {n} bid{n === 1 ? '' : 's'}
                {` · by ${firstNameInitial(l.homeowner_name)}`} · {when(l.created_at)}
                {mine.has(l.id) ? ' · You bid' : ''}
              </span>
            </div>
          </Link>
        );
      })}
      {isPro && hiddenByTrade > 0 && (
        <p className="muted small">{hiddenByTrade} job{hiddenByTrade === 1 ? '' : 's'} in other trades hidden. <Link href={qs({ trades: 'all' })}>Show all trades</Link> or change your trades in Settings.</p>
      )}
    </>
  );
}
