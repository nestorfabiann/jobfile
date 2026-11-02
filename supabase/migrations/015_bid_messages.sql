-- Short messages between a homeowner and a bidding contractor before the bid is accepted (015). Run once in the Supabase SQL editor.
create table if not exists public.marketplace_messages (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  bid_id uuid not null references public.marketplace_bids(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists marketplace_messages_bid_idx on public.marketplace_messages (bid_id, created_at);
alter table public.marketplace_messages enable row level security;
