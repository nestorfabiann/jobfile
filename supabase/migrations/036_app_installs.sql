-- Who has opened Jobfile from the Home Screen app. One row per person, updated on each installed-app visit.
create table if not exists public.app_installs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  device text not null default '',
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
alter table public.app_installs enable row level security;
-- No policies: the server writes with the service key after checking who is signed in.
