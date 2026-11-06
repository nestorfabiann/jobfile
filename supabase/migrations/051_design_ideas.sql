-- AI design ideas from a photo. Run once in the Supabase SQL editor.
-- Tables are server-only (RLS on, no policies). Photos live in a private bucket.
create table if not exists public.design_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space text not null check (space in ('kitchen', 'bathroom')),
  style text not null default '' check (char_length(style) <= 40),
  picks jsonb not null default '{}'::jsonb,
  notes text not null default '' check (char_length(notes) <= 300),
  original_path text not null,
  results text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists design_ideas_user_idx on public.design_ideas (user_id, created_at desc);
alter table public.design_ideas enable row level security;

insert into storage.buckets (id, name, public) values ('design-ideas', 'design-ideas', false) on conflict (id) do nothing;
