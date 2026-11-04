'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyOtherSide, notifyUsers } from '@/lib/notify';
import { chiToIso, fmtWhen, type Visit } from '@/lib/visits';
import { requireMarketplace } from '@/lib/marketplace';

type Role = 'contractor' | 'homeowner';

/** Tapped days plus one time of day, or the older three typed date-times. At most three, soonest first. */
function slotsFromForm(f: FormData): string[] {
  const days = f.getAll('day').map(String).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 3);
  const time = String(f.get('time_other') ?? '') || String(f.get('time') ?? '');
  const tapped = /^\d{2}:\d{2}$/.test(time) ? days.map((d) => chiToIso(`${d}T${time}`)) : [];
  const typed = [1, 2, 3].map((i) => chiToIso(String(f.get(`slot${i}`) ?? '')));
  return [...tapped, ...typed].filter((x): x is string => !!x).sort().slice(0, 3);
}
const txt = (f: FormData, k: string, n: number) => String(f.get(k) ?? '').trim().slice(0, n);

function go(path: string, msg?: string): never {
  revalidatePath(path);
  redirect(msg ? `${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(msg)}` : path);
}

/** Who is acting, which bid or project the visit belongs to, and how to tell the other side. */
async function context(formData: FormData) {
  const scope = String(formData.get('scope') ?? '');
  const returnPath = String(formData.get('return_path') ?? '/projects');
  const safeReturn = returnPath.startsWith('/') && !returnPath.startsWith('//') ? returnPath : '/projects';
  const db = supabaseAdmin();

  if (scope === 'project') {
    const c = await loadProject(String(formData.get('project_id') ?? ''));
    return {
      scope: 'project' as const, role: c.role as Role, user: c.user, db, back: safeReturn, key: { project_id: c.project.id } as Record<string, string>,
      tell: (title: string, body: string) => notifyOtherSide({ projectId: c.project.id, senderId: c.user.id, senderRole: c.role as Role, kind: 'visit', title: () => title, body }),
    };
  }

  requireMarketplace();
  const { user } = await requireUser();
  const { data: bid } = await db.from('marketplace_bids').select('id,listing_id,company_id,status').eq('id', String(formData.get('bid_id') ?? '')).maybeSingle();
  if (!bid) go(safeReturn, 'That bid was not found.');
  const { data: l } = await db.from('marketplace_listings').select('id,homeowner_id,status,job_type').eq('id', bid!.listing_id as string).maybeSingle();
  if (!l) go(safeReturn, 'That project was not found.');
  const { data: staff } = await db.from('company_members').select('user_id').eq('company_id', bid!.company_id as string);
  const staffIds = (staff ?? []).map((s: any) => s.user_id as string);
  const role: Role | null = l!.homeowner_id === user.id ? 'homeowner' : staffIds.includes(user.id) ? 'contractor' : null;
  if (!role) go(safeReturn, 'You are not part of this bid.');
  const path = `/marketplace/${l!.id}`;
  return {
    scope: 'bid' as const, role: role as Role, user, db, back: safeReturn, key: { listing_id: l!.id as string, bid_id: bid!.id as string } as Record<string, string>, listingStatus: l!.status as string, bidStatus: bid!.status as string,
    tell: (title: string, body: string) => notifyUsers({ userIds: role === 'homeowner' ? staffIds : [l!.homeowner_id as string], projectId: null, kind: 'visit', path: `${path}?open=${bid!.id}#bid-${bid!.id}`, title, body }),
  };
}
type Ctx = Awaited<ReturnType<typeof context>>;

async function loadVisit(c: Ctx, formData: FormData): Promise<Visit> {
  const col = c.scope === 'project' ? 'project_id' : 'bid_id';
  const { data } = await c.db.from('visits').select('*').eq('id', String(formData.get('id') ?? '')).eq(col, c.key[col]).maybeSingle();
  if (!data) go(c.back, 'That visit was not found.');
  return { ...(data as any), slots: ((data as any).slots as string[]) ?? [] } as Visit;
}

