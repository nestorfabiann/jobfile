-- Local job matching: contractor business ZIP, trades and alert switch, plus a ZIP code location cache.
-- Run once in the Supabase SQL editor after 011. Safe to run twice.

alter table public.companies add column if not exists business_zip text check (business_zip is null or business_zip ~ '^[0-9]{5}$');
alter table public.companies add column if not exists trades text[] not null default '{}';
alter table public.companies add column if not exists job_alerts boolean not null default true;

-- Filled automatically the first time a ZIP is looked up. Server-only (no client policies).
create table if not exists public.zip_coords (
  zip text primary key check (zip ~ '^[0-9]{5}$'),
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);
alter table public.zip_coords enable row level security;
