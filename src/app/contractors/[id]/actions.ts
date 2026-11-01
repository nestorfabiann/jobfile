'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';

const REASONS = ['Abuse or harassment', 'Personal information', 'Not about the work', 'Looks fake', 'Other'];

/** Any signed-in person can report a review once. An admin then decides. */
export async function reportReview(formData: FormData) {
  const { user } = await requireUser();
  const reviewId = String(formData.get('review_id') ?? '');
  const companyId = String(formData.get('company_id') ?? '');
  const reason = REASONS.includes(String(formData.get('reason'))) ? String(formData.get('reason')) : 'Other';

  const admin = supabaseAdmin();
  const { data: r } = await admin.from('reviews').select('id,reported_at,hidden_at,subject_company_id').eq('id', reviewId).maybeSingle();
  if (r && !r.reported_at && !r.hidden_at && r.subject_company_id === companyId) {
    await admin.from('reviews').update({ reported_at: new Date().toISOString(), reported_by: user.id, report_reason: reason }).eq('id', r.id);
  }
  revalidatePath(`/contractors/${companyId}`);
  redirect(`/contractors/${companyId}?reported=1`);
}
