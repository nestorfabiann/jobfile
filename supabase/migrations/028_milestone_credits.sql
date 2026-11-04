-- An approved credit (smaller scope) lowers the last unpaid payments. The reduction is stored on each payment.
-- Run once in the Supabase SQL editor.
alter table public.agreement_milestones add column if not exists adjust_cents bigint not null default 0;
alter table public.agreement_milestones add column if not exists adjust_note text not null default '';
