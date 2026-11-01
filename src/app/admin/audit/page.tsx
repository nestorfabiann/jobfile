import { requireAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export default async function Audit() {
  const { db } = await requireAdmin();
  const { data } = await db.from('admin_audit').select('*').order('created_at', { ascending: false }).limit(200);
  return (
    <>
      <h1>Audit log</h1>
      <p className="muted small">Every admin action, including each time a conversation was opened.</p>
      <div className="card" style={{ gap: 0, padding: 0 }}>
        {(data ?? []).length === 0 && <p className="muted" style={{ padding: 16 }}>No admin actions yet.</p>}
        {(data ?? []).map((a, i) => (
          <div key={a.id} style={{ padding: '10px 16px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
            <div>
              <span className="pill" style={{ marginRight: 8 }}>{a.action}</span>
              {a.admin_email} → {a.target_type || '—'} {a.target_id && <code>{String(a.target_id).slice(0, 8)}</code>}
            </div>
            <div className="small muted">
              {new Date(a.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago' })}
              {Object.keys(a.detail ?? {}).length > 0 && ` · ${JSON.stringify(a.detail)}`}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
