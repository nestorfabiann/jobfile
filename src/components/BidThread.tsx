import { sendBidMessage } from '@/app/marketplace/actions';

export type ThreadMsg = { id: string; mine: boolean; body: string; at: string };

const stamp = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Messages on one bid. Writing is allowed only while the project and bid are open. */
export default function BidThread({ listingId, bidId, messages, unread, canSend, otherName, open }: { listingId: string; bidId: string; messages: ThreadMsg[]; unread: number; canSend: boolean; otherName: string; open: boolean }) {
  if (!messages.length && !canSend) return null;
  return (
    <details className="card" open={open || unread > 0} style={{ padding: 12, gap: 8, background: 'var(--surface-2, transparent)' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, minHeight: 32, display: 'flex', alignItems: 'center', gap: 8 }}>
        Messages{messages.length ? ` (${messages.length})` : ''}
        {unread > 0 ? <span className="pill" style={{ background: 'var(--accent)', color: '#fff', borderColor: 'transparent' }}>{unread} new</span> : null}
        {!messages.length ? <span className="muted small" style={{ fontWeight: 400 }}>Ask a question</span> : null}
      </summary>
      <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ alignSelf: m.mine ? 'flex-end' : 'flex-start', maxWidth: '88%', background: m.mine ? 'var(--accent)' : 'var(--surface)', color: m.mine ? '#fff' : 'var(--ink)', border: m.mine ? 0 : '1px solid var(--line)', borderRadius: 16, padding: '8px 12px' }}>
            <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 14 }}>{m.body}</div>
            <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>{m.mine ? 'You' : otherName} · {stamp(m.at)}</div>
          </div>
        ))}
        {canSend ? (
          <form action={sendBidMessage} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input type="hidden" name="listing_id" value={listingId} />
            <input type="hidden" name="bid_id" value={bidId} />
            <textarea name="body" rows={2} maxLength={1000} required placeholder={`Message ${otherName}`} aria-label={`Message ${otherName}`} />
            <p className="muted small" style={{ margin: 0 }}>No phone numbers, emails or links until the bid is accepted.</p>
            <div className="row"><button className="btn" type="submit">Send message</button></div>
          </form>
        ) : <p className="muted small" style={{ margin: 0 }}>Messages are closed.</p>}
      </div>
    </details>
  );
}
