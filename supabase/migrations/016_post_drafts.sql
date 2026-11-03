-- Saved drafts of the "Post a project" form (016). Run once in the Supabase SQL editor.
create table if not exists public.marketplace_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketplace_drafts_user_idx on public.marketplace_drafts (user_id, updated_at desc);
alter table public.marketplace_drafts enable row level security; -- no policies: server only
