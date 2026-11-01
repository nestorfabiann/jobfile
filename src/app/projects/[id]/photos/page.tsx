import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import PhotoUploader from '@/components/PhotoUploader';
import { deletePhoto, setFixStatus } from './actions';

const TZ = 'America/Chicago';
const stamp = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

type Photo = {
  id: string;
  uploaded_by: string;
  uploader_role: 'contractor' | 'homeowner';
  kind: 'progress' | 'fix';
  caption: string;
  path: string;
  status: 'open' | 'fixed' | 'confirmed';
  created_at: string;
};

const FIX_LABEL: Record<string, [string, string]> = {
  open: ['Open', 'warn'],
  fixed: ['Marked fixed', ''],
  confirmed: ['Confirmed', 'ok'],
};

export default async function Photos({ params }: { params: { id: string } }) {
  const { sb, user, project, role, contractorName, homeownerName } = await loadProject(params.id);

  const { data } = await sb
    .from('photos')
    .select('id,uploaded_by,uploader_role,kind,caption,path,status,created_at')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .limit(300);
  const photos = (data ?? []) as Photo[];

  // Files are private. Short-lived links are made on the server for people who already passed the access check.
  const urls = new Map<string, string>();
  if (photos.length) {
    const { data: signed } = await supabaseAdmin()
      .storage.from('project-photos')
      .createSignedUrls(photos.map((p) => p.path), 3600);
    (signed ?? []).forEach((s) => {
      if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
    });
  }

  const nameOf = (r: string) => (r === 'contractor' ? contractorName : homeownerName);
  const fixes = photos.filter((p) => p.kind === 'fix');
  const openFixes = fixes.filter((p) => p.status !== 'confirmed');
  const doneFixes = fixes.filter((p) => p.status === 'confirmed');
  const progress = photos.filter((p) => p.kind === 'progress');

  const Img = ({ p }: { p: Photo }) => {
    const u = urls.get(p.path);
    return u ? (
      <a href={u} target="_blank" rel="noreferrer" className="ph">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={u} alt={p.caption || 'Project photo'} loading="lazy" />
      </a>
    ) : (
      <div className="ph muted small">Photo unavailable</div>
    );
  };

  const Meta = ({ p }: { p: Photo }) => (
    <>
      {p.caption ? <p>{p.caption}</p> : null}
      <span className="muted small">{p.uploaded_by === user.id ? 'You' : nameOf(p.uploader_role)} · {stamp(p.created_at)}</span>
    </>
  );

  const Del = ({ p }: { p: Photo }) =>
    p.uploaded_by === user.id ? (
      <form action={deletePhoto}>
        <input type="hidden" name="project_id" value={project.id} />
        <input type="hidden" name="id" value={p.id} />
        <button className="linkbtn muted small" style={{ color: 'var(--ink-2)' }}>Delete</button>
      </form>
    ) : null;

  return (
    <>
      <PhotoUploader projectId={project.id} />

      <section className="stack" aria-label="Details to fix">
        <h2>Details to fix {openFixes.length ? <span className="pill warn">{openFixes.length} open</span> : null}</h2>
        {fixes.length === 0 && <div className="card"><p className="muted">Nothing flagged. Photograph anything that needs fixing and mark it &ldquo;Needs fixing&rdquo;.</p></div>}
        {[...openFixes, ...doneFixes].map((p) => {
          const [label, tone] = FIX_LABEL[p.status];
          return (
            <article className="card" key={p.id}>
              <Img p={p} />
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className={`pill ${tone}`}>{label}</span>
                <Del p={p} />
              </div>
              <Meta p={p} />
              <form action={setFixStatus} className="row">
                <input type="hidden" name="project_id" value={project.id} />
                <input type="hidden" name="id" value={p.id} />
                {role === 'contractor' && p.status === 'open' && <button className="btn" name="to" value="fixed">Mark fixed</button>}
                {role === 'homeowner' && p.status === 'fixed' && (
                  <>
                    <button className="btn" name="to" value="confirmed">Confirm it&rsquo;s fixed</button>
                    <button className="btn ghost" name="to" value="open">Send back</button>
                  </>
                )}
                {role === 'homeowner' && p.status === 'confirmed' && <button className="btn ghost" name="to" value="open">Reopen</button>}
              </form>
            </article>
          );
        })}
      </section>

      <section className="stack" aria-label="Progress photos">
        <h2>Progress</h2>
        {progress.length === 0 && <div className="card"><p className="muted">No progress photos yet.</p></div>}
        <div className="photogrid">
          {progress.map((p) => (
            <article className="card photo" key={p.id}>
              <Img p={p} />
              <Meta p={p} />
              <Del p={p} />
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
