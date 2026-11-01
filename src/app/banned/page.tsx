import { supabaseServer } from '@/lib/supabase/server';
import { signOut } from '../auth/actions';

export default async function Banned() {
  // Deliberately does not call requireUser, which would redirect here forever.
  await supabaseServer().auth.getUser();
  return (
    <div className="card" style={{ maxWidth: 520, margin: '40px auto' }}>
      <h1>This account is suspended</h1>
      <p>
        Access to this account has been turned off. If you think this is a mistake, reply to the last email you received
        from Jobfile or contact the person who invited you.
      </p>
      <form action={signOut}>
        <button className="btn">Sign out</button>
      </form>
    </div>
  );
}
