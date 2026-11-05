import { sendPartnerMessage } from '@/app/partner/actions';

export type PMsg = { id: string; sender_side: 'lead' | 'partner'; body: string; created_at: string };

/** Messages between a lead and one partner. Never shown to the homeowner. */
export default function PartnerThread({ id, msgs, me, other }: { id: string; msgs: PMsg[]; me: 'lead' | 'partner'; other: string }) {
  return (
    <section id="messages" className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-label="Messages">
      <h2>Messages with {other}</h2>
      {msgs.length === 0 ? <p className="muted small">No messages yet.</p> : null}
      {msgs.map((m) => (
        <div key={m.id} style={{ alignSelf: m.sender_side === me ? 'flex-end' : 'flex-start', maxWidth: '88%', background: m.sender_side === me ? 'var(--green-soft, #e4f0e8)' : 'var(--card-alt, #f3f1ec)', borderRadius: 12, padding: '8px 10px' }}>
          <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.body}</div>
          <div className="muted small">{new Date(m.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
        </div>
      ))}
      <form action={sendPartnerMessage} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input type="hidden" name="id" value={id} />
        <label htmlFor={`pm-${id}`} className="muted small">Write a message</label>
        <textarea id={`pm-${id}`} name="body" rows={3} maxLength={2000} required />
        <button className="btn ghost" type="submit">Send</button>
      </form>
    </section>
  );
}
