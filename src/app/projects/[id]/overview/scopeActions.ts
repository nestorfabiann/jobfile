'use server';

import { revalidatePath } from 'next/cache';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyOtherSide } from '@/lib/notify';

export type ScopeResult = { ok: true } | { ok: false; error: string };

/** The agreement work lines and approved change orders are the only things that can be tracked. */
async function lineTitle(projectId: string, kind: string, id: string): Promise<string | null> {
  const db = supabaseAdmin();
  if (kind === 'item') {
    const { data } = await db.from('agreement_items').select('title,kind').eq('id', id).eq('project_id', projectId).maybeSingle();
    return data && data.kind === 'work' ? (data.title as string) : null;
  }
  if (kind === 'co') {
    const { data } = await db.from('change_orders').select('title,number,status').eq('id', id).eq('project_id', projectId).maybeSingle();
    return data && data.status === 'approved' ? `Change order ${data.number}: ${data.title}` : null;
  }
  return null;
}

/** Contractor: set a line to not started, in progress or done (with an optional photo that is already uploaded). */
export async function setScopeStatus(input: { projectId: string; kind: 'item' | 'co'; id: string; to: 'not_started' | 'in_progress' | 'done'; photoId?: string }): Promise<ScopeResult> {
  try {
    const { role, user, project } = await loadProject(input.projectId);
    if (role !== 'contractor') return { ok: false, error: 'Only the contractor updates the scope.' };
    if (!['item', 'co'].includes(input.kind) || !/^[0-9a-f-]{36}$/i.test(input.id)) return { ok: false, error: 'That line was not found.' };
    const title = await lineTitle(project.id, input.kind, input.id);
    if (!title) return { ok: false, error: 'That line was not found.' };
    const db = supabaseAdmin();
    if (input.to === 'not_started') {
      const { data: ex } = await db.from('project_scope_status').select('id,phase_id').eq('project_id', project.id).eq('ref_kind', input.kind).eq('ref_id', input.id).maybeSingle();
      if (ex?.phase_id) await db.from('project_scope_status').update({ status: 'not_started', done_at: null, done_by: null, ho_reaction: null, ho_note: '', ho_at: null, updated_at: new Date().toISOString() }).eq('id', ex.id);
      else if (ex) await db.from('project_scope_status').delete().eq('id', ex.id);
    } else {
      let photoId: string | null = null;
      if (input.photoId && /^[0-9a-f-]{36}$/i.test(input.photoId)) {
        const { data: ph } = await db.from('photos').select('id').eq('id', input.photoId).eq('project_id', project.id).maybeSingle();
        photoId = (ph?.id as string | undefined) ?? null;
      }
      const row: Record<string, unknown> = { project_id: project.id, ref_kind: input.kind, ref_id: input.id, status: input.to, updated_at: new Date().toISOString() };
      // With no phase picked yet, use the phase that is in progress right now, if there is exactly one.
      if (input.kind === 'item') {
        const { data: ex } = await db.from('project_scope_status').select('phase_id').eq('project_id', project.id).eq('ref_kind', 'item').eq('ref_id', input.id).maybeSingle();
        if (!ex?.phase_id) {
          const { data: cur } = await db.from('project_phases').select('id,note').eq('project_id', project.id).eq('status', 'in_progress');
          const open = ((cur ?? []) as any[]).filter((p) => p.note !== 'From a change order');
          if (open.length === 1) row.phase_id = open[0].id;
        }
      }
      if (input.to === 'done') { row.done_at = new Date().toISOString(); row.done_by = user.id; if (photoId) row.photo_id = photoId; }
      else { row.done_at = null; row.done_by = null; row.ho_reaction = null; row.ho_note = ''; row.ho_at = null; }
      const { error } = await db.from('project_scope_status').upsert(row, { onConflict: 'project_id,ref_kind,ref_id' });
      if (error) return { ok: false, error: 'Could not save. Check that the database step was run.' };
      if (input.to === 'done') {
        await notifyOtherSide({ projectId: project.id, senderId: user.id, senderRole: 'contractor', kind: 'scope', title: (n) => `Work finished on ${n}: ${title.slice(0, 80)}`, body: 'Open the Overview tab to see the scope and what is done. You can tap Looks good or ask a question.', throttle: true });
      }
    }
    revalidatePath(`/projects/${project.id}/overview`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Something went wrong. Try again.' };
  }
}

/** Homeowner: Looks good, or a question that goes to Messages with the line quoted. */
export async function reactScope(input: { projectId: string; kind: 'item' | 'co'; id: string; reaction: 'ok' | 'question'; note?: string }): Promise<ScopeResult> {
  try {
    const { sb, role, user, project } = await loadProject(input.projectId);
    if (role !== 'homeowner') return { ok: false, error: 'Only the homeowner can respond.' };
    const db = supabaseAdmin();
    const { data: cur } = await db.from('project_scope_status').select('id,status').eq('project_id', project.id).eq('ref_kind', input.kind).eq('ref_id', input.id).maybeSingle();
    if (!cur || cur.status !== 'done') return { ok: false, error: 'That line is not marked done.' };
    const title = await lineTitle(project.id, input.kind, input.id);
    if (!title) return { ok: false, error: 'That line was not found.' };
    const note = String(input.note ?? '').trim().slice(0, 500);
    if (input.reaction === 'question') {
      if (!note) return { ok: false, error: 'Type your question first.' };
      const body = `About "${title}": ${note}`.slice(0, 4000);
      const { error: me } = await sb.from('messages').insert({ project_id: project.id, sender_id: user.id, sender_role: 'homeowner', tag: 'question', body });
      if (me) return { ok: false, error: 'Could not send your question. Try again.' };
      await notifyOtherSide({ projectId: project.id, senderId: user.id, senderRole: 'homeowner', kind: 'message', title: () => 'Your customer asked a question about finished work', body: body.slice(0, 240), throttle: false });
    }
    await db.from('project_scope_status').update({ ho_reaction: input.reaction, ho_note: input.reaction === 'question' ? note : '', ho_at: new Date().toISOString() }).eq('id', cur.id);
    revalidatePath(`/projects/${project.id}/overview`);
    revalidatePath(`/projects/${project.id}`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Something went wrong. Try again.' };
  }
}

/** Contractor: tie a scope line to a schedule phase (or clear it). */
export async function setScopePhase(input: { projectId: string; kind: 'item' | 'co'; id: string; phaseId: string | null }): Promise<ScopeResult> {
  try {
    const { role, project } = await loadProject(input.projectId);
    if (role !== 'contractor') return { ok: false, error: 'Only the contractor updates the scope.' };
    if (!['item', 'co'].includes(input.kind) || !/^[0-9a-f-]{36}$/i.test(input.id)) return { ok: false, error: 'That line was not found.' };
    const title = await lineTitle(project.id, input.kind, input.id);
    if (!title) return { ok: false, error: 'That line was not found.' };
    const db = supabaseAdmin();
    let phaseId: string | null = null;
    if (input.phaseId) {
      const { data: ph } = await db.from('project_phases').select('id').eq('id', input.phaseId).eq('project_id', project.id).maybeSingle();
      if (!ph) return { ok: false, error: 'That phase was not found.' };
      phaseId = ph.id as string;
    }
    const { data: ex } = await db.from('project_scope_status').select('id,status').eq('project_id', project.id).eq('ref_kind', input.kind).eq('ref_id', input.id).maybeSingle();
    if (ex) {
      const { error } = await db.from('project_scope_status').update({ phase_id: phaseId, updated_at: new Date().toISOString() }).eq('id', ex.id);
      if (error) return { ok: false, error: 'Could not save. Check that the database step was run.' };
      if (!phaseId && ex.status === 'not_started') await db.from('project_scope_status').delete().eq('id', ex.id);
    } else if (phaseId) {
      const { error } = await db.from('project_scope_status').insert({ project_id: project.id, ref_kind: input.kind, ref_id: input.id, status: 'not_started', phase_id: phaseId });
      if (error) return { ok: false, error: 'Could not save. Check that the database step was run.' };
    }
    revalidatePath(`/projects/${project.id}/overview`);
    revalidatePath(`/projects/${project.id}/schedule`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Something went wrong. Try again.' };
  }
}

/** Contractor: the prompt after the last scope line in a phase is done. Same effect as Mark done on the Schedule tab. */
export async function finishPhase(input: { projectId: string; phaseId: string }): Promise<ScopeResult> {
  try {
    const { role, user, project } = await loadProject(input.projectId);
    if (role !== 'contractor') return { ok: false, error: 'Only the contractor updates the schedule.' };
    const db = supabaseAdmin();
    const { data: ph } = await db.from('project_phases').select('id,title,status').eq('id', input.phaseId).eq('project_id', project.id).maybeSingle();
    if (!ph) return { ok: false, error: 'That phase was not found.' };
    if (ph.status !== 'done') {
      await db.from('project_phases').update({ status: 'done' }).eq('id', ph.id);
      await notifyOtherSide({ projectId: project.id, senderId: user.id, senderRole: 'contractor', kind: 'schedule', throttle: true, title: (n) => `${ph.title} is done on ${n}`, body: 'Open the Schedule tab to see what is next.' });
    }
    revalidatePath(`/projects/${project.id}/overview`);
    revalidatePath(`/projects/${project.id}/schedule`);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Something went wrong. Try again.' };
  }
}
