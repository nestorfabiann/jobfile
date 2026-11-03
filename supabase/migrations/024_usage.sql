-- Usage tracking for the admin Usage page: sign-ins, page views and short "still here" pings.
-- Stores the page name (never an id or message text). Server only: RLS on, no policies. Safe to run more than once.
create table if not exists public.usage_events (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('signin', 'view', 'ping')),
  page text not null default '' check (char_length(page) <= 60),
  created_at timestamptz not null default now()
);
create index if not exists usage_events_user_idx on public.usage_events (user_id, created_at desc);
create index if not exists usage_events_time_idx on public.usage_events (created_at desc);
alter table public.usage_events enable row level security;
