import { requireAdmin } from '@/lib/admin';
import PushKeyMaker from '@/components/PushKeyMaker';

export const dynamic = 'force-dynamic';

export default async function AdminPush() {
  const { db } = await requireAdmin();
  const pub = !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = !!process.env.VAPID_PRIVATE_KEY;
  let phones = 0;
  try {
    const { count } = await db.from('push_subscriptions').select('id', { count: 'exact', head: true });
    phones = count ?? 0;
  } catch { /* table not created yet */ }
  return (
    <>
      <h1>Phone alerts setup</h1>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}><span>Public key in Vercel</span><span className={`pill ${pub ? 'ok' : 'warn'}`}>{pub ? 'Set' : 'Missing'}</span></div>
        <div className="row" style={{ justifyContent: 'space-between' }}><span>Private key in Vercel</span><span className={`pill ${priv ? 'ok' : 'warn'}`}>{priv ? 'Set' : 'Missing'}</span></div>
        <div className="row" style={{ justifyContent: 'space-between' }}><span>Phones signed up</span><b>{phones}</b></div>
      </div>
      {!(pub && priv) && (
        <>
          <p className="muted">Make your keys here, add them in Vercel under Settings, Environment Variables, then redeploy. Use the exact names shown. Until both are set, the phone alert cards stay hidden.</p>
          <PushKeyMaker />
        </>
      )}
    </>
  );
}
