import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { ACTIVITY_LABEL, type Ann } from '@/lib/announce';
import { deleteAnnouncement, setAnnouncementStatus } from './actions';

export const dynamic = 'force-dynamic';

const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' });

export default async function Announcements({ searchParams }: { searchParams: { ok?: string } }) {
  const { db } = await requireAdmin();
  let rows: Ann[] = [];
  let missing = false;
  const tally = new Map<string, { seen: number; tap: number; dismiss: number }>();
  try {
    const { data, error } = await db.from('announcements').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    rows = (data ?? []) as Ann[];
    const { data: ev } = rows.length ? await db.from('announcement_events').select('announcement_id,kind').in('announcement_id', rows.map((r) => r.id)).limit(50000) : { data: [] as any[] };
    ((ev ?? []) as any[]).forEach((e) => {
      const t = tally.get(e.announcement_id) ?? { seen: 0, tap: 0, dismiss: 0 };
      if (e.kind in t) (t as any)[e.kind] += 1;
      tally.set(e.announcement_id, t);
    });
  } catch { missing = true; }
  return (
    <>
      <h1>Announcements</h1>
      <p className="muted small">Messages shown inside the app to a group you choose. Each person sees one at a time, can close it, and a new one waits a week after the last. Counts only, never names.</p>
      {searchParams.ok ? <div className="box ok" role="status">{searchParams.ok}</div> : null}
      {missing ? <div className="box warn">Announcements needs one database step (054_announcements.sql in the Supabase SQL editor).</div> : null}
      <div className="row"><Link className="btn" href="/admin/announcements/new">+ New announcement</Link></div>
      {rows.length === 0 && !missing ? <div className="card"><p className="muted" style={{ margin: 0 }}>No announcements yet.</p></div> : null}
      {rows.map((a) => {
        const t = tally.get(a.id) ?? { seen: 0, tap: 0, dismiss: 0 };
        const live = a.status === 'live' && (!a.ends_at || new Date(a.ends_at).getTime() > Date.now());
        const label = a.status === 'live' && !live ? 'Ended' : a.status === 'live' ? 'Live' : a.status === 'draft' ? 'Draft' : 'Ended';
        return (
          <div className="card" key={a.id} style={{ gap: 6 }}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <b>{a.title}</b>
              <span className={`pill ${label === 'Live' ? 'ok' : ''}`}>{label}</span>
            </div>
            <span className="muted small">
              {a.role === 'homeowners' ? 'Homeowners' : a.role === 'contractors' ? 'Contractors' : 'Everyone'} · {a.zips.length ? `${a.zips.length} ZIP${a.zips.length === 1 ? '' : 's'}` : 'all ZIPs'} · {ACTIVITY_LABEL[a.activity]} · {a.style === 'banner' ? 'Hero banner' : a.style === 'sheet' ? 'Slide-up sheet' : 'Your design'} · made {when(a.created_at)}{a.ends_at ? ` · ends ${when(a.ends_at)}` : ''}
            </span>
            <span className="small">Seen by {t.seen} · Tapped by {t.tap} · Closed by {t.dismiss}</span>
            <div className="row">
              {a.status !== 'live' ? <form action={setAnnouncementStatus}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="live" /><button className="btn" type="submit">{a.status === 'ended' ? 'Show again' : 'Publish'}</button></form> : null}
              {a.status === 'live' ? <form action={setAnnouncementStatus}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="ended" /><button className="btn ghost" type="submit">End it</button></form> : null}
              <form action={deleteAnnouncement}><input type="hidden" name="id" value={a.id} /><button className="btn ghost" type="submit">Delete</button></form>
            </div>
          </div>
        );
      })}
    </>
  );
}
