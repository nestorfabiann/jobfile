-- Admin profile tools (017). Run once in the Supabase SQL editor. Safe to run again.

-- Private admin notes about a person or a company. Never shown to them.
create table if not exists public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('user', 'company')),
  subject_id uuid not null,
  author_id uuid references auth.users(id) on delete set null,
  author_email text not null default '',
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists admin_notes_subject_idx on public.admin_notes (subject_type, subject_id, created_at desc);
alter table public.admin_notes enable row level security; -- no policies: server only

-- Verified badge and marketplace hiding for companies.
alter table public.companies add column if not exists verified_at timestamptz;
alter table public.companies add column if not exists hidden_at timestamptz;
alter table public.companies add column if not exists hidden_reason text not null default '';

-- "Sign out everywhere": sessions issued before this moment stop working.
alter table public.profiles add column if not exists sessions_revoked_at timestamptz;
