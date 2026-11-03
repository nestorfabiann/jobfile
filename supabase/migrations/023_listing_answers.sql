-- Detailed scope answers from the post form. Safe to run more than once.
alter table public.marketplace_listings add column if not exists answers jsonb not null default '{}'::jsonb;
