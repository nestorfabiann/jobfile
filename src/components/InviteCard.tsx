import Link from 'next/link';
import { cookies } from 'next/headers';
import { dismissInvite } from '@/app/invite/actions';
import { INVITE_SKIP_COOKIE } from '@/lib/invites';

/** A small card shown when people are happiest. "Not now" hides it for 30 days. */
export default function InviteCard({ title, body, cta, back }: { title: string; body: string; cta: string; back: string }) {
  if (cookies().get(INVITE_SKIP_COOKIE)?.value) return null;
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
