-- Contractor credentials (BBB, chamber, trade groups, manufacturer, EPA lead-safe, licenses, other).
-- status: stated (shown as "Stated by contractor"), checked (a Jobfile admin verified it), rejected (hidden).
create table if not exists public.company_credentials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null,
  name text not null,
  link text,
  proof_path text,
  expires_on date,
  status text not null default 'stated' check (status in ('stated', 'checked', 'rejected')),
  review_note text not null default '',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists company_credentials_company_idx on public.company_credentials (company_id);
create index if not exists company_credentials_status_idx on public.company_credentials (status);
alter table public.company_credentials enable row level security; -- no policies: server only
