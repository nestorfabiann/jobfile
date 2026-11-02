import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import KitchenArt from '@/components/KitchenArt';
import { createCompany } from './actions';
import { isExpired, type Invite } from '@/lib/invites';
import { dollars } from '@/lib/money';
import { listingOpen, listingTitle, marketplaceEnabled, type Bid, type Listing } from '@/lib/marketplace';
import ProjectsTabs from '@/components/ProjectsTabs';
import WhyJobfile from '@/components/WhyJobfile';
import StartProjectForm from '@/components/StartProjectForm';
import { cookies } from 'next/headers';

const TZ = 'America/Chicago';
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default async function Projects({ searchParams }: { searchParams: { error?: string; tab?: string } }) {
  const { sb, user } = await requireUser();

  const [{ data: projects }, { data: memberships }, { data: alerts }] = await Promise.all([
    sb.from('projects').select('id,name,address,homeowner_name,created_at,closeout_started_at,completed_at').order('created_at', { ascending: false }),
    sb.from('company_members').select('company_id, companies(name)').eq('user_id', user.id),
    sb
      .from('notifications')
      .select('id,title,created_at,project_id')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  // Invitations I sent, and invitations sent to my (confirmed) email address.
  const nowIso = new Date().toISOString();
  const { data: sentRows } = await supabaseAdmin().from('project_invites').select('*').eq('homeowner_id', user.id).eq('status', 'pending').gt('expires_at', nowIso).order('created_at', { ascending: false });
  const { data: gotRows } = user.email && user.email_confirmed_at
    ? await supabaseAdmin().from('project_invites').select('*').eq('contractor_email', user.email.toLowerCase()).eq('status', 'pending').gt('expires_at', nowIso).order('created_at', { ascending: false })
    : { data: [] as Invite[] };
  const sent = ((sentRows ?? []) as Invite[]).filter((i) => !isExpired(i));
  const got = ((gotRows ?? []) as Invite[]).filter((i) => !isExpired(i));

  const company = (memberships ?? [])[0] as { company_id: string; companies?: { name?: string } } | undefined;
  const list = projects ?? [];

  // Newest progress photo per project becomes its picture. Without one, the drawn kitchen shows.
  const covers = new Map<string, string>();
  if (list.length) {
    const { data: ph } = await sb
      .from('photos')
      .select('project_id,path')
      .in('project_id', list.map((p) => p.id))
      .eq('kind', 'progress')
      .order('created_at', { ascending: false })
      .limit(100);
    const firstPath: Record<string, string> = {};
    (ph ?? []).forEach((r: { project_id: string; path: string }) => {
      if (!firstPath[r.project_id]) firstPath[r.project_id] = r.path;
    });
    const paths = Object.values(firstPath);
    if (paths.length) {
      const { data: signed } = await supabaseAdmin().storage.from('project-photos').createSignedUrls(paths, 3600);
      const byPath: Record<string, string> = {};
      (signed ?? []).forEach((x: { path: string | null; signedUrl: string }) => {
        if (x.path && x.signedUrl) byPath[x.path] = x.signedUrl;
      });
      Object.entries(firstPath).forEach(([pid, path]) => {
        if (byPath[path]) covers.set(pid, byPath[path]);
      });
    }
  }

  // Marketplace tabs: homeowners see the jobs they posted, contractors link to their bids.
  const mk = marketplaceEnabled();
  const posted: Listing[] = [];
  const stats = new Map<string, { n: number; lo: number; hi: number }>();
  let extra = 0;
  if (mk) {
    const db = supabaseAdmin();
    if (!company) {
      const { data: ls } = await db.from('marketplace_listings').select('*').eq('homeowner_id', user.id).order('created_at', { ascending: false }).limit(30);
      posted.push(...((ls ?? []) as Listing[]));
      if (posted.length) {
        const { data: bs } = await db.from('marketplace_bids').select('listing_id,price_cents,status').in('listing_id', posted.map((l) => l.id));
        (bs ?? []).forEach((b: any) => {
          if (b.status === 'withdrawn') return;
          const c = stats.get(b.listing_id) ?? { n: 0, lo: Infinity, hi: 0 };
          c.n += 1; c.lo = Math.min(c.lo, b.price_cents); c.hi = Math.max(c.hi, b.price_cents);
          stats.set(b.listing_id, c);
        });
        posted.forEach((l) => { if (listingOpen(l)) extra += stats.get(l.id)?.n ?? 0; });
      }
    } else {
      const { count } = await db.from('marketplace_bids').select('id', { count: 'exact', head: true }).eq('company_id', company.company_id).eq('status', 'waiting');
      extra = count ?? 0;
    }
  }
  const tab = mk && !company && searchParams.tab === 'posted' ? 'posted' : 'projects';
  const tabs = mk ? <ProjectsTabs active={tab === 'posted' ? 'extra' : 'projects'} role={company ? 'contractor' : 'homeowner'} projects={list.length} extra={extra} /> : null;
  const left = (l: Listing) => Math.max(0, Math.ceil((new Date(l.expires_at).getTime() - Date.now()) / 86400000));

  const whyHidden = cookies().get('jf_why')?.value === 'hidden';

  if (tab === 'posted') {
    return (
      <>
        <div className="stack">
          <h1>Projects</h1>
          <p className="muted">Signed in as {user.email}</p>
        </div>
        {tabs}
        <div className="row"><Link className="btn" href="/marketplace/new">+ Post a project to the marketplace</Link></div>
        {posted.length === 0 && <div className="card"><p className="muted">You have not posted a job yet. Post one and local contractors can send you bids.</p></div>}
        {posted.map((l) => {
          const open = listingOpen(l);
          const st = stats.get(l.id);
          const hasAI = l.ai_low_cents != null && l.ai_high_cents != null;
          return (
            <div className="card" key={l.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="pill">{l.job_type}</span>
                <span className={`pill ${open ? 'ok' : ''}`}>{l.status === 'awarded' ? 'Hired' : open ? `Open · ${left(l)} day${left(l) === 1 ? '' : 's'} left` : 'Closed'}</span>
              </div>
              <h3><Link href={`/marketplace/${l.id}`}>{listingTitle(l)}</Link></h3>
              <p className="muted small">{[l.city, `ZIP ${l.zip}`, l.size_sqft ? `${l.size_sqft.toLocaleString('en-US')} sq ft` : ''].filter(Boolean).join(' · ')}</p>
              <div className="row" style={{ justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <b style={{ color: 'var(--accent)', fontSize: 18 }}>{hasAI ? `${dollars(l.ai_low_cents as number)} – ${dollars(l.ai_high_cents as number)}` : 'No AI range'}</b>
                <span className="pill">{st ? `${st.n} bid${st.n === 1 ? '' : 's'}` : 'No bids yet'}</span>
              </div>
              {st && <p className="muted small">Lowest {dollars(st.lo)} · highest {dollars(st.hi)}</p>}
              <div className="row">
                {l.status === 'awarded' && l.project_id ? <Link className="btn ghost" href={`/projects/${l.project_id}/overview`}>Open the project</Link> : <Link className="btn ghost" href={`/marketplace/${l.id}`}>{st ? 'Compare bids' : 'View job'}</Link>}
              </div>
            </div>
          );
        })}
      </>
    );
  }

  return (
    <>
      <div className="stack">
        <h1>Projects</h1>
        <p className="muted">Signed in as {user.email}</p>
      </div>
      {tabs}
      <WhyJobfile
        role={company ? 'contractor' : 'homeowner'}
        hidden={whyHidden}
        marketplace={mk}
        startForm={company ? <StartProjectForm companyId={company.company_id} companyName={company.companies?.name} open={!!searchParams.error} /> : undefined}
      />

      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}

      {got.length > 0 && (
        <section className="stack" aria-label="Invitations for you">
          {got.map((i) => (
            <Link key={i.id} href={`/invites/${i.id}`} className="card" style={{ borderLeft: '6px solid var(--accent)' }}>
              <b>{i.homeowner_name || 'A homeowner'} invited you to {i.project_name}</b>
              <span className="muted small">Tap to review and accept or decline.</span>
            </Link>
          ))}
        </section>
      )}

      {sent.length > 0 && (
        <section className="stack" aria-label="Invitations you sent">
          {sent.map((i) => (
            <Link key={i.id} href={`/invites/${i.id}`} className="card">
              <div className="row" style={{ justifyContent: 'space-between' }}><b>{i.project_name}</b><span className="pill warn">Waiting for contractor</span></div>
              <span className="muted small">Invited {i.contractor_name || i.contractor_email}</span>
            </Link>
          ))}
        </section>
      )}

      {/* The benefits card already has this button while it is open. */}
      {!company && whyHidden && (
        <div className="row"><Link className="btn" href="/invites/new">Start a project and invite a contractor</Link></div>
      )}

      {([['Ongoing projects', list.filter((p: any) => !p.completed_at)], ['Completed projects', list.filter((p: any) => p.completed_at)]] as [string, typeof list][]).map(([heading, rows]) =>
        rows.length === 0 ? null : (
          <section className="stack" key={heading} aria-label={heading}>
            <h2>{heading}</h2>
            {rows.map((p: any) => (
              <Link key={p.id} href={`/projects/${p.id}/overview`} className="card proj" style={{ flexDirection: 'row', alignItems: 'center' }}>
                {covers.get(p.id) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={covers.get(p.id)} alt="" width={72} height={72} style={{ borderRadius: 14, objectFit: 'cover', flex: 'none' }} />
                ) : (
                  <KitchenArt />
                )}
                <div className="stack" style={{ gap: 4, flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                    <h3>{p.name}</h3>
                    <span className={`pill ${p.completed_at ? 'ok' : p.closeout_started_at ? 'warn' : ''}`}>{p.completed_at ? 'Completed' : p.closeout_started_at ? 'Closeout' : 'Active'}</span>
                  </div>
                  <span className="muted small">{[p.address, p.homeowner_name].filter(Boolean).join(' · ') || 'No address yet'}</span>
                </div>
                <span aria-hidden="true">›</span>
              </Link>
            ))}
          </section>
        ),
      )}

      {!company && list.length === 0 && (
        <>
          <form action={createCompany} className="card">
            <h2>I&rsquo;m a contractor</h2>
            <p className="muted">Set up your company, then open a project and invite your customer.</p>
            <label className="fld">
              Company name
              <input name="name" required placeholder="Ridgeline Builders" autoComplete="organization" />
            </label>
            <div className="row">
              <button className="btn" type="submit">Create my company</button>
            </div>
          </form>
          <div className="card">
            <h2>I&rsquo;m a homeowner</h2>
            <p className="muted">
              Your contractor can open a project and invite <b>{user.email}</b>, or you can start one yourself and invite your contractor. If a contractor
              invited you and nothing shows up, ask them which email address they used.
            </p>
          </div>
        </>
      )}

      {(alerts ?? []).length > 0 && (
        <section className="card" aria-label="Recent alerts">
          <h2>Recent alerts</h2>
          <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {(alerts ?? []).map((a) => (
              <li key={a.id}>
                <Link href={a.project_id ? `/projects/${a.project_id}` : '/projects'}>{a.title}</Link>
                <span className="muted small" style={{ display: 'block' }}>{when(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
