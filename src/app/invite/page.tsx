import { headers } from 'next/headers';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getOrCreateCode, inviteStats } from '@/lib/referrals';
import InviteShare from '@/components/InviteShare';

export const dynamic = 'force-dynamic';

const MSG = {
  h: 'Hey, I use Jobfile to get free bids from local contractors and keep everything about my project in one place. It is free to use. Take a look:',
  c: 'Hey, Jobfile is free for contractors: no subscription, no fees at all. You can bid on local jobs and run projects without the paperwork. Take a look:',
};

export default async function Invite() {
  const { user } = await requireUser();
  const db = supabaseAdmin();
  const { data: mem } = await db.from('company_members').select('company_id').eq('user_id', user.id).limit(1);
  const contractor = (mem ?? []).length > 0;
  const code = await getOrCreateCode(user.id);
  const h = headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  const origin = process.env.APP_URL?.replace(/\/$/, '') || (host ? `https://${host}` : '');
  const stats = code ? await inviteStats(code) : { opened: 0, joined: 0, posted: 0 };

  return (
    <>
      <div className="stack">
        <h1>Invite friends</h1>
        <p className="muted">Know someone who needs a contractor, or a contractor who needs work? Send them Jobfile. It is free for everyone.</p>
      </div>
      {code ? (
        <InviteShare link={`${origin}/r/${code}`} messages={MSG} initial={contractor ? 'c' : 'h'} />
      ) : (
        <div className="box bad">We could not make your invite link. Try again in a minute.</div>
      )}
      <div className="card">
        <b>Your invites</b>
        <div className="tiles">
          <div className="tile"><span className="small muted">Opened</span><b>{stats.opened}</b></div>
          <div className="tile"><span className="small muted">Joined</span><b>{stats.joined}</b></div>
          <div className="tile"><span className="small muted">Posted a job</span><b>{stats.posted}</b></div>
        </div>
        <p className="muted small" style={{ margin: 0 }}>Counts only. We never show who they are.</p>
      </div>
    </>
  );
}