function requestNote(f: FormData): string {
  const free = f.getAll('avail').map(String).filter(Boolean).slice(0, 5).join(', ');
  const note = txt(f, 'note', 400);
  return [free ? `Free: ${free}.` : '', note].filter(Boolean).join(' ').slice(0, 500);
}

/** A homeowner asks a bidder to come and see the job. */
export async function requestVisit(formData: FormData) {
  const c = await context(formData);
  if (c.scope !== 'bid') go(c.back, 'Use Add a visit on the project.');
  if (c.role !== 'homeowner') go(c.back, 'Only the homeowner can request a visit on a bid.');
  if (c.scope === 'bid' && (c.listingStatus !== 'open' || c.bidStatus !== 'waiting')) go(c.back, 'This bid is no longer open.');
  const { count } = await c.db.from('visits').select('id', { count: 'exact', head: true }).eq('bid_id', c.key.bid_id).in('status', ['requested', 'proposed', 'confirmed']);
  if ((count ?? 0) > 0) go(c.back, 'There is already a visit for this bid.');
  const { error } = await c.db.from('visits').insert({ ...c.key, title: 'Site visit', note: requestNote(formData), status: 'requested', requested_role: 'homeowner', last_role: 'homeowner', created_by: c.user.id });
  if (error) go(c.back, 'Could not save the request. Check that the database step was run.');
  await c.tell('A homeowner wants to see the job', 'Open the bid and propose two or three times for a visit.');
  go(c.back);
}

/** The contractor proposes times, or either side adds a visit on a project. Proposing again replaces earlier times. */
export async function proposeVisit(formData: FormData) {
  const c = await context(formData);
  const slots = slotsFromForm(formData);
  if (slots.length === 0) go(c.back, 'Pick at least one date and time.');
  if (slots.some((s) => new Date(s).getTime() < Date.now())) go(c.back, 'Those times are in the past.');
  const note = txt(formData, 'note', 500);
  const duration = txt(formData, 'duration', 60);
  const id = String(formData.get('id') ?? '');
  let title = txt(formData, 'title', 120) || 'Site visit';

  if (id) {
    const v = await loadVisit(c, formData);
    const mayEdit = (v.status === 'requested' && v.requested_role !== c.role) || (v.status === 'proposed' && v.last_role === c.role);
    if (!mayEdit) go(c.back, 'It is not your turn to propose times.');
    title = v.title;
    await c.db.from('visits').update({ status: 'proposed', slots, note, duration_text: duration, last_role: c.role, updated_at: new Date().toISOString() }).eq('id', v.id);
  } else {
    if (c.scope === 'bid' && c.role !== 'contractor') go(c.back, 'Request a visit and the contractor will propose times.');
    if (c.scope === 'bid') {
      const { count } = await c.db.from('visits').select('id', { count: 'exact', head: true }).eq('bid_id', c.key.bid_id).in('status', ['requested', 'proposed', 'confirmed']);
      if ((count ?? 0) > 0) go(c.back, 'There is already a visit for this bid.');
    }
    const { error } = await c.db.from('visits').insert({ ...c.key, title, note, duration_text: duration, status: 'proposed', slots, requested_role: c.role, last_role: c.role, created_by: c.user.id });
    if (error) go(c.back, 'Could not save the visit. Check that the database step was run.');
  }
  await c.tell(`Times proposed for a visit: ${title}`, `${slots.map(fmtWhen).join(', or ')}. Open it to pick one.${note ? ` Note: ${note}` : ''}`);
  go(c.back);
}

export async function pickVisitTime(formData: FormData) {
  const c = await context(formData);
  const v = await loadVisit(c, formData);
  if (v.status !== 'proposed' || v.last_role === c.role) go(c.back, 'There is nothing for you to pick.');
  const slot = v.slots[parseInt(String(formData.get('slot') ?? ''), 10)];
  if (!slot) go(c.back, 'Choose one of the times.');
  await c.db.from('visits').update({ status: 'confirmed', scheduled_for: slot, updated_at: new Date().toISOString() }).eq('id', v.id);
  await c.tell(`Visit confirmed: ${v.title}`, `${fmtWhen(slot)}. It is on your schedule, and you will get a reminder the day before.`);
  go(c.back);
}

