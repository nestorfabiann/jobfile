'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { loadProject } from '@/lib/project';
import { supabaseAdmin } from '@/lib/supabase/server';
import { parseDollars } from '@/lib/money';
import { isCat } from '@/lib/expenses';

const BUCKET = 'expense-receipts';
const MAX_BYTES = 3_500_000;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export type ExpenseResult = { ok: true } | { ok: false; error: string };

/** Saves one expense (contractor only). The browser shrinks the receipt photo first. */
export async function addExpense(formData: FormData): Promise<ExpenseResult> {
  try {
    const projectId = String(formData.get('project_id') ?? '');
    const { role, user, project } = await loadProject(projectId);
    if (role !== 'contractor') return { ok: false, error: 'Only the contractor can add expenses.' };
    const cents = parseDollars(String(formData.get('amount') ?? ''));
    if (cents <= 0 || cents >= 100_000_000_000) return { ok: false, error: 'Enter the amount spent.' };
    const category = isCat(formData.get('category')) ? String(formData.get('category')) : 'other';
    const vendor = String(formData.get('vendor') ?? '').trim().slice(0, 120);
    const rawDate = String(formData.get('spent_on') ?? '');
    const spentOn = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

    const admin = supabaseAdmin();
    let receipt: string | null = null;
    const file = formData.get('file');
    if (file instanceof File && file.size > 0) {
      const ext = TYPES[file.type];
      if (!ext) return { ok: false, error: 'Receipts must be JPEG, PNG or WebP photos.' };
      if (file.size > MAX_BYTES) return { ok: false, error: 'That photo is too large even after shrinking.' };
      const path = `${project.id}/${randomUUID()}.${ext}`;
      const up = await admin.storage.from(BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
      if (up.error) return { ok: false, error: 'Could not store the receipt. Check that the 019 SQL step was run.' };
      receipt = path;
    }
    const { error } = await admin.from('project_expenses').insert({ project_id: project.id, company_id: project.company_id, created_by: user.id, amount_cents: cents, category, vendor, spent_on: spentOn, receipt_path: receipt });
    if (error) {
      if (receipt) await admin.storage.from(BUCKET).remove([receipt]);
      return { ok: false, error: 'Could not save the expense. Check that the 019 SQL step was run.' };
    }
    revalidatePath(`/projects/${project.id}/money`);
    return { ok: true };
  } catch (e) {
    if ((e as { digest?: string })?.digest) throw e;
    return { ok: false, error: 'Could not save the expense. Try again.' };
  }
}

export async function removeExpense(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const id = String(formData.get('id') ?? '');
  const { role, project } = await loadProject(projectId);
  if (role !== 'contractor' || !/^[0-9a-f-]{36}$/i.test(id)) return;
  const admin = supabaseAdmin();
  const { data: row } = await admin.from('project_expenses').select('receipt_path').eq('id', id).eq('project_id', project.id).maybeSingle();
  if (!row) return;
  await admin.from('project_expenses').delete().eq('id', id).eq('project_id', project.id);
  if (row.receipt_path) await admin.storage.from(BUCKET).remove([row.receipt_path as string]);
  revalidatePath(`/projects/${project.id}/money`);
}
