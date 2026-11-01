import { supabaseAdmin } from './supabase/server';

export type FeedEvent = {
  at: string;
  kind: string;
  text: string;
  projectId?: string;
  userId?: string;
};

export const KINDS = ['signup', 'project', 'message', 'agreement', 'change', 'payment', 'photo', 'pricecheck'] as const;

type Scope = { projectId?: string; userId?: string; kinds?: string[]; limit?: number };

/**
 * Merged activity across the app. Metadata only: message text and price-check results are never included.
 * Each source is capped, then the combined list is sorted and trimmed.
 */
export async function loadFeed(scope: Scope = {}): Promise<FeedEvent[]> {
  const db = supabaseAdmin();
  const per = 60;
  const want = (k: string) => !scope.kinds?.length || scope.kinds.includes(k);
  const pid = scope.projectId;
  const uid = scope.userId;
  const out: FeedEvent[] = [];

  const who = (role?: string) => (role ? `the ${role}` : 'someone');

  const jobs: PromiseLike<void>[] = [];
  const add = (p: PromiseLike<void>) => jobs.push(p);

  if (want('signup') && !pid)
    add(
      (async () => {
        let q = db.from('profiles').select('id,email,created_at').order('created_at', { ascending: false }).limit(per);
        if (uid) q = q.eq('id', uid);
        const { data } = await q;
        (data ?? []).forEach((r) => out.push({ at: r.created_at, kind: 'signup', text: `${r.email} signed up`, userId: r.id }));
      })(),
    );

  if (want('project'))
    add(
      (async () => {
        let q = db.from('projects').select('id,name,created_by,created_at').order('created_at', { ascending: false }).limit(per);
        if (pid) q = q.eq('id', pid);
        if (uid) q = q.eq('created_by', uid);
        const { data } = await q;
        (data ?? []).forEach((r) =>
          out.push({ at: r.created_at, kind: 'project', text: `Project created: ${r.name}`, projectId: r.id, userId: r.created_by }),
        );
      })(),
    );

  if (want('message'))
    add(
      (async () => {
        let q = db.from('messages').select('project_id,sender_id,sender_role,tag,created_at').order('created_at', { ascending: false }).limit(per);
        if (pid) q = q.eq('project_id', pid);
        if (uid) q = q.eq('sender_id', uid);
        const { data } = await q;
        (data ?? []).forEach((r) =>
          out.push({
            at: r.created_at,
            kind: 'message',
            text: `Message from ${who(r.sender_role)}${r.tag ? ` (${r.tag})` : ''}`,
            projectId: r.project_id,
            userId: r.sender_id,
          }),
        );
      })(),
    );

  if (want('agreement') && !uid)
    add(
      (async () => {
        let q = db.from('agreements').select('project_id,sent_at,executed_at').order('updated_at', { ascending: false }).limit(per);
        if (pid) q = q.eq('project_id', pid);
        const { data } = await q;
        (data ?? []).forEach((r) => {
          if (r.sent_at) out.push({ at: r.sent_at, kind: 'agreement', text: 'Agreement sent to homeowner', projectId: r.project_id });
          if (r.executed_at) out.push({ at: r.executed_at, kind: 'agreement', text: 'Agreement fully signed', projectId: r.project_id });
        });
      })(),
    );

  if (want('agreement'))
    add(
      (async () => {
        let q = db.from('agreement_signatures').select('project_id,role,user_id,revision,signed_at').order('signed_at', { ascending: false }).limit(per);
        if (pid) q = q.eq('project_id', pid);
        if (uid) q = q.eq('user_id', uid);
        const { data } = await q;
        (data ?? []).forEach((r) =>
          out.push({ at: r.signed_at, kind: 'agreement', text: `Agreement signed by the ${r.role} (revision ${r.revision})`, projectId: r.project_id, userId: r.user_id }),
        );
      })(),
    );

  if (want('change'))
    add(
      (async () => {
        let q = db
          .from('change_orders')
          .select('project_id,number,title,status,requested_by,requested_role,created_at,decided_at,decided_by')
          .order('created_at', { ascending: false })
          .limit(per);
        if (pid) q = q.eq('project_id', pid);
        if (uid) q = q.eq('requested_by', uid);
        const { data } = await q;
        (data ?? []).forEach((r) => {
          out.push({ at: r.created_at, kind: 'change', text: `Change order CO-${r.number} requested by the ${r.requested_role}: ${r.title}`, projectId: r.project_id, userId: r.requested_by });
          if (r.decided_at && r.status !== 'pending')
            out.push({ at: r.decided_at, kind: 'change', text: `Change order CO-${r.number} ${r.status}`, projectId: r.project_id, userId: r.decided_by ?? undefined });
        });
      })(),
    );

  if (want('payment') && !uid)
    add(
      (async () => {
        let q = db
          .from('agreement_milestones')
          .select('project_id,label,pay_status,paid_method,requested_at,paid_at,confirmed_at,lien_waiver')
          .neq('pay_status', 'scheduled')
          .limit(per * 2);
        if (pid) q = q.eq('project_id', pid);
        const { data } = await q;
        (data ?? []).forEach((r) => {
          if (r.requested_at) out.push({ at: r.requested_at, kind: 'payment', text: `Payment requested: ${r.label}`, projectId: r.project_id });
          if (r.paid_at) out.push({ at: r.paid_at, kind: 'payment', text: `Payment marked paid (${r.paid_method ?? 'method not set'}): ${r.label}`, projectId: r.project_id });
          if (r.confirmed_at)
            out.push({ at: r.confirmed_at, kind: 'payment', text: `Payment confirmed received: ${r.label}${r.lien_waiver ? ' (lien waiver noted)' : ''}`, projectId: r.project_id });
        });
      })(),
    );

  if (want('photo'))
    add(
      (async () => {
        let q = db.from('photos').select('project_id,uploaded_by,uploader_role,kind,status,created_at').order('created_at', { ascending: false }).limit(per);
        if (pid) q = q.eq('project_id', pid);
        if (uid) q = q.eq('uploaded_by', uid);
        const { data } = await q;
        (data ?? []).forEach((r) =>
          out.push({ at: r.created_at, kind: 'photo', text: `${r.kind === 'fix' ? 'Fix-list' : 'Progress'} photo added by the ${r.uploader_role}`, projectId: r.project_id, userId: r.uploaded_by }),
        );
      })(),
    );

  // Price checks: only that one was run. The result is private to the homeowner who asked.
  if (want('pricecheck'))
    add(
      (async () => {
        let q = db.from('price_checks').select('project_id,requested_by,created_at').order('created_at', { ascending: false }).limit(per);
        if (pid) q = q.eq('project_id', pid);
        if (uid) q = q.eq('requested_by', uid);
        const { data } = await q;
        (data ?? []).forEach((r) =>
          out.push({ at: r.created_at, kind: 'pricecheck', text: 'Price check run (result is private)', projectId: r.project_id, userId: r.requested_by }),
        );
      })(),
    );

  await Promise.all(jobs);
  out.sort((a, b) => (a.at < b.at ? 1 : -1));
  return out.slice(0, scope.limit ?? 100);
}

/** Look up names for the ids used in a feed, so rows can show project names and emails. */
export async function lookups(events: FeedEvent[]) {
  const db = supabaseAdmin();
  const pids = Array.from(new Set(events.map((e) => e.projectId).filter(Boolean))) as string[];
  const uids = Array.from(new Set(events.map((e) => e.userId).filter(Boolean))) as string[];
  const [{ data: ps }, { data: us }] = await Promise.all([
    pids.length ? db.from('projects').select('id,name').in('id', pids) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    uids.length ? db.from('profiles').select('id,email').in('id', uids) : Promise.resolve({ data: [] as { id: string; email: string }[] }),
  ]);
  return {
    project: Object.fromEntries((ps ?? []).map((p) => [p.id, p.name])) as Record<string, string>,
    user: Object.fromEntries((us ?? []).map((u) => [u.id, u.email])) as Record<string, string>,
  };
}
