import { sendLink, signInWithGoogle } from './actions';
import { safeNext } from '@/lib/nextPath';

const ERRORS: Record<string, string> = {
  email: 'Enter a valid email address.',
  send: 'We could not send the email. Wait a minute and try again.',
  google: 'Google sign-in is not available right now. Use the email link instead.',
  '1': 'That sign-in link did not work. It may have expired or already been used. Request a new one.',
};

export default function Login({ searchParams }: { searchParams: { sent?: string; email?: string; error?: string; next?: string } }) {
  const email = searchParams.email ?? '';
  const next = safeNext(searchParams.next);
  return (
    <>
      <div className="stack">
        <h1>Sign in to Jobfile</h1>
        <p className="muted">Contractors and homeowners use the same email sign-in. No password to remember.</p>
        {next ? <p className="muted small">After you sign in, you go right back to what you were doing.</p> : null}
      </div>

      {searchParams.sent ? (
        <div className="card">
          <h2>Check your email</h2>
          <p>
            We sent a sign-in link to <b>{email}</b>. Open it on any device. The link works once.
          </p>
          <p className="muted small">Nothing arrived? Check spam, or request a new link below.</p>
        </div>
      ) : null}

      {process.env.GOOGLE_LOGIN_ENABLED === 'true' && (
        <form action={signInWithGoogle} className="card">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <button className="btn ghost" type="submit" style={{ gap: 12 }}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
              <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
              <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.4a12 12 0 0 0 0 10.8l4-3.1z" />
              <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
            </svg>
            Continue with Google
          </button>
          <p className="muted small" style={{ margin: 0, textAlign: 'center' }}>or use your email below</p>
        </form>
      )}

      <form action={sendLink} className="card">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {searchParams.error ? <div className="box bad">{ERRORS[searchParams.error] ?? ERRORS.send}</div> : null}
        <label className="fld">
          Email address
          <input name="email" type="email" required autoComplete="email" defaultValue={email} placeholder="you@example.com" />
        </label>
        <div className="row">
          <button className="btn" type="submit">
            {searchParams.sent ? 'Send a new link' : 'Email me a sign-in link'}
          </button>
        </div>
        <p className="muted small">Homeowners: use the email address your contractor invited.</p>
        <p className="muted small"><a href="/help">Need help?</a></p>
      </form>
    </>
  );
}
