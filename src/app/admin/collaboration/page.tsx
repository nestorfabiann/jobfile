import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { dollars } from '@/lib/money';

export const dynamic = 'force-dynamic';

const RANGES = [['7', '7 days'], ['30', '30 days'], ['all', 'All time']] as const;
const DAY = 86400000;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const when = (iso: string) => new Date(iso).getTime();

/** Owner-only: how contractors collaborate. Team bids on the marketplace plus partners on their own projects. Reads what is already saved; nothing new is tracked. */
export default async function Collaboration({ searchParams }: { searchParams: { r?: string } }) {
  const { db } = await requireAdmin();
  const r = RANGES.find(([k]) => k === searchParams.r)?.[0] ?? '30';
  const days = r === 'all' ? 0 : Number(r);
  const now = Date.now();
  const cut = days ? now - days * DAY : 0;
  const prevCut = days ? now - 2 * days * DAY : 0;
  const inCur = (iso: string) => when(iso) >= cut;
  const inPrev = (iso: string) => !!days && when(iso) >= prevCut && when(iso) < cut;

  let tbs: any[] = [], tps: any[] = [], pps: any[] = [], missing = false;
  try {
    const [a, b, c] = await Promise.all([
      db.from('team_bids').select('id,lead_company_id,status,structure,hire_mode,bid_id,created_at').limit(5000),
      db.from('team_partners').select('id,team_bid_id,company_id,status,price_cents,bid_id,created_at').limit(5000),
      db.from('project_partners').select('id,project_id,lead_company_id,partner_company_id,partner_email,status,price_cents,removed_by,created_at,updated_at,partner_name,paid_cents,counter_cents').limit(5000),
    ]);
    tbs = (a.data ?? []) as any[]; tps = (b.data ?? []) as any[]; pps = (c.data ?? []) as any[];
  } catch { missing = true; }

  const teamBidIds = new Set<string>([...tbs.map((t) => t.bid_id), ...tps.map((p) => p.bid_id)].filter(Boolean) as string[]);
  const { data: bidRows } = await db.from('marketplace_bids').select('id,status,created_at').gte('created_at', new Date(cut || 0).toISOString()).limit(8000);
  const bids = (bidRows ?? []) as any[];
  const won = new Map<string, boolean>();
  if (teamBidIds.size) {
    const { data: tb } = await db.from('marketplace_bids').select('id,status').in('id', Array.from(teamBidIds));
    ((tb ?? []) as any[]).forEach((b) => won.set(b.id, b.status === 'won'));
  }

  // Team bids.
  const sentCur = tbs.filter((t) => t.status === 'sent' && inCur(t.created_at));
  const sentPrev = tbs.filter((t) => t.status === 'sent' && inPrev(t.created_at));
  const hired = sentCur.filter((t) => t.bid_id && won.get(t.bid_id));
  const singles = bids.filter((b) => !teamBidIds.has(b.id));
  const singleWon = singles.filter((b) => b.status === 'won').length;

  // Partners: marketplace team partners and partners on own projects together.
  const ppCur = pps.filter((p) => inCur(p.created_at));
  const ppPrev = pps.filter((p) => inPrev(p.created_at));
  const tpCur = tps.filter((p) => inCur(p.created_at));
  const tpPrev = tps.filter((p) => inPrev(p.created_at));
  const invited = ppCur.length + tpCur.length;
  const invitedPrev = ppPrev.length + tpPrev.length;
  const onJob = ppCur.filter((p) => p.status === 'accepted').length + tpCur.filter((p) => p.status === 'confirmed').length;
  const answered = ppCur.filter((p) => p.status !== 'invited').length + tpCur.filter((p) => p.status !== 'invited').length;
  const countered = ppCur.filter((p) => p.status === 'countered').length + tpCur.filter((p) => p.status === 'countered').length;
  const declined = ppCur.filter((p) => p.status === 'declined').length + tpCur.filter((p) => p.status === 'declined').length;
  const accepted = onJob;
  const workCents = ppCur.filter((p) => p.status === 'accepted').reduce((s, p) => s + p.price_cents, 0) + tpCur.filter((p) => p.status === 'confirmed').reduce((s, p) => s + p.price_cents, 0);
  const answerMs = ppCur.filter((p) => ['accepted', 'declined', 'countered'].includes(p.status) && !p.paid_cents).map((p) => when(p.updated_at) - when(p.created_at)).filter((x) => x > 0);
  const avgHours = answerMs.length ? Math.round(answerMs.reduce((a, b) => a + b, 0) / answerMs.length / 3600000) : 0;

  // Projects with a partner.
  const { count: projCount } = await db.from('projects').select('id', { count: 'exact', head: true }).gte('created_at', new Date(cut || 0).toISOString());
  const projWithPartner = new Set(ppCur.filter((p) => p.status === 'accepted').map((p) => p.project_id)).size;

  // Structure.
  const lead = sentCur.filter((t) => t.structure !== 'separate').length;
  const sep = sentCur.length - lead;
  const either = sentCur.filter((t) => t.structure === 'separate' && t.hire_mode !== 'package').length;
  const pack = sep - either;

  // Growth: invited by email, who joined afterward.
  const emails = Array.from(new Set(pps.map((p) => p.partner_email as string).filter(Boolean)));
  const joined = new Map<string, string>();
  if (emails.length) {
    const { data: pf } = await db.from('profiles').select('email,created_at').in('email', emails.slice(0, 500));
    ((pf ?? []) as any[]).forEach((x) => joined.set(x.email, x.created_at));
  }
  const newToJobfile = ppCur.filter((p) => !joined.has(p.partner_email) || when(joined.get(p.partner_email)!) > when(p.created_at));
  const signedUp = newToJobfile.filter((p) => joined.has(p.partner_email)).length;
  const { count: coTotal } = await db.from('companies').select('id', { count: 'exact', head: true });
  let coOpen = 0;
  try { const { count } = await db.from('companies').select('id', { count: 'exact', head: true }).eq('open_to_partner', true); coOpen = count ?? 0; } catch { /* column missing */ }

  // Most active pairs.
  const pairs = new Map<string, number>();
  const bump = (a: string, b: string) => { if (!a || !b) return; const k = [a, b].sort().join('|'); pairs.set(k, (pairs.get(k) ?? 0) + 1); };
  pps.filter((p) => p.status === 'accepted' && p.partner_company_id).forEach((p) => bump(p.lead_company_id, p.partner_company_id));
  tps.filter((p) => p.status === 'confirmed').forEach((p) => { const tb = tbs.find((t) => t.id === p.team_bid_id); if (tb) bump(tb.lead_company_id, p.company_id); });
  const topPairs = Array.from(pairs.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const needIds = Array.from(new Set([...topPairs.flatMap(([k]) => k.split('|')), ...pps.filter((p) => p.status === 'invited').map((p) => p.lead_company_id)]));
  const { data: cos } = needIds.length ? await db.from('companies').select('id,name').in('id', needIds) : { data: [] as any[] };
  const nm = new Map(((cos ?? []) as any[]).map((c) => [c.id as string, c.name as string] as [string, string]));

  // Weekly activity, last 10 weeks.
  const weeks = Array.from({ length: 10 }, (_, i) => {
    const end = now - (9 - i) * 7 * DAY, start = end - 7 * DAY;
    const n = [...tbs, ...pps].filter((x) => when(x.created_at) >= start && when(x.created_at) < end).length;
    return n;
  });
  const wmax = Math.max(1, ...weeks);

  // Needs a look.
  const stale = pps.filter((p) => p.status === 'invited' && now - when(p.created_at) > 3 * DAY);
  const removedHome = pps.filter((p) => p.status === 'removed' && p.removed_by === 'homeowner');
  const everAccepted = pps.filter((p) => p.status === 'accepted' || p.status === 'removed').length;

  const delta = (a: number, b: number) => (days ? <em className={a < b ? 'dn' : undefined} style={{ fontStyle: 'normal', fontSize: 13, fontWeight: 600, color: a < b ? '#a2503a' : '#1f4d3a' }}>{a >= b ? '▲' : '▼'} {Math.abs(a - b)} vs previous {days} days</em> : null);
  const Tile = ({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) => (
    <div className="card" style={{ gap: 2, minWidth: 0 }}><span className="muted small">{label}</span><b style={{ fontSize: 28, lineHeight: 1.1 }}>{value}</b>{sub ? <span className="small">{sub}</span> : null}</div>
  );
  const Bar = ({ label, value, p, good }: { label: string; value: string; p: number; good?: boolean }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><span>{label}</span><span className="muted small">{value}</span></div>
      <div className="bar"><span style={{ width: `${Math.min(100, p)}%`, background: good ? '#1f4d3a' : undefined }} /></div>
    </div>
  );

  return (
    <>
      <h1>Collaboration</h1>
      <p className="muted">How contractors work together: team bids on the marketplace and partners on their own projects.</p>
      {missing ? <div className="box warn">The team or partner tables are not created yet.</div> : null}
      <div className="chips" aria-label="Range">
        {RANGES.map(([k, l]) => <Link key={k} className="chip" href={`/admin/collaboration?r=${k}`}><span style={r === k ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } : undefined}>{l}</span></Link>)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <Tile label="Team bids sent" value={String(sentCur.length)} sub={delta(sentCur.length, sentPrev.length)} />
        <Tile label="Team bids hired" value={String(hired.length)} sub={`${pct(hired.length, sentCur.length)}% hire rate`} />
        <Tile label="Partners invited" value={String(invited)} sub={delta(invited, invitedPrev)} />
        <Tile label="Partners on the job" value={String(onJob)} sub={`${pct(onJob, invited)}% accepted`} />
        <Tile label="Projects with a partner" value={`${pct(projWithPartner, projCount ?? 0)}%`} sub={`of ${projCount ?? 0} projects`} />
        <Tile label="Partner work" value={dollars(workCents)} sub={onJob ? `avg ${dollars(Math.round(workCents / onJob))} each` : undefined} />
      </div>

      <section className="card" aria-label="Activity by week" style={{ gap: 10 }}>
        <h2>Activity by week</h2>
        <div role="img" aria-label={`Team bids and partner invites per week: ${weeks.join(', ')}`} style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 64 }}>
          {weeks.map((n, i) => <i key={i} title={`${n}`} style={{ flex: 1, height: `${Math.max(6, (n / wmax) * 100)}%`, background: '#c4813f', borderRadius: '4px 4px 0 0', opacity: i === 9 ? 1 : 0.85 }} />)}
        </div>
        <span className="muted small">Team bids plus partner invites, last 10 weeks. Latest week on the right.</span>
      </section>

      <section className="card" aria-label="Partner invites" style={{ gap: 10 }}>
        <h2>Do invites turn into partners?</h2>
        <Bar label="Invited" value={String(invited)} p={100} />
        <Bar label="Answered" value={String(answered)} p={pct(answered, invited)} />
        <Bar label="Accepted" value={String(accepted)} p={pct(accepted, invited)} good />
        <Bar label="Proposed a new price (still open)" value={String(countered)} p={pct(countered, invited)} />
        <Bar label="Declined" value={String(declined)} p={pct(declined, invited)} />
        <span className="muted small">{avgHours ? `About ${avgHours} hour${avgHours === 1 ? '' : 's'} to answer on partner invites for own projects. ` : ''}{stale.length} invite{stale.length === 1 ? '' : 's'} unanswered over 3 days.</span>
      </section>

      <section className="card" aria-label="Team bids" style={{ gap: 10 }}>
        <h2>Do team bids win?</h2>
        <Bar label="Team bids sent" value={String(sentCur.length)} p={100} />
        <Bar label="Hired" value={`${hired.length} · ${pct(hired.length, sentCur.length)}%`} p={pct(hired.length, sentCur.length)} good />
        <Bar label="Single-company bids hired" value={`${singleWon} of ${singles.length} · ${pct(singleWon, singles.length)}%`} p={pct(singleWon, singles.length)} />
        <span className="muted small">{sentCur.length >= 5 ? (pct(hired.length, sentCur.length) > pct(singleWon, singles.length) ? 'Team bids win more often than single bids in this period.' : 'Team bids are not winning more often than single bids in this period.') : 'Too few team bids to compare yet.'}</span>
      </section>

      <section className="card" aria-label="Structure" style={{ gap: 6 }}>
        <h2>How they work together</h2>
        <div className="row" style={{ justifyContent: 'space-between' }}><span>One contract (lead pays partner)</span><span className="muted">{lead} · {pct(lead, sentCur.length)}%</span></div>
        <div className="row" style={{ justifyContent: 'space-between' }}><span>Separate contracts</span><span className="muted">{sep} · {pct(sep, sentCur.length)}%</span></div>
        <div className="row" style={{ justifyContent: 'space-between' }}><span>… hire either or both</span><span className="muted">{either}</span></div>
        <div className="row" style={{ justifyContent: 'space-between' }}><span>… only as a package</span><span className="muted">{pack}</span></div>
      </section>

      <section className="card" aria-label="Growth" style={{ gap: 6 }}>
        <h2>Growth from invites</h2>
        <div className="row" style={{ justifyContent: 'space-between' }}><span>Partners invited who were new to Jobfile</span><span className="muted">{newToJobfile.length}</span></div>
        <div className="row" style={{ justifyContent: 'space-between' }}><span>Of those, signed up since</span><span className="muted">{signedUp} · {pct(signedUp, newToJobfile.length)}%</span></div>
        <div className="row" style={{ justifyContent: 'space-between' }}><span>Companies open to partnering</span><span className="muted">{coOpen} of {coTotal ?? 0} · {pct(coOpen, coTotal ?? 0)}%</span></div>
      </section>

      <section className="card" aria-label="Most active" style={{ gap: 6 }}>
        <h2>Most active</h2>
        {topPairs.length === 0 ? <p className="muted">No partner pairs yet.</p> : null}
        {topPairs.map(([k, n]) => { const [a, b] = k.split('|'); return <div key={k} className="row" style={{ justifyContent: 'space-between' }}><span>{nm.get(a) ?? 'A company'} · {nm.get(b) ?? 'A company'}</span><span className="muted">{n} job{n > 1 ? 's' : ''}</span></div>; })}
      </section>

      <section className="card" aria-label="Needs a look" style={{ gap: 8 }}>
        <h2>Needs a look</h2>
        {stale.length === 0 && removedHome.length === 0 ? <p className="muted">Nothing stands out.</p> : null}
        {stale.length ? <div className="box warn"><b>{stale.length} invite{stale.length > 1 ? 's' : ''} waiting over 3 days</b><br /><span className="small">{stale.slice(0, 5).map((p) => `${p.partner_name || p.partner_email} (from ${nm.get(p.lead_company_id) ?? 'a company'})`).join(', ')}</span></div> : null}
        {removedHome.length ? <div className="box warn"><b>{removedHome.length} partner{removedHome.length > 1 ? 's' : ''} removed by homeowners</b><br /><span className="small">{pct(removedHome.length, everAccepted)}% of partners who joined a project. Worth watching if it climbs.</span></div> : null}
        <span className="muted small">Payments are records only, so partner dollars are what leads recorded, not money confirmed.</span>
      </section>
    </>
  );
}
