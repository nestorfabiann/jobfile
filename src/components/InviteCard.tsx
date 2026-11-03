import Link from 'next/link';
import { cookies } from 'next/headers';
import { dismissInvite } from '@/app/invite/actions';
import { INVITE_SKIP_COOKIE } from '@/lib/referrals';

/** A small card shown when people are happiest. "Not now" hides it for 30 days. */
export default function InviteCard({ title, body, cta, back, slim }: { title: string; body: string; cta: string; back: string; slim?: boolean }) {
  if (cookies().get(INVITE_SKIP_COOKIE)?.value) return null;
  if (slim) {
    return (
      <div className="card why" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: 'block', fontSize: 14.5, lineHeight: 1.3 }}>{title}</b>
          <span className="muted small">{body}</span>
        </div>
        <Link className="btn" href="/invite" style={{ minHeight: 40, padding: '0 14px', whiteSpace: 'nowrap' }}>{cta}</Link>
        <form action={dismissInvite}><input type="hidden" name="back" value={back} /><button type="submit" aria-label="Not now" style={{ background: 'none', border: 0, color: 'var(--muted)', fontSize: 22, minWidth: 36, minHeight: 44, cursor: 'pointer' }}>×</button></form>
      </div>
    );
  }
  return (
    <div className="card why">
      <h3 style={{ margin: 0 }}>{title}</h3>
      <p className="muted" style={{ margin: 0 }}>{body}</p>
      <div className="row">
        <Link className="btn" href="/invite">{cta}</Link>
        <form action={dismissInvite}><input type="hidden" name="back" value={back} /><button className="btn ghost" type="submit">Not now</button></form>
      </div>
    </div>
  );
}
