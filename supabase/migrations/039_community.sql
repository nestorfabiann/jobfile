-- Community: finished-project showcases and idea questions. Run once in the Supabase SQL editor after 038.
-- All tables are server-only (RLS on, no policies). Photos live in a private bucket and are shown through signed links.

insert into storage.buckets (id, name, public) values ('community-photos', 'community-photos', false) on conflict (id) do nothing;

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('showcase', 'idea')),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_role text not null check (author_role in ('contractor', 'homeowner')),
  company_id uuid references public.companies(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  title text not null check (char_length(title) between 3 and 100),
  body text not null default '' check (char_length(body) <= 800),
  trade text not null default '' check (char_length(trade) <= 60),
  city text not null default '' check (char_length(city) <= 80),
  days int check (days between 1 and 1000),
  cost_low_cents bigint check (cost_low_cents >= 0),
  cost_high_cents bigint check (cost_high_cents >= 0),
  before_path text,
  after_path text,
  photo_path text,
  poll jsonb not null default '[]'::jsonb,
  status text not null default 'pending_other' check (status in ('pending_other', 'pending_review', 'live', 'rejected', 'held', 'removed')),
  reject_reason text not null default '',
  other_ok_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists community_posts_feed_idx on public.community_posts (status, kind, created_at desc);
create index if not exists community_posts_author_idx on public.community_posts (author_id, created_at desc);
alter table public.community_posts enable row level security;

create table if not exists public.community_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.community_likes enable row level security;

create table if not exists public.community_saves (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.community_saves enable row level security;

create table if not exists public.community_votes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  option int not null check (option between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.community_votes enable row level security;

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  body text not null check (char_length(body) between 1 and 500),
  status text not null default 'live' check (status in ('live', 'hidden')),
  created_at timestamptz not null default now()
);
create index if not exists community_comments_post_idx on public.community_comments (post_id, created_at);
alter table public.community_comments enable row level security;

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'comment')),
  target_id uuid not null,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
alter table public.community_reports enable row level security;
