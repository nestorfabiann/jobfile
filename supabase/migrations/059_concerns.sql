-- Homeowner "what matters most" on a listing, and the contractor's answer on a bid.
alter table public.marketplace_listings add column if not exists concerns text not null default '';
alter table public.marketplace_listings add column if not exists concerns_other text not null default '';
alter table public.marketplace_bids add column if not exists concern_note text not null default '';
