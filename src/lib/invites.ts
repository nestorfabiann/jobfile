import { requireUser } from './session';
import { supabaseAdmin } from './supabase/server';

export const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const MAX_OPEN = 5;
export const MAX_PER_DAY = 10;
export const MAX_SENDS = 3;

export type Invite = {
  id: string;
  homeowner_id: string;
  homeowner_name: string;
  project_name: string;
  address: string;
  description: string;
  is_homestead: boolean;
  contractor_email: string;
  contractor_name: string;
  message: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  send_count: number;
  last_sent_at: string;
  expires_at: string;
  project_id: string | null;
  created_at: string;
};

export const isExpired = (i: { status: string; expires_at: string }) => i.status === 'pending' && new Date(i.expires_at).getTime() < Date.now();

/**
 * Loads an invite for the signed-in person. They see it only if they sent it (homeowner),
 * or if their confirmed sign-in email is the one that was invited (contractor). Otherwise null.
 */
export async function loadInvite(id: string) {
  const { user } = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { user, invite: null, side: null as 'homeowner' | 'contractor' | null };
  const { data } = await supabaseAdmin().from('project_invites').select('*').eq('id', id).maybeSingle<Invite>();
  if (!data) return { user, invite: null, side: null as 'homeowner' | 'contractor' | null };
  const mine = data.homeowner_id === user.id;
  const invited = !!user.email && !!user.email_confirmed_at && user.email.toLowerCase() === data.contractor_email.toLowerCase();
  const side: 'homeowner' | 'contractor' | null = mine ? 'homeowner' : invited ? 'contractor' : null;
  return { user, invite: side ? data : null, side };
}
