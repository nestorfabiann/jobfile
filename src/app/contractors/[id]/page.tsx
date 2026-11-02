import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import Stars from '@/components/Stars';
import { companyReviews, HOME_CATS, summarize } from '@/lib/reviews';
import { reportReview } from './actions';
import { fmtDate, INSURANCE_KINDS, isCurrent, signedUrls, type InsuranceKind } from '@/lib/companyProfile';

export const dynamic = 'force-dynamic';

/** Small line icons for the contractor's links. */
function LinkIcon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'Facebook')
    return (<svg {...common}><circle cx="12" cy="12" r="10" /><path d="M15.5 8h-1.6A2.4 2.4 0 0 0 11.5 10.4V21M8.5 13h6.5" /></svg>);
  if (name === 'Instagram')
    return (<svg {...common}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" /></svg>);
  if (name === 'Document')
    return (<svg {...common}><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" /><path d="M14 2v5h5M9 13h6M9 17h6" /></svg>);
  if (name === 'Website')
    return (<svg {...common}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></svg>);
  return (<svg {...common}><path d="M12 2l3 6.5 7 .9-5.1 4.9 1.3 7-6.2-3.4L5.8 21.3l1.3-7L2 9.4l7-.9z" /></svg>);
}

export default async function Profile({ params, searchParams }: { params: { id: string }; searchParams: { reported?: string } }) {
  await requireUser();
  const db = supabaseAdmin();
  const { data: c } = await db.from('companies').select('*').eq('id', params.id).maybeSingle<any>();
  if (!c) notFound();
  const [{ data: photos }, { data: ins }] = await Promise.all([
    db.from('company_photos').select('id,path,caption').eq('company_id', c.id).order('created_at'),
    db.from('company_insurance').select('kind,status,expires_on').eq('company_id', c.id),
  ]);
  const urls = await signedUrls('company-photos', [...(photos ?? []).map((p) => p.path as string), ...(c.logo_path ? [c.logo_path as string] : [])]);
  const verified = (ins ?? []).filter((i: any) => isCurrent(i)) as { kind: InsuranceKind; expires_on: string }[];
  const links = [['Website', c.website], ['Facebook', c.facebook], ['Instagram', c.instagram], ['Reviews and more', c.other_link]].filter(([, u]) => !!u) as [string, string][];
  const details = [
    ['Years in business', c.year_started ? `Since ${c.year_started}` : ''],
    ['Service area', c.service_radius_mi ? `${c.service_radius_mi} miles` : ''],
    ['Crew size', c.crew_size ? `${c.crew_size}` : ''],
    ['Workmanship warranty', c.warranty],
    ['Hours', c.hours],
    ['Accepts', (c.payments ?? []).join(', ')],
    ['License or registration', c.license_note ? `${c.license_note} (stated by the contractor)` : ''],
  ].filter(([, v]) => !!v) as [string, string][];
  const reviews = await companyReviews(c.id);
  const s = summarize(reviews);
  const month = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <>
      <div className="stack">
        <Link href="/projects" className="small">‹ All projects</Link>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {c.logo_path && urls.get(c.logo_path) ? <img src={urls.get(c.logo_path)} alt="" width={64} height={64} style={{ borderRadius: 16, objectFit: 'cover', flex: 'none' }} /> : null}
          <h1>{c.name}</h1>
        </div>
        <div className="row">
          {verified.length > 0 && <span className="pill ok" style={{ gap: 6, alignItems: 'center' }}><LinkIcon name="Document" size={14} />Insurance verified until {fmtDate(verified.map((v) => v.expires_on).sort()[0])}</span>}
          {(c.languages ?? []).map((l: string) => <span className="pill" key={l}>{l}</span>)}
        </div>
      </div>
      {(c.about || (c.services ?? []).length > 0) && (
        <div className="card">
          {c.about ? <p style={{ whiteSpace: 'pre-wrap' }}>{c.about}</p> : null}
          {(c.services ?? []).length > 0 && <div className="chips">{(c.services as string[]).map((x) => <span className="pill" key={x}>{x}</span>)}</div>}
        </div>
      )}

      {(photos ?? []).length > 0 && (
        <div className="card">
          <h2>Photos of their work</h2>
          <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
            {(photos ?? []).map((p) => urls.get(p.path as string) ? (
              <figure key={p.id} style={{ margin: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urls.get(p.path as string)} alt={(p.caption as string) || 'Work photo'} loading="lazy" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 12 }} />
                {p.caption ? <figcaption className="small muted">{p.caption}</figcaption> : null}
              </figure>
            ) : null)}
          </div>
        </div>
      )}

      {details.length > 0 && (
        <div className="card">
          <h2>Business details</h2>
          {details.map(([k, v]) => <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', alignItems: 'flex-start' }} key={k}><span className="muted">{k}</span><b style={{ textAlign: 'right' }}>{v}</b></div>)}
          {verified.length > 0 && <p className="muted small">{verified.map((v) => INSURANCE_KINDS[v.kind]).join(' and ')} insurance certificate approved by a Jobfile admin. This is not a guarantee of coverage. Confirm coverage with the contractor before work starts.</p>}
        </div>
      )}

      {links.length > 0 && (
        <div className="card">
          <h2>Find them online</h2>
          <p className="muted small">These links are added by the contractor and open other websites.</p>
          <div className="row">
            {links.map(([label, url]) => <a key={label} className="btn ghost" href={url} target="_blank" rel="noopener noreferrer nofollow" style={{ gap: 8 }}><LinkIcon name={label} />{label}</a>)}
          </div>
        </div>
      )}

      {searchParams.reported ? <div className="box ok">Thanks. An admin will review it.</div> : null}

      {s.count === 0 ? (
        <div className="card"><p className="muted">No ratings yet. Ratings appear after a completed project, once both sides have rated.</p></div>
      ) : (
        <div className="card">
          <div className="row">
            <span className="rvbig">{s.avg.toFixed(1)}</span>
            <div><Stars n={s.avg} /><div className="muted small">{s.count} verified project{s.count > 1 ? 's' : ''}</div></div>
          </div>
          {s.dist.map((d) => (
            <div className="rdist" key={d.n}><span>{d.n}★</span><i><b style={{ width: `${d.pct}%` }} /></i><span className="muted">{d.pct}%</span></div>
          ))}
          <div className="row small" style={{ flexWrap: 'wrap' }}>
            {Object.entries(HOME_CATS).filter(([k]) => s.cats[k]).map(([k, label]) => (
              <span className="pill" key={k}>{label} {s.cats[k].toFixed(1)}</span>
            ))}
          </div>
          <p className="muted small">Every review is from a homeowner who completed a project with this contractor on Jobfile.</p>
        </div>
      )}

      {reviews.map((r) => (
        <article className="card" key={r.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}><b>{r.homeowner_name}</b><Stars n={r.overall} small /></div>
          <div className="muted small">{r.project_name} · {month(r.created_at)} <span className="pill ok">Verified project</span></div>
          {r.comment ? <p>{r.comment}</p> : null}
          {r.reply ? <div className="reply"><b>Reply from {c.name}:</b> {r.reply}</div> : null}
          {!r.reported_at && (
            <details>
              <summary className="small muted" style={{ cursor: 'pointer' }}>Report this review</summary>
              <form action={reportReview} className="row" style={{ marginTop: 8 }}>
                <input type="hidden" name="review_id" value={r.id} />
                <input type="hidden" name="company_id" value={c.id} />
                <select name="reason" aria-label="Reason">
                  {['Abuse or harassment', 'Personal information', 'Not about the work', 'Looks fake', 'Other'].map((x) => <option key={x}>{x}</option>)}
                </select>
                <button className="btn ghost" type="submit">Send report</button>
              </form>
            </details>
          )}
        </article>
      ))}
    </>
  );
}
