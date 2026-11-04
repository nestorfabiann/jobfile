import { createProject } from '@/app/projects/actions';

/** Contractor "Start a project" button that opens the new-project form in place (no client JS needed). */
export default function StartProjectForm({ companyId, companyName, open, heading, ghost }: { companyId: string; companyName?: string | null; open?: boolean; heading?: string; ghost?: boolean }) {
  const form = (
    <details className={heading ? 'startp startp-head' : 'startp'} open={open}>
      {heading ? (
        <summary>
          <h2>{heading}</h2>
          <span className="pill-add">+ Start a project</span>
        </summary>
      ) : (
        <summary className={ghost ? 'btn ghost' : 'btn'}>Start a project</summary>
      )}
      <form action={createProject} className="stack" style={{ marginTop: 12 }}>
        {companyName ? <p className="muted small">{companyName}</p> : null}
        <div className="box ok">They do not need an account yet. They create a free one from your invite.</div>
        <input type="hidden" name="company_id" value={companyId} />
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
    </details>
  );
  if (!ghost) return form;
  return (
    <>
      {form}
      <p className="muted small startp-hint">
        Got a customer already? Start a project and invite them. They do not need a Jobfile account yet.
      </p>
    </>
  );
}
