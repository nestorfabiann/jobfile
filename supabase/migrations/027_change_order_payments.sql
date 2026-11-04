-- Approved change orders get their own payment line, tracked like the agreed milestones.
-- Run once in the Supabase SQL editor.
alter table public.change_orders add column if not exists pay_status text not null default 'scheduled'
  check (pay_status in ('scheduled', 'requested', 'paid', 'confirmed'));
alter table public.change_orders add column if not exists requested_at timestamptz;
alter table public.change_orders add column if not exists paid_at timestamptz;
alter table public.change_orders add column if not exists paid_method text
  check (paid_method in ('check', 'cash', 'ach', 'card', 'other'));
alter table public.change_orders add column if not exists confirmed_at timestamptz;
alter table public.change_orders add column if not exists lien_waiver boolean not null default false;
