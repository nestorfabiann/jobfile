-- Help and contact messages (021). Run once in the Supabase SQL editor. Safe to re-run.
create table if not exists public.help_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null default 'question' check (topic in ('question','problem','idea','report')),
  project_id uuid references public.projects(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  page text not null default '',
  device text not null default '',
  reply text not null default '',
  replied_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists help_messages_user_idx on public.help_messages (user_id, created_at desc);
create index if not exists help_messages_open_idx on public.help_messages (done_at, created_at);
alter table public.help_messages enable row level security;
