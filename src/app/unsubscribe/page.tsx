import Link from 'next/link';
import { unsubscribe } from './actions';
import { unsubValid } from '@/lib/unsub';

export const dynamic = 'force-dynamic';

export default function Unsubscribe({ searchParams }: { searchParams: { u?: string; t?: string; done?: string; bad?: string } }) {
  const ok = !!searchParams.u && !!searchParams.t && unsubValid(searchParams.u, searchParams.t);
  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h1>Tips and local news</h1>
      {searchParams.done ? (
        <div className="box ok">You are unsubscribed. Messages about your own projects will still arrive. You can turn tips back on in <Link href="/settings">Settings</Link>.</div>
      ) : searchParams.bad || !ok ? (
        <div className="box bad">This link is not valid. You can change this in <Link href="/settings">Settings</Link>.</div>
      ) : (
        <form action={unsubscribe} className="card">
          <p>Stop emails about contractors joining your area and projects that could get bids?</p>
          <input type="hidden" name="u" value={searchParams.u} /><input type="hidden" name="t" value={searchParams.t} />
          <button className="btn" type="submit">Unsubscribe</button>
        </form>
      )}
    </div>
  );
}
