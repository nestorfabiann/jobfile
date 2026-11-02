-- Remember when a homeowner last looked at the bids on a posted job (014). Run once in the Supabase SQL editor.
alter table public.marketplace_listings add column if not exists bids_seen_at timestamptz;
