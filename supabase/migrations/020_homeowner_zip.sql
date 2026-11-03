-- Homeowner ZIP and "tips and local news" switch (020). Run once in the Supabase SQL editor. Safe to run again.
alter table public.profiles add column if not exists zip text check (zip is null or zip ~ '^[0-9]{5}$');
alter table public.profiles add column if not exists marketing_email boolean not null default true;
