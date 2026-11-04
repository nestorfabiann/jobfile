import { requireAdmin } from '@/lib/admin';
import { ago, DAY } from '@/lib/usageStats';

export const dynamic = 'force-dynamic';

const FILTERS = [['all', 'Everyone'], ['in', 'Installed'], ['al', 'Alerts on'], ['web', 'Web only']] as const;

type Row = { id: string; email: string; name: string; role: string; installed: boolean; alerts: boolean; device: string; last: number };

export default async function Installs({ searchParams }: { searchParams: { f?: string } }) {
  const { db } = await requireAdmin();
  const f = FILTERS.find(([k]) => k === searchParams.f)?.[0] ?? 'all';
  const since = new Date(Date.now() - 30 * DAY).toISOString();

  // Everyone active in the last 30 days, with when they were last seen.
  const seen = new Map<string, number>();
  for (let from = 0; from < 30000; from += 1000) {
    const { data, error } = await db.from('usage_events').select('user_id,created_at').gte('created_at', since).neq('kind', 'signin').order('created_at', { ascending: false }).range(from, from + 999);
    if (error) break;
    for (const r of (data ?? []) as { user_id: string; created_at: string }[]) if (!seen.has(r.user_id)) seen.set(r.user_id, new Date(r.created_at).getTime());
    if ((data ?? []).length < 1000) break;
  }

  let installs: any[] = [];
  let missing = false;
  try {
    const r = await db.from('app_installs').select('user_id,device,last_seen');
    if (r.error) missing = true; else installs = (r.data ?? []) as any[];
  } catch { missing = true; }
  const subs = ((await db.from('push_subscriptions').select('user_id,user_agent')).data ?? []) as { user_id: string; user_agent: string }[];
  const { data: mem } = await db.from('company_members').select('user_id');
  const contractors = new Set(((mem ?? []) as any[]).map((m) => m.user_id as string));

  const inst = new Map<string, { device: string; last: number }>(installs.map((i) => [i.user_id as string, { device: i.device as string, last: new Date(i.last_seen as string).getTime() }]));
  const alertDev = new Map<string, string>();
  for (const s of subs) alertDev.set(s.user_id, /iphone|ipad/i.test(s.user_agent) ? 'iPhone' : /android/i.test(s.user_agent) ? 'Android' : 'Desktop');

  const ids = Array.from(new Set([...seen.keys(), ...inst.keys(), ...alertDev.keys()]));
  const { data: profs } = ids.length ? await db.from('profiles').select('id,email,full_name').in('id', ids.slice(0, 1000)) : { data: [] };
  const rows: Row[] = ((profs ?? []) as any[]).map((p) => {
    const i = inst.get(p.id as string);
    return { id: p.id, email: p.email ?? '', name: p.full_name ?? '', role: contractors.has(p.id) ? 'Contractor' : 'Homeowner', installed: !!i, alerts: alertDev.has(p.id), device: i?.device || alertDev.get(p.id) || '', last: Math.max(seen.get(p.id) ?? 0, i?.last ?? 0) };
  }).sort((a, b) => b.last - a.last);

  const active = rows.filter((r) => seen.has(r.id));
  const nIn = rows.filter((r) => r.installed).length;
  const nAl = rows.filter((r) => r.alerts).length;
  const nWeb = active.filter((r) => !r.installed).length;
  const inActive = active.filter((r) => r.installed).length;
  const pct = active.length ? Math.round((inActive / active.length) * 100) : 0;
  const shown = rows.filter((r) => f === 'all' || (f === 'in' && r.installed) || (f === 'al' && r.alerts) || (f === 'web' && !r.installed));

  return (
    <>
      <h1>App installs</h1>
      <p className="muted small">Who has opened Jobfile from the Home Screen, and who has phone alerts on. &ldquo;Installed&rdquo; means they opened it that way at least once. It counts from the day this page went live, and we cannot tell if someone later removed the icon.</p>
      {missing && <div className="box warn">Run the 036 SQL to start counting installs. Until then only alerts are shown.</div>}
      <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card" style={{ background: '#1f4d3a', color: '#fff' }}><b style={{ fontSize: 30 }}>{nIn}</b><span className="small">Opened as an installed app</span></div>
        <div className="card"><b style={{ fontSize: 30 }}>{nAl}</b><span className="muted small">Have phone alerts on</span></div>
        <div className="card"><b style={{ fontSize: 30 }}>{nWeb}</b><span className="muted small">Web only, active in 30 days</span></div>
        <div className="card"><b style={{ fontSize: 30 }}>{pct}%</b><span className="muted small">Of active people installed</span></div>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {FILTERS.map(([k, l]) => <a key={k} href={`/admin/installs?f=${k}`} className={`btn ${f === k ? '' : 'ghost'}`} style={{ minHeight: 40, padding: '6px 16px' }}>{l}</a>)}
      </div>
      {shown.length === 0 && <div className="card"><p className="muted">Nobody here yet.</p></div>}
      {shown.slice(0, 200).map((r) => (
        <div className="card" key={r.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span><b>{r.name || r.email}</b>{r.name ? <><br /><span className="muted small">{r.email}</span></> : null}</span>
            <span className="muted small">{r.role}</span>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <span className={`pill ${r.installed ? 'ok' : ''}`}>{r.installed ? 'Installed' : 'Web only'}</span>
            {r.alerts && <span className="pill warn">Alerts on</span>}
            {r.device && <span className="pill">{r.device}</span>}
          </div>
          <span className="muted small">{r.last ? `Last seen ${ago(new Date(r.last).toISOString())}` : 'Not seen in the last 30 days'}</span>
        </div>
      ))}
    </>
  );
}
