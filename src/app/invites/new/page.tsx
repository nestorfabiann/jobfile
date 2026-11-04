import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { createInvite } from '../actions';

export default async function NewInvite({ searchParams }: { searchParams: { error?: string } }) {
  const { sb, user } = await requireUser();
  const { data: mem } = await sb.from('company_members').select('company_id').eq('user_id', user.id).limit(1);
  if ((mem ?? []).length > 0) redirect('/projects?error=Contractors+open+projects+from+the+Projects+page.');
  return (
    <>
      <div className="stack">
        <Link href="/projects" className="small">‹ Projects</Link>
        <h1>Start a project</h1>
        <p className="muted">Describe the job, then invite your contractor. They see it only after they accept. <b>They do not need a Jobfile account yet. They join free from the email link.</b></p>
      </div>
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}
      <form action={createInvite} className="card">
        <label className="fld">Project name<input name="name" required maxLength={120} placeholder="Bathroom remodel" /></label>
        <label className="fld">Job address<input name="address" maxLength={200} placeholder="412 Maple Court, Plano, TX" autoComplete="street-address" /></label>
        <label className="fld">What do you want done?<textarea name="description" rows={5} maxLength={2000} placeholder="Replace the tub with a walk-in shower, new vanity, tile floor. I want to start in January." /></label>
        <label className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
          <input type="checkbox" name="is_homestead" />
          <span>This is my homestead.<span className="muted small" style={{ display: 'block' }}>Texas has extra contract rules for homestead jobs. Jobfile will track them.</span></span>
        </label>
        <h2>Invite your contractor</h2>
        <div className="grid2">
          <label className="fld">Contractor email<input name="contractor_email" type="email" required maxLength={200} placeholder="mike@example.com" autoComplete="off" /></label>
          <label className="fld">Name or company (optional)<input name="contractor_name" maxLength={120} autoComplete="off" /></label>
        </div>
        <label className="fld">Message (optional)<textarea name="message" rows={3} maxLength={500} placeholder="Hi Mike, as discussed, let's use Jobfile to keep the price, photos and payments in one place." /></label>
        <p className="muted small">We email them an invitation. Only the person who signs in with that email address can accept. The invite expires in 14 days.</p>
        <div className="row"><button className="btn" type="submit">Create project and send invite</button></div>
      </form>
    </>
  );
}
