-- Team bids: choose between one contract with a lead, or separate contracts. Run once in the Supabase SQL editor after 037.
alter table public.team_bids add column if not exists structure text not null default 'lead' check (structure in ('lead', 'separate'));
alter table public.team_bids add column if not exists hire_mode text not null default 'either' check (hire_mode in ('either', 'package'));
alter table public.team_bids add column if not exists schedule_note text not null default '' check (char_length(schedule_note) <= 200);
alter table public.team_partners add column if not exists bid_id uuid references public.marketplace_bids(id) on delete set null;
alter table public.team_partners add column if not exists answered_by uuid references auth.users(id) on delete set null;