/** None of the proposed times work. The other side proposes new ones. */
export async function declineTimes(formData: FormData) {
  const c = await context(formData);
  const v = await loadVisit(c, formData);
  if (v.status !== 'proposed' || v.last_role === c.role) go(c.back, 'There is nothing to answer.');
  const free = formData.getAll('avail').map(String).filter(Boolean).slice(0, 4).join(', ');
  const why = [free ? `Free: ${free}.` : '', txt(formData, 'why', 250)].filter(Boolean).join(' ');
  await c.db.from('visits').update({ status: 'requested', requested_role: c.role, last_role: c.role, slots: [], note: why, updated_at: new Date().toISOString() }).eq('id', v.id);
  await c.tell(`Those times do not work: ${v.title}`, why || 'Please propose other times.');
  go(c.back);
}

export async function cancelVisit(formData: FormData) {
  const c = await context(formData);
  const v = await loadVisit(c, formData);
  if (v.status === 'canceled') go(c.back);
  await c.db.from('visits').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', v.id);
  await c.tell(`Visit canceled: ${v.title}`, v.scheduled_for ? `It was set for ${fmtWhen(v.scheduled_for)}. You can set up a new time.` : 'You can set up a new time.');
  go(c.back);
}

/** Only the homeowner adds notes about getting in, and only the other side sees them, after the visit is confirmed. */
export async function saveAccess(formData: FormData) {
  const c = await context(formData);
  const v = await loadVisit(c, formData);
  if (c.role !== 'homeowner') go(c.back, 'Only the homeowner adds access notes.');
  if (v.status !== 'confirmed') go(c.back, 'Access notes are added once a visit is confirmed.');
  const access = { gate: txt(formData, 'gate', 120), pets: txt(formData, 'pets', 120), parking: txt(formData, 'parking', 120), other: txt(formData, 'other', 200) };
  await c.db.from('visits').update({ access, updated_at: new Date().toISOString() }).eq('id', v.id);
  go(c.back);
}



/** Day of the visit: the contractor says they are on the way, running late, or here. */
export async function setVisitLive(formData: FormData) {
  const c = await context(formData);
  const v = await loadVisit(c, formData);
  if (c.role !== 'contractor') go(c.back, 'Only the contractor sends this.');
  if (v.status !== 'confirmed' || !v.scheduled_for) go(c.back, 'This visit is not confirmed.');
  const hours = (new Date(v.scheduled_for!).getTime() - Date.now()) / 3600000;
  if (hours > 12 || hours < -12) go(c.back, 'This can only be sent on the day of the visit.');
  const state = String(formData.get('state') ?? '');
  const say: Record<string, [string, string]> = {
    on_way: ['is on the way', 'They expect to arrive around the planned time.'],
    late15: ['is running about 15 minutes late', 'Thanks for your patience.'],
    late30: ['is running about 30 minutes late', 'Thanks for your patience.'],
    arrived: ['has arrived', 'They are at your door.'],
  };
  if (!say[state]) go(c.back);
  await c.db.from('visits').update({ live: { state, at: new Date().toISOString() }, updated_at: new Date().toISOString() }).eq('id', v.id);
  await c.tell(`Your contractor ${say[state][0]}`, say[state][1]);
  go(c.back);
}

/** Notes after the visit. Marks the visit done and tells the other side. */
export async function saveVisitReport(formData: FormData) {
  const c = await context(formData);
  const v = await loadVisit(c, formData);
  if (c.role !== 'contractor') go(c.back, 'Only the contractor adds visit notes.');
  if (v.status !== 'confirmed' && v.status !== 'done') go(c.back, 'This visit is not confirmed.');
  const report = txt(formData, 'report', 1500);
  await c.db.from('visits').update({ status: 'done', report, updated_at: new Date().toISOString() }).eq('id', v.id);
  await c.tell(`Visit notes: ${v.title}`, report ? report.slice(0, 200) : 'The visit is done.');
  go(c.back);
}
