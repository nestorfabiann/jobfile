import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { dollars } from '@/lib/money';
import { firstNameInitial, listingOpen, listingTitle, requireMarketplace, type Bid, type Listing } from '@/lib/marketplace';
import BusinessTabs from '@/components/BusinessTabs';
import InviteCard from '@/components/InviteCard';
import ProjectsTabs from '@/components/ProjectsTabs';
import RangeBar from '@/components/RangeBar';
import { viewStatus } from '@/lib/bidViews';
import { withdrawBid } from '../actions';

export const dynamic = 'force-dynamic';
const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' });
const FILTERS: [string, string][] = [['all', 'All'], ['waiting', 'Waiting'], ['won', 'Won'], ['not_selected', 'Not selected'], ['withdrawn', 'Withdrawn']];
const LABEL: Record<string, string> = { waiting: 'Waiting', won: 'Won', not_selected: 'Not selected', withdrawn: 'Withdrawn' };

export default async function MyBids({ searchParams }: { searchParams: { f?: string } }) {
  requireMarketplace();
  const { user } = await requireUser();
  const db = supabaseAdmin();
  const { data: mem } = await db.from('company_members').select('company_id').eq('user_id', user.id).limit(1);
  const companyId = (mem ?? [])[0]?.company_id as string | undefined;
  if (!companyId) {
    redirect('/marketplace');
    return null;
  }
  const { data: rows } = await db.from('marketplace_bids').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(200);
  const bids = (rows ?? []) as Bid[];
  const ids = Array.from(new Set(bids.map((b) => b.listing_id)));
  const { data: ls } = ids.length ? await db.from('marketplace_listings').select('*').in('id', ids) : { data: [] as Listing[] };
  const byId = new Map(((ls ?? []) as Listing[]).map((l) => [l.id, l] as [string, Listing]));

  const n = (s: string) => bids.filter((b) => b.status === s).length;
  const decided = n('won') + n('not_selected');
  const f = FILTERS.some(([k]) => k === searchParams.f) ? (searchParams.f as string) : 'all';
  const shown = bids.filter((b) => (f === 'all' ? b.status !== 'withdrawn' : b.status === f));

  return (
    <>
      <ProjectsTabs active="extra" role="contractor" projects={0} extra={n('waiting')} />
      <div className="stack">
        <h1>Business profile</h1>
        <BusinessTabs active="bids" />
        <p className="muted small">Only you can see this tab. Homeowners never see your other bids.</p>
      </div>
      <div className="grid2" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div className="card"><span className="muted small">Submitted</span><b style={{ fontSize: 26 }}>{bids.length}</b></div>
        <div className="card"><span className="muted small">Won</span><b style={{ fontSize: 26 }}>{n('won')}</b></div>
        <div className="card"><span className="muted small">Win rate</span><b style={{ fontSize: 26 }}>{decided ? `${Math.round((n('won') / decided) * 100)}%` : '—'}</b></div>
        <div className="card"><span className="muted small">Waiting now</span><b style={{ fontSize: 26 }}>{n('waiting')}</b></div>
      </div>
      <div className="chips" aria-label="Filter bids">
        {FILTERS.map(([k, label]) => (
          <Link key={k} className="chip" href={k === 'all' ? '/marketplace/bids' : `/marketplace/bids?f=${k}`}>
            <span style={f === k ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } : undefined}>{label}</span>
          </Link>
        ))}
      </div>
      {shown.length === 0 && <div className="card"><p className="muted">No bids here yet. <Link href="/marketplace">Browse open projects</Link>.</p></div>}
      {shown.map((b) => {
        const l = byId.get(b.listing_id);
        if (!l) return null;
        const ai = l.ai_low_cents != null && l.ai_high_cents != null;
        const open = listingOpen(l);
        return (
          <div className="card" key={b.id}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <b><Link href={`/marketplace/${l.id}`}>{listingTitle(l)}</Link></b>
              <span className={`pill ${b.status === 'won' ? 'ok' : b.status === 'waiting' ? 'warn' : ''}`}>{LABEL[b.status]}</span>
            </div>
            <p className="muted small">{[l.city, `ZIP ${l.zip}`, firstNameInitial(l.homeowner_name)].filter(Boolean).join(' · ')}</p>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span><span className="muted small">Your bid</span><br /><b style={{ fontSize: 22 }}>{dollars(b.price_cents)}</b></span>
              <span className="muted small" style={{ textAlign: 'right' }}>{b.status === 'waiting' ? 'Sent' : LABEL[b.status]} {when(b.updated_at)}</span>
            </div>
            {b.status === 'waiting' && (() => { const v = viewStatus(b as any); return <div className={`pill ${v.tone === 'hot' ? 'ok' : v.tone === 'seen' ? 'warn' : ''}`} style={{ alignSelf: 'flex-start', whiteSpace: 'normal' }}>{v.text}</div>; })()}
            {ai && <RangeBar price={b.price_cents} lo={l.ai_low_cents as number} hi={l.ai_high_cents as number} />}
            {(l.budget_min_cents || l.budget_max_cents) && <p className="muted small">Homeowner budget {[l.budget_min_cents, l.budget_max_cents].filter((x) => x != null).map((x) => dollars(x as number)).join(' – ')}{ai ? ` · AI range ${dollars(l.ai_low_cents as number)} – ${dollars(l.ai_high_cents as number)}` : ''}</p>}
            {b.status === 'not_selected' && <p className="muted small">The winning price is not shown.</p>}
            <div className="row">
              {b.status === 'waiting' && open && <Link className="btn ghost" href={`/marketplace/${l.id}`}>Edit bid</Link>}
              {b.status === 'waiting' && open && (
                <form action={withdrawBid}><input type="hidden" name="listing_id" value={l.id} /><button className="btn ghost" type="submit">Withdraw</button></form>
              )}
              {b.status === 'won' && l.project_id && <Link className="btn" href={`/projects/${l.project_id}/overview`}>Open project</Link>}
            </div>
          </div>
        );
      })}
      {n('won') > 0 && <InviteCard slim title="Know a contractor who needs work?" body="Jobfile is free to join." cta="Invite" back="/marketplace/bids" />}
    </>
  );
}
