-- Announcements: owner-written messages shown to a chosen group inside the app. Run once in the Supabase SQL editor.
-- Tables are server-only (RLS on, no policies). Pictures live in a private bucket.
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  body text not null default '' check (char_length(body) <= 300),
  button_text text not null default '' check (char_length(button_text) <= 30),
  button_href text not null default '' check (char_length(button_href) <= 300),
  style text not null default 'banner' check (style in ('banner', 'sheet', 'picture')),
  color text not null default 'green' check (color in ('green', 'orange', 'blue', 'violet')),
  image_path text not null default '',
  image_alt text not null default '' check (char_length(image_alt) <= 160),
  image_mode text not null default 'top' check (image_mode in ('top', 'full')),
  role text not null default 'homeowners' check (role in ('homeowners', 'contractors', 'everyone')),
  zips text[] not null default '{}',
  activity text not null default 'any' check (activity in ('any', 'posted', 'noproject', 'nobids')),
  status text not null default 'draft' check (status in ('draft', 'live', 'ended')),
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists announcements_status_idx on public.announcements (status, created_at desc);
alter table public.announcements enable row level security;

create table if not exists public.announcement_events (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('seen', 'tap', 'dismiss')),
  created_at timestamptz not null default now(),
  primary key (announcement_id, user_id, kind)
);
create index if not exists announcement_events_user_idx on public.announcement_events (user_id, created_at desc);
alter table public.announcement_events enable row level security;

insert into storage.buckets (id, name, public) values ('announcements', 'announcements', false) on conflict (id) do nothing;
