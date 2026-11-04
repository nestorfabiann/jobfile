import { adminEmails, requireAdmin, ROLE_LABEL, TEAM_ROLES } from '@/lib/admin';
import { addTeamMember, changeTeamRole, removeTeamMember } from './actions';

export const dynamic = 'force-dynamic';

const DESC: Record<string, string> = {
  moderator: 'Reviews, flagged content, help messages and marketplace listings.',
  verifier: 'Insurance and verification requests only.',
  support: 'Help messages, and can look up users and projects. Read only.',
};

// [area, Moderator, Verifier, Support]
const MATRIX: [string, string, string, string][] = [
  ['Reviews and flags', '✓', '–', '–'],
  ['Help messages', '✓', '–', '✓'],
  ['Marketplace listings', '✓', '–', '–'],
  ['Verification and insurance', '–', '✓', '–'],
  ['Users and projects', '–', '–', 'view'],
  ['Broadcast messages', '–', '–', '–'],
  ['Usage and funnels', '–', '–', '–'],
  ['Audit log', 'own', 'own', 'own'],
  ['Admin team', '–', '–', '–'],
];

export default async function Team({ searchParams }: { searchParams: { saved?: string; removed?: string; error?: string } }) {
  const { db } = await requireAdmin(); // Owner only
  let rows: { id: string; email: string; name: string; role: string; added_by: string; created_at: string }[] = [];
  let missing = false;
  const { data, error } = await db.from('admin_team').select('*').order('created_at');
  if (error) missing = true; else rows = (data ?? []) as any[];
  const { data: profs } = rows.length ? await db.from('profiles').select('email,created_at').in('email', rows.map((r) => r.email)) : { data: [] as any[] };
  const signedUp = new Set(((profs ?? []) as any[]).map((p) => String(p.email).toLowerCase()));
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' });

  return (
    <>
      <h1>Admin team</h1>
      <p className="muted">People who can open the Admin area, and what they can do. Every action they take is logged in the audit log.</p>
      {searchParams.saved ? <div className="box ok">Saved.</div> : null}
      {searchParams.removed ? <div className="box ok">Removed. They lose access right away.</div> : null}
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}
      {missing ? <div className="box bad">The team table is not set up yet. Run the 026 SQL step in Supabase first.</div> : null}

      <div className="card" style={{ gap: 0, padding: 0 }}>
        {adminEmails().map((e, i) => (
          <div key={e} className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', padding: '12px 16px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
            <span style={{ minWidth: 0 }}><b style={{ display: 'block' }}>{e}</b><span className="muted small">Set in Vercel (ADMIN_EMAILS)</span></span>
            <span className="pill">Owner</span>
          </div>
        ))}
        {rows.map((r) => (
          <details key={r.id} style={{ borderTop: '1px solid var(--line)' }}>
            <summary className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', padding: '12px 16px', cursor: 'pointer', listStyle: 'none' }}>
              <span style={{ minWidth: 0 }}>
                <b style={{ display: 'block' }}>{r.name || r.email}</b>
                <span className="muted small">{r.email} · added {day(r.created_at)}{signedUp.has(r.email) ? '' : ' · has not signed in yet'}</span>
              </span>
              <span className="pill">{ROLE_LABEL[r.role as keyof typeof ROLE_LABEL] ?? r.role}</span>
            </summary>
            <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <form action={changeTeamRole} className="stack">
                <input type="hidden" name="id" value={r.id} />
                <div className="chips">
                  {TEAM_ROLES.map((t) => (
                    <label className="chip" key={t}><input type="radio" name="role" value={t} defaultChecked={r.role === t} /><span>{ROLE_LABEL[t]}</span></label>
                  ))}
                </div>
                <button className="btn ghost" type="submit">Change role</button>
              </form>
              <form action={removeTeamMember}>
                <input type="hidden" name="id" value={r.id} />
                <button className="btn ghost" type="submit" style={{ color: 'var(--bad)' }}>Remove from team</button>
              </form>
            </div>
          </details>
        ))}
        {!adminEmails().length && !rows.length ? <p className="muted" style={{ padding: 16 }}>Nobody yet.</p> : null}
      </div>

      <details className="card" open={!rows.length}>
        <summary className="btn" style={{ listStyle: 'none', textAlign: 'center' }}>+ Add someone</summary>
        <form action={addTeamMember} className="stack" style={{ marginTop: 12 }}>
          <label className="fld">Email<input name="email" type="email" required maxLength={200} placeholder="jordan@example.com" autoComplete="off" /></label>
          <label className="fld">Name<input name="name" maxLength={120} autoComplete="off" /></label>
          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="small muted">Role</legend>
            {TEAM_ROLES.map((t, i) => (
              <label key={t} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                <input type="radio" name="role" value={t} defaultChecked={i === 0} />
                <span><b>{ROLE_LABEL[t]}</b><span className="muted small" style={{ display: 'block' }}>{DESC[t]}</span></span>
              </label>
            ))}
          </fieldset>
          <button className="btn" type="submit">Add to team</button>
          <p className="muted small" style={{ margin: 0 }}>Jobfile does not email them. Tell them to sign in with this exact address, and to confirm their email. Then Admin appears in their menu.</p>
        </form>
      </details>

      <div className="card">
        <h2 style={{ fontSize: 18 }}>What each role can do</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                {['Area', 'Owner', 'Mod', 'Verifier', 'Support'].map((h, i) => (
                  <th key={h} className="muted small" style={{ textAlign: i ? 'center' : 'left', padding: '8px 4px', borderBottom: '1px solid var(--line)', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map(([label, mod, ver, sup]) => (
                <tr key={label}>
                  <td style={{ padding: '9px 4px', borderBottom: '1px solid var(--line)' }}>{label}</td>
                  {['✓', mod, ver, sup].map((v, i) => (
                    <td key={i} style={{ textAlign: 'center', padding: '9px 4px', borderBottom: '1px solid var(--line)', color: v === '–' ? 'var(--line)' : 'var(--ok)', fontWeight: 700 }}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small" style={{ margin: 0 }}>Pages a role cannot use are hidden from the menu and blocked if the address is typed in. Support sees Users and Projects without edit buttons or private conversations.</p>
      </div>
    </>
  );
}
