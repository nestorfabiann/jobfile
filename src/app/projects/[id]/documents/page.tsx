import Link from 'next/link';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { fmtDate, isCurrent, signedUrls } from '@/lib/companyProfile';
import { deleteDocument, uploadDocument } from './actions';

type Doc = { id: string; kind: string; title: string; note: string; path: string; file_type: string; uploaded_by: string | null; uploader_role: string | null; created_at: string };

const KIND_LABEL: Record<string, string> = { permit: 'Permit', insurance: 'Insurance', receipt: 'Receipt', warranty: 'Warranty or manual', other: 'Other' };
const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' });

export default async function Documents({ params, searchParams }: { params: { id: string }; searchParams: { error?: string } }) {
  const { sb, project, role, user } = await loadProject(params.id);
  const admin = supabaseAdmin();
  const [{ data: docRows }, { data: agr }, { data: ins }] = await Promise.all([
    sb.from('project_documents').select('*').eq('project_id', project.id).order('created_at', { ascending: false }),
    sb.from('agreements').select('executed_at,permits_by').eq('project_id', project.id).maybeSingle(),
    admin.from('company_insurance').select('status,expires_on').eq('company_id', project.company_id),
  ]);
  const docs = (docRows ?? []) as Doc[];
  const urls = await signedUrls('project-docs', docs.map((d) => d.path));
  const has = (k: string) => docs.some((d) => d.kind === k);
  const current = (ins ?? []).filter((i: any) => isCurrent(i)).map((i: any) => i.expires_on as string).sort();
  const permitsBy = (agr?.permits_by as string | undefined) === 'homeowner' ? 'Homeowner' : 'Contractor';
  const finished = !!project.completed_at;

  const checklist: { key: string; title: string; sub: string; ok: boolean; wait?: boolean }[] = [
    { key: 'permit', title: 'Permit', sub: has('permit') ? 'Added below' : `${permitsBy} pulls it. Add it here when you have it.`, ok: has('permit') },
    { key: 'ins', title: 'Certificate of insurance', sub: current.length ? `Contractor insured to ${fmtDate(current[0])}` : has('insurance') ? 'Added below' : 'Not on file yet', ok: current.length > 0 || has('insurance') },
    { key: 'agr', title: 'Signed agreement', sub: agr?.executed_at ? 'Signed by both sides' : 'Not signed yet', ok: !!agr?.executed_at },
    { key: 'rec', title: 'Material receipts', sub: has('receipt') ? `${docs.filter((d) => d.kind === 'receipt').length} added` : 'None yet', ok: has('receipt') },
    { key: 'war', title: 'Warranty and manuals', sub: has('warranty') ? 'Added below' : finished ? 'Not added yet' : 'Added when the job is done', ok: has('warranty'), wait: !has('warranty') && !finished },
  ];
  const onFile = checklist.filter((c) => c.ok).length;

  return (
    <>
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Documents</h2>
          <span className={`pill ${onFile === checklist.length ? 'ok' : 'warn'}`}>{onFile} of {checklist.length} on file</span>
        </div>
        <p className="muted small">Everything both sides may need later, in one place. Both of you can see it.</p>
      </div>

      <div className="card">
        {checklist.map((c) => (
          <div key={c.key} className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ minWidth: 0 }}>
              <b>{c.key === 'agr' && c.ok ? <Link href={`/projects/${project.id}/agreement`}>{c.title}</Link> : c.title}</b>
              <div className="muted small">{c.sub}</div>
            </div>
            <span className={`pill ${c.ok ? 'ok' : c.wait ? '' : 'warn'}`}>{c.ok ? 'On file' : c.wait ? 'After the job' : 'Missing'}</span>
          </div>
        ))}
      </div>

      {docs.length > 0 && (
        <div className="card">
          <h3>Added to this project</h3>
          {docs.map((d) => (
            <div key={d.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ minWidth: 0 }}>
                <b style={{ overflowWrap: 'anywhere' }}>{urls.get(d.path) ? <a href={urls.get(d.path)} target="_blank" rel="noopener noreferrer">{d.title}</a> : d.title}</b>
                <div className="muted small">{KIND_LABEL[d.kind] ?? 'Other'} · added {when(d.created_at)} by the {d.uploader_role ?? 'user'}{d.note ? ` · ${d.note}` : ''}</div>
              </div>
              {(role === 'contractor' || d.uploaded_by === user.id) && (
                <form action={deleteDocument}>
                  <input type="hidden" name="project_id" value={project.id} />
                  <input type="hidden" name="id" value={d.id} />
                  <button className="btn ghost" type="submit" style={{ minHeight: 36, padding: '4px 12px' }}>Remove</button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      <details className="conew">
        <summary className="btn accent">Add a document</summary>
        <form action={uploadDocument} className="card stack" style={{ marginTop: 10 }}>
          <input type="hidden" name="project_id" value={project.id} />
          <label className="fld">
            What is it?
            <select name="kind" defaultValue="receipt">
              <option value="permit">Permit</option>
              <option value="insurance">Insurance</option>
              <option value="receipt">Receipt</option>
              <option value="warranty">Warranty or manual</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="fld">Name<input name="title" placeholder="City of Plano permit" /></label>
          <label className="fld">Note (optional)<input name="note" placeholder="Applied Nov 5" /></label>
          <label className="fld">File (PDF or photo, up to 4 MB)<input type="file" name="file" accept="application/pdf,image/jpeg,image/png,image/webp" required /></label>
          <div className="row"><button className="btn" type="submit">Add document</button></div>
        </form>
      </details>
      <p className="muted small conew-hint">Permits, receipts, warranties and manuals. The signed agreement and the contractor's insurance show up here by themselves.</p>
    </>
  );
}
