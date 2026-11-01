import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import Stars from '@/components/Stars';
import { companyReviews, HOME_CATS, summarize } from '@/lib/reviews';
import { reportReview } from './actions';

export const dynamic = 'force-dynamic';

export default async function Profile({ params, searchParams }: { params: { id: string }; searchParams: { reported?: string } }) {
  await requireUser();
  const { data: c } = await supabaseAdmin().from('companies').select('id,name').eq('id', params.id).maybeSingle();
  if (!c) notFound();
  const reviews = await companyReviews(c.id);
  const s = summarize(reviews);
  const month = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <>
      <div className="stack">
        <Link href="/projects" className="small">‹ All projects</Link>
        <h1>{c.name}</h1>
      </div>
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
