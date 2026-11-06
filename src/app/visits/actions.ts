'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyOtherSide, notifyUsers } from '@/lib/notify';
import { adminEmails } from '@/lib/admin';
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

  // Before any bid: a contractor asks to see the job, and the homeowner answers.
  if (scope === 'listing') {
    const { data: l } = await db.from('marketplace_listings').select('id,homeowner_id,status,job_type').eq('id', String(formData.get('listing_id') ?? '')).maybeSingle();
    if (!l) go(safeReturn, 'That project was not found.');
    const role: Role | null = l!.homeowner_id === user.id ? 'homeowner' : null;
    let asContractor = false;
    if (!role) {
      const { data: m } = await db.from('company_members').select('company_id').eq('user_id', user.id).limit(1);
      asContractor = !!(m ?? [])[0];
    }
    if (!role && !asContractor) go(safeReturn, 'You are not part of this project.');
    const r: Role = role ?? 'contractor';
    const path = `/marketplace/${l!.id}`;
    return {
      scope: 'listing' as const, role: r, user, db, back: safeReturn, key: { listing_id: l!.id as string } as Record<string, string>, listingStatus: l!.status as string, bidStatus: 'waiting',
      tell: async (title: string, body: string) => {
        if (r === 'contractor') return notifyUsers({ userIds: [l!.homeowner_id as string], projectId: null, kind: 'visit', path, title, body });
        const { data: v } = await db.from('visits').select('created_by').eq('id', String(formData.get('id') ?? '')).maybeSingle();
        if (v?.created_by) await notifyUsers({ userIds: [v.created_by as string], projectId: null, kind: 'visit', path, title, body });
      },
    };
  }

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
  const col = c.scope === 'project' ? 'project_id' : c.scope === 'listing' ? 'listing_id' : 'bid_id';
  let q = c.db.from('visits').select('*').eq('id', String(formData.get('id') ?? '')).eq(col, c.key[col]);
  if (c.scope === 'listing') q = q.is('bid_id', null);
  const { data } = await q.maybeSingle();
  if (!data) go(c.back, 'That visit was not found.');
  if (c.scope === 'listing' && c.role === 'contractor' && (data as any).created_by !== c.user.id) go(c.back, 'That visit was not found.');
  return { ...(data as any), slots: ((data as any).slots as string[]) ?? [] } as Visit;
}

function requestNote(f: FormData): string {
  const free = f.getAll('avail').map(String).filter(Boolean).slice(0, 5).join(', ');
  const note = txt(f, 'note', 400);
  return [free ? `Free: ${free}.` : '', note].filter(Boolean).join(' ').slice(0, 500);
}

/** A contractor asks to see the job before bidding. The homeowner proposes times. */
export async function askToSeeJob(formData: FormData) {
  const c = await context(formData);
  if (c.scope !== 'listing' || c.role !== 'contractor') go(c.back, 'Only a contractor asks this on a post.');
  if (c.listingStatus !== 'open') go(c.back, 'This project is no longer taking bids.');
  const { data: pl } = await c.db.from('marketplace_listings').select('*').eq('id', c.key.listing_id).maybeSingle();
  const pref = ((pl as any)?.visit_pref as string | undefined) ?? 'yes';
  if (pref === 'no') go(c.back, 'This homeowner is taking bids only, with no visits before hiring.');
  const { count } = await c.db.from('visits').select('id', { count: 'exact', head: true }).eq('listing_id', c.key.listing_id).eq('created_by', c.user.id).is('bid_id', null).in('status', ['requested', 'proposed', 'confirmed']);
  if ((count ?? 0) > 0) go(c.back, 'You already asked to see this job.');
  const since = new Date(Date.now() - 86400000).toISOString();
  const { count: today } = await c.db.from('visits').select('id', { count: 'exact', head: true }).eq('created_by', c.user.id).is('bid_id', null).gte('created_at', since);
  if ((today ?? 0) >= 10) go(c.back, 'You have asked to see 10 jobs today. Try again tomorrow.');
  const { error } = await c.db.from('visits').insert({ ...c.key, title: 'Site visit', note: txt(formData, 'note', 400), status: pref === 'maybe' ? 'asked' : 'requested', requested_role: 'contractor', last_role: 'contractor', created_by: c.user.id });
  if (error) go(c.back, 'Could not save the request.');
  await c.tell('A contractor wants to see your job first', pref === 'maybe' ? 'Open your project to approve or decline. They can still bid either way.' : 'Open your project and suggest times that work for you. They can still bid after.');
  go(c.back);
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
    if (c.scope === 'listing') go(c.back, 'Use Ask to see the job first.');
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
  const first = v.status === 'confirmed';
  const now = new Date().toISOString();
  const { error } = await c.db.from('visits').update(first ? { status: 'done', report, done_at: now, confirm_state: 'pending', updated_at: now } : { report, updated_at: now }).eq('id', v.id);
  if (error) go(c.back, 'Could not save. Check that the database step was run.');
  if (first) await c.tell('Please confirm the visit happened', `Your contractor marked "${v.title}" as visited. Open it and tell us if they came.${report ? ` Their notes: ${report.slice(0, 150)}` : ''}`);
  else await c.tell(`Visit notes: ${v.title}`, report ? report.slice(0, 200) : 'The visit is done.');
  go(c.back);
}


