-- Videos on marketplace projects (013). Run once in the Supabase SQL editor.
create table if not exists public.marketplace_videos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  path text not null,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index if not exists marketplace_videos_listing_idx on public.marketplace_videos (listing_id, created_at);
alter table public.marketplace_videos enable row level security;

-- Private bucket, 50 MB per file, MP4 / MOV (iPhone) / WebM only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-videos', 'listing-videos', false, 52428800, array['video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;
