-- Optional identity check for a business owner. The photo is private and deleted as soon as an admin approves or rejects it.
-- Homeowners only ever see "ID verified" and the month. status: pending, verified, rejected.
create table if not exists public.company_id_checks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  photo_path text,
  read_name text not null default '',
  read_expires date,
  name_match text not null default 'unknown' check (name_match in ('match', 'close', 'no', 'unknown')),
  flags text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  review_note text not null default '',
  reviewed_by uuid,
  reviewed_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists company_id_checks_company_uq on public.company_id_checks (company_id);
create index if not exists company_id_checks_status_idx on public.company_id_checks (status);
alter table public.company_id_checks enable row level security; -- no policies: server only
