-- Team bids: two companies bid together on one marketplace listing. Run once in the Supabase SQL editor after 036.
-- A team bid is a draft until the partner confirms; then the app creates the normal marketplace bid. Server-only tables (RLS on, no policies).

alter table public.companies add column if not exists open_to_partner boolean not null default false;

create table if not exists public.team_bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  lead_company_id uuid not null references public.companies(id) on delete cascade,
  lead_user_id uuid not null references auth.users(id) on delete cascade,
  lead_cents bigint not null check (lead_cents > 0),
  weeks int check (weeks between 1 and 520),
  start_date date,
  inclusions text not null default '' check (char_length(inclusions) <= 500),
  note text not null default '' check (char_length(note) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'sent', 'canceled')),
  bid_id uuid references public.marketplace_bids(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, lead_company_id)
);
create index if not exists team_bids_lead_idx on public.team_bids (lead_company_id, created_at desc);
alter table public.team_bids enable row level security;

create table if not exists public.team_partners (
  id uuid primary key default gen_random_uuid(),
  team_bid_id uuid not null references public.team_bids(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  scope text not null default '' check (char_length(scope) <= 300),
  price_cents bigint not null check (price_cents > 0),
  counter_cents bigint check (counter_cents > 0),
  status text not null default 'invited' check (status in ('invited', 'countered', 'confirmed', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_bid_id, company_id)
);
create index if not exists team_partners_company_idx on public.team_partners (company_id, created_at desc);
alter table public.team_partners enable row level security;
