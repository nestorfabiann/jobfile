import { sendLink } from './actions';

const ERRORS: Record<string, string> = {
  email: 'Enter a valid email address.',
  send: 'We could not send the email. Wait a minute and try again.',
  '1': 'That sign-in link did not work. It may have expired or already been used. Request a new one.',
};

export default function Login({ searchParams }: { searchParams: { sent?: string; email?: string; error?: string } }) {
  const email = searchParams.email ?? '';
  return (
    <>
      <div className="stack">
        <h1>Sign in to Jobfile</h1>
        <p className="muted">Contractors and homeowners use the same email sign-in. No password to remember.</p>
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

      <form action={sendLink} className="card">
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
      </form>
    </>
  );
}
