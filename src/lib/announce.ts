import { supabaseAdmin } from '@/lib/supabase/server';
import { signedUrls } from '@/lib/companyProfile';

export const ANN_BUCKET = 'announcements';
export const WEEK_MS = 7 * 86400000;

export * from '@/lib/announceShared';
import { matches, type Ann, type Person } from '@/lib/announceShared';

type Db = ReturnType<typeof supabaseAdmin>;

/** Everyone the tool can reach: contractors by business ZIP, homeowners by profile ZIP or the ZIP of a project they posted. Suspended accounts are left out. */
export async function loadPeople(db: Db): Promise<Person[]> {
  const out: Person[] = [];
  const { data: cos } = await db.from('companies').select('id,business_zip').limit(5000);
  const zipOf = new Map(((cos ?? []) as any[]).map((c) => [c.id as string, (c.business_zip as string | null) ?? null]));
  const { data: mem } = await db.from('company_members').select('company_id,user_id').limit(10000);
  const staff = new Set<string>();
  ((mem ?? []) as any[]).forEach((m) => { staff.add(m.user_id); });
  const { data: all } = await db.from('profiles').select('*').limit(10000);
  const banned = new Set(((all ?? []) as any[]).filter((p) => p.banned_at).map((p) => p.id as string));
  const seen = new Set<string>();
  ((mem ?? []) as any[]).forEach((m) => {
    if (banned.has(m.user_id) || seen.has(m.user_id)) return;
    seen.add(m.user_id);
    out.push({ id: m.user_id, role: 'contractor', zip: zipOf.get(m.company_id) ?? null, posted: false, nobids: false });
  });
  const { data: ls } = await db.from('marketplace_listings').select('id,homeowner_id,zip,status,expires_at,created_at').order('created_at', { ascending: false }).limit(10000);
  const lrows = (ls ?? []) as any[];
  const open = lrows.filter((l) => l.status === 'open' && new Date(l.expires_at).getTime() > Date.now());
  const { data: bids } = open.length ? await db.from('marketplace_bids').select('listing_id').in('listing_id', open.map((l) => l.id)) : { data: [] as any[] };
  const bidded = new Set(((bids ?? []) as any[]).map((b) => b.listing_id as string));
  const posted = new Set<string>(), nobids = new Set<string>(), lzip = new Map<string, string>();
  lrows.forEach((l) => { posted.add(l.homeowner_id); if (!lzip.has(l.homeowner_id)) lzip.set(l.homeowner_id, l.zip); });
  open.forEach((l) => { if (!bidded.has(l.id)) nobids.add(l.homeowner_id); });
  ((all ?? []) as any[]).forEach((p) => {
    if (staff.has(p.id) || p.banned_at) return;
    out.push({ id: p.id, role: 'homeowner', zip: (p.zip as string | null) ?? lzip.get(p.id) ?? null, posted: posted.has(p.id), nobids: nobids.has(p.id) });
  });
  return out;
}

/** The same facts for one signed-in person. */
export async function personFor(db: Db, userId: string): Promise<Person> {
  const { data: m } = await db.from('company_members').select('company_id').eq('user_id', userId).limit(1);
  const cid = ((m ?? []) as any[])[0]?.company_id as string | undefined;
  if (cid) {
    const { data: co } = await db.from('companies').select('business_zip').eq('id', cid).maybeSingle<any>();
    return { id: userId, role: 'contractor', zip: co?.business_zip ?? null, posted: false, nobids: false };
  }
  const { data: pr } = await db.from('profiles').select('*').eq('id', userId).maybeSingle<any>();
  const { data: ls } = await db.from('marketplace_listings').select('id,zip,status,expires_at').eq('homeowner_id', userId).order('created_at', { ascending: false }).limit(50);
  const lrows = (ls ?? []) as any[];
  const open = lrows.filter((l) => l.status === 'open' && new Date(l.expires_at).getTime() > Date.now());
  let nobids = false;
  if (open.length) {
    const { data: bids } = await db.from('marketplace_bids').select('listing_id').in('listing_id', open.map((l) => l.id));
    const bidded = new Set(((bids ?? []) as any[]).map((b) => b.listing_id as string));
    nobids = open.some((l) => !bidded.has(l.id));
  }
  return { id: userId, role: 'homeowner', zip: (pr?.zip as string | null) ?? lrows[0]?.zip ?? null, posted: lrows.length > 0, nobids };
}

export type Shown = { ann: Ann; imageUrl: string | null };

/**
 * The one announcement to show this person now, or null. It must be live and not past its end date, match the person,
 * and not be dismissed. One already seen keeps showing until dismissed. A new one waits until nothing was first shown in the last 7 days.
 */
export async function announcementFor(userId: string): Promise<Shown | null> {
  try {
    const db = supabaseAdmin();
    const { data: rows } = await db.from('announcements').select('*').eq('status', 'live').order('created_at', { ascending: false }).limit(20);
    const live = ((rows ?? []) as Ann[]).filter((a) => !a.ends_at || new Date(a.ends_at).getTime() > Date.now());
    if (!live.length) return null;
    const { data: ev } = await db.from('announcement_events').select('announcement_id,kind,created_at').eq('user_id', userId).in('announcement_id', live.map((a) => a.id));
    const events = (ev ?? []) as { announcement_id: string; kind: string; created_at: string }[];
    const dismissed = new Set(events.filter((e) => e.kind === 'dismiss').map((e) => e.announcement_id));
    const seenAt = new Map(events.filter((e) => e.kind === 'seen').map((e) => [e.announcement_id, new Date(e.created_at).getTime()]));
    // Look at everything this person ever saw, not only the live ones, for the weekly limit.
    const { data: allSeen } = await db.from('announcement_events').select('created_at').eq('user_id', userId).eq('kind', 'seen').gte('created_at', new Date(Date.now() - WEEK_MS).toISOString()).limit(1);
    const recentOther = ((allSeen ?? []) as any[]).length > 0;
    const person = await personFor(db, userId);
    const ok = live.filter((a) => !dismissed.has(a.id) && matches(person, a));
    const stillShowing = ok.find((a) => seenAt.has(a.id));
    const pick = stillShowing ?? (recentOther ? undefined : ok[0]);
    if (!pick) return null;
    const imageUrl = pick.image_path ? (await signedUrls(ANN_BUCKET, [pick.image_path], 3600)).get(pick.image_path) ?? null : null;
    return { ann: pick, imageUrl };
  } catch {
    return null; // announcements tables not created yet
  }
}
