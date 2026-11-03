'use client';

import Link from 'next/link';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card" role="alert" style={{ marginTop: 16 }}>
      <h2>Something went wrong</h2>
      <p className="muted">We could not load this page. Your information is safe. Check your connection and try again.</p>
      <button type="button" className="btn" onClick={() => reset()}>Try again</button>
      <Link href="/projects" className="btn ghost">Go to Projects</Link>
    </div>
  );
}
