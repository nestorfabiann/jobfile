-- Site visits: day-of status ("on my way") and notes after the visit. Run once in the Supabase SQL editor.
alter table public.visits
  add column if not exists live jsonb not null default '{}'::jsonb,
  add column if not exists report text not null default '';
