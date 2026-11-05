-- Insurance certificates can now be read and approved automatically. These columns record how.
alter table public.company_insurance add column if not exists auto_approved boolean not null default false;
alter table public.company_insurance add column if not exists read_detail jsonb;
