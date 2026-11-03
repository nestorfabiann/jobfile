-- Invite friends (022). Run once in the Supabase SQL editor. Safe to re-run.
create table if not exists public.invite_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.invite_events (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  kind text not null check (kind in ('open','join')),
  invitee_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists invite_events_code_idx on public.invite_events (code, kind);
create unique index if not exists invite_events_one_join on public.invite_events (invitee_id) where kind = 'join';
alter table public.invite_codes enable row level security;
alter table public.invite_events enable row level security;
