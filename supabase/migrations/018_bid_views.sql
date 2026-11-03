-- Bid viewed signals (018). Run once in the Supabase SQL editor. Safe to run again.
-- The contractor sees whether the homeowner has viewed a bid, how many times, and whether it is in their comparison.
-- No time spent is stored.
alter table public.marketplace_bids add column if not exists first_viewed_at timestamptz;
alter table public.marketplace_bids add column if not exists last_viewed_at timestamptz;
alter table public.marketplace_bids add column if not exists view_count int not null default 0;
alter table public.marketplace_bids add column if not exists compared_at timestamptz;
-- Set when the contractor opens the bid after the first view, so the Needs you row goes away.
alter table public.marketplace_bids add column if not exists viewed_ack_at timestamptz;
