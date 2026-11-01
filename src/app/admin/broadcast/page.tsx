import { requireAdmin } from '@/lib/admin';
import { MessageForm } from '@/components/AdminForms';
import { sendBroadcast } from '../actions';

export const dynamic = 'force-dynamic';

export default async function Broadcast() {
  const { db } = await requireAdmin();
  const [{ data: ps }, { data: us }] = await Promise.all([
    db.from('projects').select('id,name').order('created_at', { ascending: false }).limit(200),
    db.from('profiles').select('id,email').order('created_at', { ascending: false }).limit(200),
  ]);
  return (
    <>
      <h1>Broadcast</h1>
      <p className="muted small">
        Sends an in-app alert plus an email. Suspended accounts are skipped, texts are never sent, and each send is limited to 200 people and recorded in the audit log.
      </p>
      <div className="card">
        <MessageForm
          action={sendBroadcast}
          showAudience
          projects={(ps ?? []).map((p) => ({ id: p.id, label: p.name }))}
          users={(us ?? []).map((u) => ({ id: u.id, label: u.email }))}
        />
      </div>
    </>
  );
}
