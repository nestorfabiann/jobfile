-- Ratings for both sides, after a project is complete. Run once in the Supabase SQL editor after 001-007.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  reviewer_role text not null check (reviewer_role in ('homeowner', 'contractor')),
  -- A homeowner rates the company. A contractor rates the homeowner's login.
  subject_company_id uuid references public.companies(id) on delete cascade,
  subject_user_id uuid references auth.users(id) on delete cascade,
  overall smallint not null check (overall between 1 and 5),
  categories jsonb not null default '{}'::jsonb,
  comment text not null default '' check (char_length(comment) <= 1000),
  reply text check (reply is null or char_length(reply) <= 600),
  reply_at timestamptz,
  reported_by uuid references auth.users(id),
  reported_at timestamptz,
  report_reason text not null default '',
  hidden_at timestamptz,
  hidden_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, reviewer_role)
);
create index if not exists reviews_company on public.reviews (subject_company_id) where subject_company_id is not null;
create index if not exists reviews_user on public.reviews (subject_user_id) where subject_user_id is not null;
create index if not exists reviews_reported on public.reviews (reported_at) where reported_at is not null;

-- People can read only their own review directly. Everything else (the other side's review, public profiles,
-- the admin queue) is read by the server after it checks the review is revealed. All writes go through the server.
alter table public.reviews enable row level security;
drop policy if exists "own reviews" on public.reviews;
create policy "own reviews" on public.reviews for select using (reviewer_id = auth.uid());
