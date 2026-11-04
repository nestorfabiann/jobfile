-- Phone alerts: one row per phone or browser that turned alerts on.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  prefs jsonb not null default '{"bids":true,"visits":true,"pay":true,"msg":false,"tips":false}'::jsonb,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
-- No policies: the server reads and writes with the service key after checking who is signed in.
