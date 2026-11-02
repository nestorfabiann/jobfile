-- Marketplace: homeowners post projects, contractors bid. Run once in the Supabase SQL editor after 010.
-- Turn the feature on with MARKETPLACE_ENABLED=true in Vercel. All tables are server-only (no client policies).

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  homeowner_id uuid not null references auth.users(id) on delete cascade,
  homeowner_name text not null default '' check (char_length(homeowner_name) <= 120),
  job_type text not null check (char_length(job_type) between 1 and 60),
  items text[] not null default '{}',
  details text not null default '' check (char_length(details) <= 1000),
  size_sqft int check (size_sqft between 1 and 1000000),
  zip text not null check (zip ~ '^[0-9]{5}$'),
  city text not null default '' check (char_length(city) <= 80),
  address text not null default '' check (char_length(address) <= 200), -- private until a bid is accepted
  is_homestead boolean not null default false,
  budget_min_cents bigint check (budget_min_cents >= 0),
  budget_max_cents bigint check (budget_max_cents >= 0),
  ai_low_cents bigint,
  ai_high_cents bigint,
  ai_likely_cents bigint,
  ai_confidence text,
  ai_breakdown jsonb not null default '[]'::jsonb,
  ai_notes text not null default '',
  status text not null default 'open' check (status in ('open', 'awarded', 'closed')),
  expires_at timestamptz not null default (now() + interval '30 days'),
  awarded_bid_id uuid,
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists marketplace_listings_status_idx on public.marketplace_listings (status, created_at desc);
create index if not exists marketplace_listings_owner_idx on public.marketplace_listings (homeowner_id, created_at desc);
alter table public.marketplace_listings enable row level security;

create table if not exists public.marketplace_bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  bidder_id uuid not null references auth.users(id) on delete cascade,
  price_cents bigint not null check (price_cents > 0),
  weeks int check (weeks between 1 and 520),
  start_date date,
  inclusions text not null default '' check (char_length(inclusions) <= 500),
  note text not null default '' check (char_length(note) <= 1000),
  status text not null default 'waiting' check (status in ('waiting', 'won', 'not_selected', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, company_id)
);
create index if not exists marketplace_bids_company_idx on public.marketplace_bids (company_id, created_at desc);
alter table public.marketplace_bids enable row level security;

create table if not exists public.marketplace_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now()
);
alter table public.marketplace_photos enable row level security;
insert into storage.buckets (id, name, public) values ('listing-photos', 'listing-photos', false) on conflict (id) do nothing;

-- Saved AI cost references (also used to rate-limit and so a listing can only carry a reference the server made).
create table if not exists public.marketplace_ai_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists marketplace_ai_calls_user_idx on public.marketplace_ai_calls (user_id, created_at desc);
alter table public.marketplace_ai_calls enable row level security;
