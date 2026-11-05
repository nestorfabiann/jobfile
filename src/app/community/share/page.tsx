import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { signedUrls } from '@/lib/companyProfile';
import { JOB_TYPES, requireMarketplace } from '@/lib/marketplace';
import { submitShowcase } from '../actions';

export const dynamic = 'force-dynamic';

export default async function Share({ searchParams }: { searchParams: { project?: string; error?: string } }) {
  requireMarketplace();
  const { user } = await requireUser();
  const db = supabaseAdmin();

  // Finished projects this person belongs to, as a homeowner or on the contractor's team.
  const [{ data: pms }, { data: cms }] = await Promise.all([
    db.from('project_members').select('project_id').eq('user_id', user.id),
    db.from('company_members').select('company_id').eq('user_id', user.id),
  ]);
  const pids = (pms ?? []).map((m: any) => m.project_id as string);
  const cids = (cms ?? []).map((m: any) => m.company_id as string);
  const [a, b] = await Promise.all([
    pids.length ? db.from('projects').select('id,name,completed_at,company_id').in('id', pids).not('completed_at', 'is', null) : Promise.resolve({ data: [] as any[] }),
    cids.length ? db.from('projects').select('id,name,completed_at,company_id').in('company_id', cids).not('completed_at', 'is', null) : Promise.resolve({ data: [] as any[] }),
  ]);
  const byId = new Map<string, any>();
  [...((a.data ?? []) as any[]), ...((b.data ?? []) as any[])].forEach((p) => byId.set(p.id as string, p));
  const all = Array.from(byId.values()).sort((x, y) => String(y.completed_at).localeCompare(String(x.completed_at)));
  let shared = new Set<string>();
  try {
    const { data: sp } = all.length ? await db.from('community_posts').select('project_id').eq('kind', 'showcase').in('project_id', all.map((p) => p.id)).in('status', ['pending_other', 'pending_review', 'live', 'held']) : { data: [] as any[] };
    shared = new Set((sp ?? []).map((x: any) => x.project_id as string));
  } catch { /* community tables not created yet */ }
  const choices = all.filter((p) => !shared.has(p.id));
  const project = choices.find((p) => p.id === searchParams.project);

  let photos: { id: string; path: string; url: string }[] = [];
  let listing: { city?: string; job_type?: string } = {};
  if (project) {
    const { data: ph } = await db.from('photos').select('id,path').eq('project_id', project.id).order('created_at').limit(60);
    const urls = await signedUrls('project-photos', ((ph ?? []) as any[]).map((x) => x.path as string), 3600);
    photos = ((ph ?? []) as any[]).map((x) => ({ id: x.id as string, path: x.path as string, url: urls.get(x.path as string) ?? '' })).filter((x) => x.url);
    const { data: l } = await db.from('marketplace_listings').select('city,job_type').eq('project_id', project.id).maybeSingle();
    listing = (l ?? {}) as any;
  }

  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Link href="/community" className="small">‹ Community</Link>
      <h1>Share a finished project</h1>
      <p className="muted">Pick a finished project and two photos. Only the city is shown, never the address or names. The other side approves it, then Jobfile reviews it before it goes live.</p>
      {searchParams.error ? <div className="box bad" role="alert">{searchParams.error}</div> : null}

      {!project ? (
        <>
          {choices.length === 0 ? (
            <div className="card"><p className="muted">You have no finished projects to share yet. Once a project is finished on Jobfile, it shows up here.</p></div>
          ) : <span className="muted small">Your finished projects</span>}
          {choices.map((p) => (
            <Link key={p.id} className="card" href={`/community/share?project=${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <b>{p.name}</b>
              <span className="muted small">Finished {new Date(p.completed_at).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' })} · Choose ›</span>
            </Link>
          ))}
        </>
      ) : photos.length < 2 ? (
        <div className="card">
          <b>{project.name}</b>
          <p className="muted">This project needs at least two photos to share a before and after. Add photos on the project’s Photos tab, then come back.</p>
          <Link className="btn" href={`/projects/${project.id}/photos`}>Open the photos</Link>
        </div>
      ) : (
        <form action={submitShowcase} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="hidden" name="project_id" value={project.id} />
          <div className="card row" style={{ justifyContent: 'space-between' }}><b>{project.name}</b><Link href="/community/share" style={{ fontWeight: 700 }}>Change</Link></div>
          <fieldset className="cmfs"><legend>1. Pick the “before” photo</legend>
            <div className="cmthumbs">{photos.map((x) => (
              <label key={x.id} className="cmthumb"><input type="radio" name="before_id" value={x.id} required /><img src={x.url} alt="Project photo" loading="lazy" /></label>
            ))}</div>
          </fieldset>
          <fieldset className="cmfs"><legend>2. Pick the “after” photo</legend>
            <div className="cmthumbs">{photos.map((x) => (
              <label key={x.id} className="cmthumb"><input type="radio" name="after_id" value={x.id} required /><img src={x.url} alt="Project photo" loading="lazy" /></label>
            ))}</div>
          </fieldset>
          <label className="fld">Title<input name="title" required minLength={3} maxLength={100} defaultValue="" placeholder="Dated oak to deep green" /></label>
          <label className="fld">Kind of work
            <select name="trade" required defaultValue={JOB_TYPES[listing.job_type ?? ''] ? listing.job_type : ''}><option value="" disabled>Pick one</option>{Object.keys(JOB_TYPES).map((t) => <option key={t} value={t}>{t}</option>)}</select>
          </label>
          <div className="grid2">
            <label className="fld">City<input name="city" required maxLength={80} defaultValue={listing.city ?? ''} placeholder="Plano" /></label>
            <label className="fld">Days it took (optional)<input name="days" inputMode="numeric" maxLength={4} placeholder="4" /></label>
          </div>
          <label className="fld">The story (optional)<textarea name="body" rows={4} maxLength={800} placeholder="What you did and why. No names, addresses, phone numbers or links." /></label>
          <div className="card" style={{ gap: 8 }}>
            <label className="row" style={{ gap: 10, flexWrap: 'nowrap', cursor: 'pointer' }}><input type="checkbox" name="share_cost" value="1" /><span><b>Show the cost range</b><br /><span className="muted small">Helps people plan. Optional.</span></span></label>
            <div className="grid2">
              <label className="fld">Low ($)<input name="cost_low" inputMode="decimal" placeholder="2800" /></label>
              <label className="fld">High ($)<input name="cost_high" inputMode="decimal" placeholder="3400" /></label>
            </div>
          </div>
          <div className="box ok"><b>Private by default.</b> Address and names are never shown. The other side on this project approves the post first, then Jobfile reviews it before it appears.</div>
          <button className="btn accent" type="submit">Send for approval</button>
        </form>
      )}
    </div>
  );
}
