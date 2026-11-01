-- Contractor business profile: details, work photos and proof of insurance.
-- Run once in the Supabase SQL editor after 008.

-- Profile details live on the company. Companies have no client write policy,
-- so only the server (after it checks the person owns the company) can change them.
alter table public.companies
  add column if not exists about text not null default '' check (char_length(about) <= 800),
  add column if not exists services text[] not null default '{}',
  add column if not exists languages text[] not null default '{}',
  add column if not exists payments text[] not null default '{}',
  add column if not exists service_radius_mi int check (service_radius_mi between 1 and 500),
  add column if not exists year_started int check (year_started between 1900 and 2100),
  add column if not exists crew_size int check (crew_size between 1 and 10000),
  add column if not exists warranty text not null default '' check (char_length(warranty) <= 120),
  add column if not exists hours text not null default '' check (char_length(hours) <= 120),
  add column if not exists license_note text not null default '' check (char_length(license_note) <= 160),
  add column if not exists website text not null default '' check (char_length(website) <= 300),
  add column if not exists facebook text not null default '' check (char_length(facebook) <= 300),
  add column if not exists instagram text not null default '' check (char_length(instagram) <= 300),
  add column if not exists other_link text not null default '' check (char_length(other_link) <= 300),
  add column if not exists logo_path text;

-- Photos of past work. Private bucket: the server hands out short-lived links to signed-in people only.
insert into storage.buckets (id, name, public) values ('company-photos', 'company-photos', false) on conflict (id) do nothing;

create table if not exists public.company_photos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  path text not null,
  caption text not null default '' check (char_length(caption) <= 120),
  created_at timestamptz not null default now()
);
create index if not exists company_photos_company_idx on public.company_photos (company_id, created_at);
alter table public.company_photos enable row level security; -- no policies: server only

-- Insurance certificates. Private bucket, never linked from public pages. Only admins can open the files.
insert into storage.buckets (id, name, public) values ('company-docs', 'company-docs', false) on conflict (id) do nothing;

create table if not exists public.company_insurance (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null check (kind in ('liability', 'workers_comp')),
  path text not null,
  carrier text not null default '' check (char_length(carrier) <= 120),
  coverage text not null default '' check (char_length(coverage) <= 60),
  expires_on date not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text not null default '' check (char_length(review_note) <= 300),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  uploaded_at timestamptz not null default now(),
  unique (company_id, kind)
);
alter table public.company_insurance enable row level security; -- no policies: server only
