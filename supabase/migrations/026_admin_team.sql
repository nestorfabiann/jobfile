-- Admin team: people besides the Owner who can open parts of the Admin area. Run once in the Supabase SQL editor.
-- Owners are still the ADMIN_EMAILS list in Vercel, so you can never lock yourself out.
create table if not exists public.admin_team (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and char_length(email) <= 200),
  name text not null default '' check (char_length(name) <= 120),
  role text not null check (role in ('moderator', 'verifier', 'support')),
  added_by text not null default '',
  created_at timestamptz not null default now()
);
alter table public.admin_team enable row level security; -- no policies: server only
