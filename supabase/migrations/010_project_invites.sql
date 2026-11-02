-- Homeowners can start a project and invite a contractor. Run once in the Supabase SQL editor after 009.
-- The invite holds the project details until the contractor accepts; then the normal project is created.
create table if not exists public.project_invites (
  id uuid primary key default gen_random_uuid(),
  homeowner_id uuid not null references auth.users(id) on delete cascade,
  homeowner_name text not null default '' check (char_length(homeowner_name) <= 120),
  project_name text not null check (char_length(project_name) between 1 and 120),
  address text not null default '' check (char_length(address) <= 200),
  description text not null default '' check (char_length(description) <= 2000),
  is_homestead boolean not null default false,
  contractor_email text not null check (char_length(contractor_email) <= 200),
  contractor_name text not null default '' check (char_length(contractor_name) <= 120),
  message text not null default '' check (char_length(message) <= 500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  send_count int not null default 1,
  last_sent_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  project_id uuid references public.projects(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists project_invites_homeowner_idx on public.project_invites (homeowner_id, created_at desc);
create index if not exists project_invites_email_idx on public.project_invites (lower(contractor_email));
alter table public.project_invites enable row level security; -- no policies: server only, after it checks who is asking
