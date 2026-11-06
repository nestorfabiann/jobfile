-- Site visits: the homeowner confirms the visit happened. Run once in the Supabase SQL editor.
-- Also lets the status column hold 'asked' and 'done', which the app already uses.
alter table public.visits drop constraint if exists visits_status_check;
alter table public.visits add constraint visits_status_check check (status in ('asked', 'requested', 'proposed', 'confirmed', 'done', 'canceled'));
alter table public.visits
  add column if not exists done_at timestamptz,
  add column if not exists confirm_state text check (confirm_state in ('pending', 'yes', 'no')),
  add column if not exists dispute_reason text not null default '';
