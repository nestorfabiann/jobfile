-- Site visits: requested on a bid, or added on a project. Run once in the Supabase SQL editor.
create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.marketplace_listings(id) on delete cascade,
  bid_id uuid references public.marketplace_bids(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null default 'Site visit' check (char_length(title) between 1 and 120),
  note text not null default '' check (char_length(note) <= 500),
  duration_text text not null default '' check (char_length(duration_text) <= 60),
  status text not null default 'requested' check (status in ('requested', 'proposed', 'confirmed', 'canceled')),
  slots jsonb not null default '[]'::jsonb,
  scheduled_for timestamptz,
  requested_role text check (requested_role in ('contractor', 'homeowner')),
  last_role text check (last_role in ('contractor', 'homeowner')),
  created_by uuid references auth.users(id),
  access jsonb not null default '{}'::jsonb,
  remind_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists visits_bid on public.visits (bid_id);
create index if not exists visits_project on public.visits (project_id, scheduled_for);
alter table public.visits enable row level security;
