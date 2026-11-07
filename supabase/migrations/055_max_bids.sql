-- Homeowner chooses how many bids they want. null = no limit (all existing listings stay unlimited).
alter table public.marketplace_listings add column if not exists max_bids int;
alter table public.marketplace_listings drop constraint if exists marketplace_listings_max_bids_check;
alter table public.marketplace_listings add constraint marketplace_listings_max_bids_check check (max_bids is null or (max_bids between 1 and 50));
