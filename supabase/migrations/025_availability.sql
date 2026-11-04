-- Contractor availability: taking new jobs, booked until a date, or paused. Run once in the Supabase SQL editor.
alter table public.companies add column if not exists availability text not null default 'open' check (availability in ('open', 'booked', 'paused'));
alter table public.companies add column if not exists booked_until date;