/** The homeowner says whether the contractor really came. Yes closes it. "It did not happen" reopens the visit and flags it for Jobfile. */
export async function confirmVisitHappened(formData: FormData) {
  const c = await context(formData);
  const v = await loadVisit(c, formData);
  if (c.role !== 'homeowner') go(c.back, 'Only the homeowner confirms this.');
  if (v.status !== 'done' || v.confirm_state !== 'pending') go(c.back);
  const now = new Date().toISOString();
  if (String(formData.get('answer') ?? '') === 'yes') {
    await c.db.from('visits').update({ confirm_state: 'yes', updated_at: now }).eq('id', v.id);
    await c.tell('The homeowner confirmed your visit', 'It is marked as done by both sides.');
  } else {
    const why = txt(formData, 'why', 200) || 'No reason given';
    await c.db.from('visits').update({ status: 'confirmed', confirm_state: 'no', dispute_reason: why, updated_at: now }).eq('id', v.id);
    await c.tell('The homeowner says the visit did not happen', `${why}. Open it to reply or set a new time. Jobfile has been told.`);
    try {
      const emails = adminEmails();
      if (emails.length) {
        const { data: admins } = await c.db.from('profiles').select('id').in('email', emails);
        const ids = ((admins ?? []) as any[]).map((a) => a.id as string);
        if (ids.length) await notifyUsers({ userIds: ids, projectId: null, kind: 'admin', path: '/admin/mediation', title: 'A homeowner says a visit did not happen', body: `${why}. Visit: ${v.title}.` });
      }
    } catch { /* the homeowner's answer is already saved */ }
  }
  go(c.back);
}

/** The homeowner answers a visit request on a post set to "ask me first". */
export async function answerVisitAsk(formData: FormData) {
  const c = await context(formData);
  const v = await loadVisit(c, formData);
  if (c.scope !== 'listing' || c.role !== 'homeowner') go(c.back, 'Only the homeowner answers this.');
  if (v.status !== 'asked') go(c.back);
  if (String(formData.get('answer') ?? '') === 'yes') {
    await c.db.from('visits').update({ status: 'requested', updated_at: new Date().toISOString() }).eq('id', v.id);
    await c.tell('Your visit request was approved', 'The homeowner will suggest times. You can still bid any time.');
  } else {
    await c.db.from('visits').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', v.id);
    await c.tell('Not a visit right now', 'The homeowner is not scheduling a visit for this project yet. You can still send a bid.');
  }
  go(c.back);
}

/** The homeowner changes visit preference and free times on their post. */
export async function setVisitPref(formData: FormData) {
  requireMarketplace();
  const { user } = await requireUser();
  const db = supabaseAdmin();
  const back = (() => { const r = String(formData.get('return_path') ?? ''); return r.startsWith('/') && !r.startsWith('//') ? r : '/marketplace'; })();
  const { data: l } = await db.from('marketplace_listings').select('id,homeowner_id').eq('id', String(formData.get('listing_id') ?? '')).maybeSingle();
  if (!l || l.homeowner_id !== user.id) go(back, 'Not allowed.');
  const pref = ['yes', 'maybe', 'no'].includes(String(formData.get('visit_pref'))) ? String(formData.get('visit_pref')) : 'yes';
  const free = formData.getAll('visit_free').map(String).filter((x) => ['Weekday mornings', 'Weekday evenings', 'Saturdays', 'Sundays'].includes(x)).join(', ');
  const { error } = await db.from('marketplace_listings').update({ visit_pref: pref, visit_free: free }).eq('id', l!.id);
  if (error) go(back, 'Could not save. Check that the database step was run.');
  go(back);
}
