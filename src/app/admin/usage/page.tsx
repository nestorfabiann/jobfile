import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { profileMeter } from '@/lib/profileMeter';
import { ago, avgVisitMs, DAY, dayKey, fmtDuration, loadEvents, periodDays, visitsOf } from '@/lib/usageStats';

export const dynamic = 'force-dynamic';

const TABS = [['overview', 'Overview'], ['people', 'People'], ['funnel', 'Funnel']] as const;
const RANGES = [['7', 'Last 7 days'], ['30', '30 days'], ['all', 'All time']] as const;

export default async function Usage({ searchParams }: { searchParams: { tab?: string; r?: string; who?: string } }) {
  const { db } = await requireAdmin();
  const tab = TABS.find(([k]) => k === searchParams.tab)?.[0] ?? 'overview';
  const r = RANGES.find(([k]) => k === searchParams.r)?.[0] ?? '7';
  const days = periodDays(r);
  const href = (o: Record<string, string>) => `/admin/usage?${new URLSearchParams({ tab, r, ...o }).toString()}`;

  const { data: mem } = await db.from('company_members').select('user_id,company_id,role');
  const contractorIds = new Set(((mem ?? []) as any[]).map((m) => m.user_id as string));

  const since = days ? new Date(Date.now() - days * 2 * DAY).toISOString() : null; // two periods back, for the comparison
  const all = await loadEvents(db, since);
  const cut = days ? Date.now() - days * DAY : 0;
  const cur = all.filter((e) => new Date(e.created_at).getTime() >= cut);
  const prev = days ? all.filter((e) => new Date(e.created_at).getTime() < cut) : [];

  const chips = (
    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
      {TABS.map(([k, l]) => <Link key={k} href={`/admin/usage?tab=${k}&r=${r}`} className={`btn ${tab === k ? '' : 'ghost'}`} style={{ minHeight: 40, padding: '6px 16px' }}>{l}</Link>)}
    </div>
  );

  if (tab === 'overview') {
    const stat = (label: string, now: number | string, before: number | null) => (
      <div className="card" key={label}>
        <span className="muted small">{label}</span>
        <b style={{ fontSize: 28 }}>{now}</b>
        {before != null && typeof now === 'number' ? <span className="small" style={{ color: now >= before ? 'var(--ok)' : 'var(--bad)', fontWeight: 600 }}>{now >= before ? '+' : ''}{now - before} vs previous</span> : null}
      </div>
    );
    const act = (list: typeof all, wantC: boolean) => new Set(list.filter((e) => e.kind !== 'signin' && contractorIds.has(e.user_id) === wantC).map((e) => e.user_id)).size;
    const signins = (list: typeof all) => list.filter((e) => e.kind === 'signin').length;
    const visits = visitsOf(cur);
    const perDay = new Map<string, number>();
    visits.forEach((v) => perDay.set(dayKey(v.start), (perDay.get(dayKey(v.start)) ?? 0) + 1));
    const chartDays = Array.from({ length: Math.min(days || 14, 14) }, (_, i) => dayKey(Date.now() - (Math.min(days || 14, 14) - 1 - i) * DAY));
    const max = Math.max(1, ...chartDays.map((d) => perDay.get(d) ?? 0));
    const pages = new Map<string, number>();
    cur.filter((e) => e.kind === 'view').forEach((e) => pages.set(e.page, (pages.get(e.page) ?? 0) + 1));
    const top = Array.from(pages.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
    return (
      <>
        <h1>Usage</h1>
        {chips}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {RANGES.map(([k, l]) => <Link key={k} href={`/admin/usage?tab=overview&r=${k}`} className="pill" style={r === k ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : undefined}>{l}</Link>)}
        </div>
        {all.length === 0 && <div className="box warn">No usage recorded yet. If you have not run the 024 SQL, do that first. Visits appear here as people use the app.</div>}
        <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {stat('Active homeowners', act(cur, false), days ? act(prev, false) : null)}
          {stat('Active contractors', act(cur, true), days ? act(prev, true) : null)}
          {stat('Sign-ins', signins(cur), days ? signins(prev) : null)}
          {stat('Avg. time per visit', fmtDuration(avgVisitMs(visits)), null)}
        </div>
        <p className="muted small" style={{ margin: 0 }}>Time per visit is an estimate: a visit ends after 30 minutes of nothing. Times are US Central.</p>
        <div className="card">
          <h3 style={{ margin: 0 }}>Visits per day</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 90 }}>
            {chartDays.map((d) => <i key={d} title={`${d}: ${perDay.get(d) ?? 0}`} style={{ flex: 1, height: `${Math.max(3, ((perDay.get(d) ?? 0) / max) * 100)}%`, background: 'var(--accent)', borderRadius: '6px 6px 0 0', opacity: 0.85 }} />)}
          </div>
          <div style={{ display: 'flex', gap: 6, fontSize: 11 }} className="muted">{chartDays.map((d) => <span key={d} style={{ flex: 1, textAlign: 'center' }}>{new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3)}</span>)}</div>
        </div>
        <div className="card">
          <h3 style={{ margin: 0 }}>Most used pages</h3>
          {top.length === 0 ? <p className="muted small" style={{ margin: 0 }}>Nothing yet.</p> : top.map(([p, n]) => (
            <div key={p} className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', borderTop: '1px solid var(--line)', paddingTop: 8 }}><span>{p}</span><b>{n} views</b></div>
          ))}
        </div>
      </>
    );
  }

  if (tab === 'people') {
    const who = ['all', 'homeowners', 'contractors', 'quiet'].includes(searchParams.who ?? '') ? (searchParams.who as string) : 'all';
    const { data: profs } = await db.from('profiles').select('id,email,full_name,created_at').order('created_at', { ascending: false }).limit(300);
    const evAll = await loadEvents(db, null);
    const last = new Map<string, string>();
    const signins = new Map<string, number>();
    const viewed = new Set<string>();
    evAll.forEach((e) => {
      last.set(e.user_id, e.created_at);
      if (e.kind === 'signin') signins.set(e.user_id, (signins.get(e.user_id) ?? 0) + 1);
      if (e.kind === 'view') viewed.add(e.user_id);
    });
    const week = Date.now() - 7 * DAY;
    const rows = ((profs ?? []) as any[]).map((p) => {
      const l = last.get(p.id) ?? null;
      return { ...p, last: l, n: signins.get(p.id) ?? 0, isC: contractorIds.has(p.id), quiet: !l || new Date(l).getTime() < week };
    }).filter((p) => who === 'all' || (who === 'homeowners' && !p.isC) || (who === 'contractors' && p.isC) || (who === 'quiet' && p.quiet && new Date(p.created_at).getTime() < week))
      .sort((a, b) => (b.last ?? '').localeCompare(a.last ?? ''));
    return (
      <>
        <h1>Usage</h1>
        {chips}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {[['all', 'Everyone'], ['homeowners', 'Homeowners'], ['contractors', 'Contractors'], ['quiet', 'Gone quiet']].map(([k, l]) => <Link key={k} href={href({ tab: 'people', who: k })} className="pill" style={who === k ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : undefined}>{l}</Link>)}
        </div>
        <div className="card" style={{ gap: 0, padding: 0 }}>
          {rows.length === 0 && <p className="muted" style={{ padding: 16 }}>Nobody here.</p>}
          {rows.map((p, i) => (
            <Link key={p.id} href={`/admin/users/${p.id}`} className="row" style={{ padding: '12px 16px', borderTop: i ? '1px solid var(--line)' : 'none', justifyContent: 'space-between', flexWrap: 'nowrap', color: 'inherit', textDecoration: 'none' }}>
              <span style={{ minWidth: 0 }}>
                <b style={{ display: 'block' }}>{p.full_name || p.email}</b>
                <span className="muted small">{p.isC ? 'Contractor' : 'Homeowner'} · {p.last ? `last seen ${ago(p.last)}` : 'not seen yet'} · {p.n} sign-in{p.n === 1 ? '' : 's'}</span>
              </span>
              <span className={`pill ${p.quiet ? 'warn' : 'ok'}`}>{p.quiet ? (p.last ? 'Quiet' : 'New') : 'Active'}</span>
            </Link>
          ))}
        </div>
        <p className="muted small">Tracking started when the 024 step was run. Older sign-ins are not counted. "Gone quiet" means not seen for 7 days. Use Broadcast or By area to message people.</p>
      </>
    );
  }

  // Funnel
  const { data: profs } = await db.from('profiles').select('id').limit(2000);
  const homeowners = ((profs ?? []) as any[]).map((p) => p.id as string).filter((id) => !contractorIds.has(id));
  const hset = new Set(homeowners);
  const { data: lst } = await db.from('marketplace_listings').select('id,homeowner_id,status').limit(5000);
  const { data: bids } = await db.from('marketplace_bids').select('listing_id,company_id,status').limit(5000);
  const listings = ((lst ?? []) as any[]).filter((l) => hset.has(l.homeowner_id));
  const posted = new Set(listings.map((l) => l.homeowner_id as string));
  const biddedListing = new Set(((bids ?? []) as any[]).map((b) => b.listing_id as string));
  const gotBid = new Set(listings.filter((l) => biddedListing.has(l.id)).map((l) => l.homeowner_id as string));
  const hired = new Set(listings.filter((l) => l.status === 'awarded').map((l) => l.homeowner_id as string));
  const companyIds = Array.from(new Set(((mem ?? []) as any[]).map((m) => m.company_id as string)));
  const meters = await Promise.all(companyIds.slice(0, 200).map((id) => profileMeter(id).catch(() => ({ pct: 0 }))));
  const finished = meters.filter((m) => m.pct >= 70).length;
  const sent = new Set(((bids ?? []) as any[]).map((b) => b.company_id as string));
  const won = new Set(((bids ?? []) as any[]).filter((b) => b.status === 'won').map((b) => b.company_id as string));
  const Funnel = ({ title, steps }: { title: string; steps: [string, number][] }) => (
    <div className="card">
      <h3 style={{ margin: 0 }}>{title}</h3>
      {steps.map(([label, n], i) => {
        const pct = steps[0][1] ? Math.round((n / steps[0][1]) * 100) : 0;
        return (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><span>{label}</span><b>{n}{i ? ` · ${pct}%` : ''}</b></div>
            <div style={{ height: 14, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)' }} /></div>
          </div>
        );
      })}
    </div>
  );
  return (
    <>
      <h1>Usage</h1>
      {chips}
      <Funnel title="Homeowners" steps={[['Signed up', homeowners.length], ['Posted a project', posted.size], ['Got a bid', gotBid.size], ['Hired a contractor', hired.size]]} />
      <Funnel title="Contractors" steps={[['Signed up (companies)', companyIds.length], ['Profile 70% or more', finished], ['Sent a bid', Array.from(sent).filter((id) => companyIds.includes(id)).length], ['Won a job', Array.from(won).filter((id) => companyIds.includes(id)).length]]} />
      <p className="muted small">Counts people and companies, all time, from the live data. It shows where people drop off, so you know what to fix first.</p>
    </>
  );
}
