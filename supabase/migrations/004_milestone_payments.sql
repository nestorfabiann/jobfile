-- Payment tracking moves onto the payment schedule itself: each milestone is requested, paid, then confirmed.
-- Run once in the Supabase SQL editor after 003.
alter table public.agreement_milestones add column if not exists pay_status text not null default 'scheduled'
  check (pay_status in ('scheduled', 'requested', 'paid', 'confirmed'));
alter table public.agreement_milestones add column if not exists requested_at timestamptz;
alter table public.agreement_milestones add column if not exists paid_at timestamptz;
alter table public.agreement_milestones add column if not exists paid_method text
  check (paid_method in ('check', 'cash', 'ach', 'card', 'other'));
alter table public.agreement_milestones add column if not exists confirmed_at timestamptz;
alter table public.agreement_milestones add column if not exists lien_waiver boolean not null default false;

-- The free-form payments table from 003 is replaced by the above.
drop table if exists public.payments;
