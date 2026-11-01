import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import KitchenArt from '@/components/KitchenArt';
import { createCompany, createProject } from './actions';

const TZ = 'America/Chicago';
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default async function Projects({ searchParams }: { searchParams: { error?: string } }) {
  const { sb, user } = await requireUser();

  const [{ data: projects }, { data: memberships }, { data: alerts }] = await Promise.all([
    sb.from('projects').select('id,name,address,homeowner_name,created_at').order('created_at', { ascending: false }),
    sb.from('company_members').select('company_id, companies(name)').eq('user_id', user.id),
    sb
      .from('notifications')
      .select('id,title,created_at,project_id')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

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

  return (
    <>
      <div className="stack">
        <h1>Projects</h1>
        <p className="muted">Signed in as {user.email}</p>
      </div>

      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}

      {list.length > 0 && (
        <section className="stack" aria-label="Your projects">
          {list.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}/overview`} className="card proj" style={{ flexDirection: 'row', alignItems: 'center' }}>
              {covers.get(p.id) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={covers.get(p.id)} alt="" width={72} height={72} style={{ borderRadius: 14, objectFit: 'cover', flex: 'none' }} />
              ) : (
                <KitchenArt />
              )}
              <div className="stack" style={{ gap: 4, flex: 1, minWidth: 0 }}>
                <h3>{p.name}</h3>
                <span className="muted small">{[p.address, p.homeowner_name].filter(Boolean).join(' · ') || 'No address yet'}</span>
              </div>
              <span aria-hidden="true">›</span>
            </Link>
          ))}
        </section>
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
              Your contractor opens the project and invites <b>{user.email}</b>. Once they do, it shows up here. If it doesn&rsquo;t,
              ask them which email address they used.
            </p>
          </div>
        </>
      )}

      {company && (
        <form action={createProject} className="card">
          <h2>New project</h2>
          <p className="muted small">{company.companies?.name}</p>
          <input type="hidden" name="company_id" value={company.company_id} />
          <div className="grid2">
            <label className="fld">
              Project name
              <input name="name" required placeholder="Kitchen remodel" />
            </label>
            <label className="fld">
              Job address
              <input name="address" placeholder="412 Maple Court, Austin, TX" autoComplete="street-address" />
            </label>
            <label className="fld">
              Homeowner name
              <input name="homeowner_name" placeholder="Dana Whitfield" autoComplete="off" />
            </label>
            <label className="fld">
              Homeowner email
              <input name="homeowner_email" type="email" required placeholder="dana@example.com" autoComplete="off" />
            </label>
          </div>
          <label className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
            <input type="checkbox" name="is_homestead" />
            <span>
              This is the owner&rsquo;s homestead.
              <span className="muted small" style={{ display: 'block' }}>
                Texas has extra contract rules for homestead jobs. Jobfile will track them.
              </span>
            </span>
          </label>
          <div className="row">
            <button className="btn" type="submit">Create project and invite homeowner</button>
          </div>
        </form>
      )}

      {(alerts ?? []).length > 0 && (
        <section className="card" aria-label="Recent alerts">
          <h2>Recent alerts</h2>
          <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {(alerts ?? []).map((a) => (
              <li key={a.id}>
                <Link href={`/projects/${a.project_id}`}>{a.title}</Link>
                <span className="muted small" style={{ display: 'block' }}>{when(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
