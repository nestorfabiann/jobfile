import Link from 'next/link';
import { redirect } from 'next/navigation';
import { loadProject } from '@/lib/project';
import { invitePartner } from '@/app/partner/actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Add a partner · Jobfile' };

export default async function AddPartner({ params, searchParams }: { params: { id: string }; searchParams: { error?: string; name?: string; email?: string; scope?: string } }) {
  const { project, role } = await loadProject(params.id);
  if (role !== 'contractor') redirect(`/projects/${project.id}/overview`);
  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 90 }}>
      <Link href={`/projects/${project.id}/overview`} className="small" style={{ fontWeight: 700 }}>‹ {project.name}</Link>
      <h1>Add a partner</h1>
      <p className="muted">Bring in a contractor you work with. They see only their part: the scope, their price, the dates and messages with you. They don’t see the homeowner’s phone or email, the total, or other partners’ prices.</p>
      {searchParams.error ? <div className="box warn" role="alert">{searchParams.error}</div> : null}
      <form action={invitePartner} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input type="hidden" name="project_id" value={project.id} />
        <label htmlFor="pn">Company name</label>
        <input id="pn" name="name" defaultValue={searchParams.name ?? ''} maxLength={120} required placeholder="Bright Electric" />
        <label htmlFor="pe">Their email address</label>
        <input id="pe" name="email" type="email" defaultValue={searchParams.email ?? ''} maxLength={200} required placeholder="name@company.com" />
        <p className="muted small">If they are on Jobfile with this email, they get the invite right away. If not, they get an email to join free.</p>
        <label htmlFor="ps">Their part of the job</label>
        <input id="ps" name="scope" defaultValue={searchParams.scope ?? ''} maxLength={400} required placeholder="Deck lighting, 6 fixtures" />
        <label htmlFor="pp">Their price (dollars)</label>
        <input id="pp" name="price" inputMode="decimal" required placeholder="1400" />
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 130 }}><label htmlFor="sd">Starts</label><input id="sd" name="start_date" type="date" /></div>
          <div style={{ flex: 1, minWidth: 130 }}><label htmlFor="ed">Ends</label><input id="ed" name="end_date" type="date" /></div>
        </div>
        <div className="box" style={{ fontSize: 14 }}>They work under your contract. You stay the contact and you pay them. The homeowner is told when they accept and can remove them. Partners must be within 50 miles of your business.</div>
        <button className="btn" type="submit">Send invite</button>
      </form>
    </div>
  );
}
