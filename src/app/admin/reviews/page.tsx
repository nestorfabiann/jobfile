import { requireAdmin } from '@/lib/admin';
import Stars from '@/components/Stars';
import AdminReviewActions from '@/components/AdminReviewActions';
import { hideReview, restoreReview } from '../actions';

export const dynamic = 'force-dynamic';

export default async function AdminReviews({ searchParams }: { searchParams: { all?: string } }) {
  const { db } = await requireAdmin();
  const all = searchParams.all === '1';
  let q = db.from('reviews').select('*, projects(name), companies:subject_company_id(name)').order('created_at', { ascending: false }).limit(100);
  if (!all) q = q.not('reported_at', 'is', null);
  const { data } = await q;
  return (
    <>
      <h1>Reviews</h1>
      <p className="muted small">
        Hide a review only for rule violations: abuse, personal details, off-topic or fake. Never for a low rating alone. Every action is written to the audit log.
      </p>
      <div className="row">
        <a className={`btn ${all ? 'ghost' : ''}`} href="/admin/reviews">Reported</a>
        <a className={`btn ${all ? '' : 'ghost'}`} href="/admin/reviews?all=1">All reviews</a>
      </div>
      {(data ?? []).length === 0 && <div className="card"><p className="muted">{all ? 'No reviews yet.' : 'No reported reviews.'}</p></div>}
      {(data ?? []).map((r: any) => (
        <div className="card" key={r.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{r.reviewer_role === 'homeowner' ? `Homeowner about ${r.companies?.name ?? 'contractor'}` : 'Contractor about homeowner'}</b>
            <Stars n={r.overall} small />
          </div>
          <div className="muted small">Project: {r.projects?.name} · {new Date(r.created_at).toLocaleDateString('en-US')}</div>
          <div className="row">
            {r.reported_at && <span className="pill warn">Reported: {r.report_reason}</span>}
            {r.hidden_at && <span className="pill bad">Hidden: {r.hidden_reason}</span>}
          </div>
          {r.comment ? <p>{r.comment}</p> : <p className="muted small">No comment.</p>}
          <AdminReviewActions id={r.id} hidden={!!r.hidden_at} reported={!!r.reported_at} hide={hideReview} restore={restoreReview} />
        </div>
      ))}
    </>
  );
}
