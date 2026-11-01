-- Admin panel support. Run once in the Supabase SQL editor after 001-005.

alter table public.profiles add column if not exists banned_at timestamptz;
alter table public.profiles add column if not exists ban_reason text not null default '';

-- Every admin action is written here. RLS is on with no policies, so only the server (service role) can read or write it.
create table if not exists public.admin_audit (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id),
  admin_email text not null default '',
  action text not null,
  target_type text not null default '',
  target_id text not null default '',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_created on public.admin_audit (created_at desc);
alter table public.admin_audit enable row level security;
