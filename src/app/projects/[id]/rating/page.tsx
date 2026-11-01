import Link from 'next/link';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import StarInput from '@/components/StarInput';
import Stars from '@/components/Stars';
import PendingButton from '@/components/PendingButton';
import { catsFor, homeownerReviews, homeownerSummaryVisible, REVEAL_DAYS, revealedBy, summarize, type ReviewRow } from '@/lib/reviews';
import { replyToReview, submitReview } from './actions';

export const dynamic = 'force-dynamic';

export default async function Rating({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string; saved?: string };
}) {
  const { project, role, contractorName, homeownerName, homeownerJoined } = await loadProject(params.id);
  const done = !!project.completed_at;
  const admin = supabaseAdmin();
  const { data } = await admin.from('reviews').select('*').eq('project_id', project.id);
  const rows = (data ?? []) as ReviewRow[];
  const mine = rows.find((r) => r.reviewer_role === role);
  const theirs = rows.find((r) => r.reviewer_role !== role);
  const revealed = done && revealedBy(project.completed_at, !!mine && !!theirs);
  const canEdit = done && !(mine && revealed);
  const target = role === 'homeowner' ? contractorName : homeownerName;
  const cats = catsFor(role === 'homeowner' ? 'homeowner' : 'contractor');
  const revealDate = project.completed_at
    ? new Date(new Date(project.completed_at).getTime() + REVEAL_DAYS * 86400_000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  // Optional private summary for contractors. Off unless HOMEOWNER_RATINGS_VISIBLE=true.
  let hs: ReturnType<typeof summarize> | null = null;
  if (role === 'contractor' && homeownerSummaryVisible() && homeownerJoined) {
    const { data: h } = await admin.from('project_members').select('user_id').eq('project_id', project.id).eq('role', 'homeowner').limit(1).maybeSingle();
    if (h?.user_id) {
      const past = (await homeownerReviews(h.user_id as string)).filter((r) => r.project_id !== project.id);
      if (past.length) hs = summarize(past);
    }
  }

  const Show = ({ r, title }: { r: ReviewRow; title: string }) => (
    <div className="card">
      <b>{title}</b>
      <div className="row"><Stars n={r.overall} /><span className="muted small">Overall</span></div>
      {Object.entries(r.categories ?? {}).map(([k, v]) => (
        <div className="row small" key={k} style={{ justifyContent: 'space-between' }}>
          <span className="muted">{catsFor(r.reviewer_role)[k] ?? k}</span>
          <Stars n={v} small />
        </div>
      ))}
      {r.comment ? <p>{r.comment}</p> : null}
      {r.reply ? <div className="reply"><b>Reply:</b> {r.reply}</div> : null}
    </div>
  );

  return (
    <>
      <div className="stack">
        <h2>Ratings</h2>
        <p className="muted small">
          Rate each other after the project is complete. Ratings stay hidden until you both rate, or until {REVEAL_DAYS} days after completion, so no one rates in reaction to the other.
        </p>
      </div>
      {searchParams.saved ? <div className="box ok">Saved.</div> : null}
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}

      {!done && (
        <div className="card">
          <p className="muted">Ratings open when the contractor marks the project complete on the Overview tab.</p>
        </div>
      )}

      {done && mine && !revealed && (
        <div className="box ok">
          Your rating is saved and hidden. It becomes visible when {role === 'homeowner' ? contractorName : homeownerName} rates, or on {revealDate}. You can still edit it until then.
        </div>
      )}

      {done && revealed && (
        <>
          {mine ? <Show r={mine} title={`You rated ${target}`} /> : <div className="card"><p className="muted">You did not rate this project, and the window to do so has now closed.</p></div>}
          {theirs && !theirs.hidden_at ? <Show r={theirs} title={`${role === 'homeowner' ? contractorName : homeownerName} rated you`} /> : null}
          {role === 'contractor' && theirs && !theirs.hidden_at && !theirs.reply && (
            <form action={replyToReview} className="card">
              <input type="hidden" name="project_id" value={project.id} />
              <b>Reply publicly (once)</b>
              <textarea name="reply" rows={3} maxLength={600} required aria-label="Reply" placeholder="Thank them, or respond to the feedback calmly and factually." />
              <PendingButton>Post reply</PendingButton>
            </form>
          )}
        </>
      )}

      {canEdit && (
        <form action={submitReview} className="card">
          <input type="hidden" name="project_id" value={project.id} />
          <h3>{mine ? 'Edit your rating of' : 'How was working with'} {target}?</h3>
          <StarInput name="overall" label="Overall" big defaultValue={mine?.overall ?? 0} />
          {Object.entries(cats).map(([k, label]) => (
            <StarInput key={k} name={`cat_${k}`} label={label} optional defaultValue={mine?.categories?.[k] ?? 0} />
          ))}
          <textarea name="comment" rows={4} maxLength={1000} aria-label="Comment" defaultValue={mine?.comment ?? ''} placeholder="Share what it was like. Keep it about the work and the experience." />
          <p className="muted small">Keep it honest and about the project. Reviews with abuse, personal details or accusations unrelated to the work can be removed.</p>
          <PendingButton>{mine ? 'Update rating' : 'Submit rating'}</PendingButton>
        </form>
      )}

      {role === 'homeowner' && (
        <p className="small"><Link href={`/contractors/${project.company_id}`}>See {contractorName}&apos;s profile and reviews</Link></p>
      )}

      {hs && (
        <div className="card">
          <b>Private summary: this homeowner&apos;s past projects</b>
          <div className="row"><span className="rvbig">{hs.avg.toFixed(1)}</span><div><Stars n={hs.avg} /><div className="muted small">{hs.count} past project{hs.count > 1 ? 's' : ''}</div></div></div>
          <p className="muted small">Only you, as a contractor on this project, see this summary. It shows scores only, never comments or other contractors&apos; names.</p>
        </div>
      )}
    </>
  );
}
