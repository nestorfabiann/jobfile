-- Ratings a contractor links from outside Jobfile (Google first). Shown beside, never mixed into, the Jobfile score.
create table if not exists public.company_ratings (
  company_id uuid not null references public.companies(id) on delete cascade,
  source text not null default 'google',
  link text not null default '',
  place_id text not null default '',
  place_name text not null default '',
  place_address text not null default '',
  maps_url text not null default '',
  rating numeric(2,1),
  review_count integer,
  status text not null default 'pending',
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (company_id, source)
);
alter table public.company_ratings enable row level security;
