-- A homeowner's AI design idea on a listing: the AI picture, and optionally the original photo as the "before".
-- Run once in the Supabase SQL editor after 051.
alter table public.marketplace_listings add column if not exists idea_path text;
alter table public.marketplace_listings add column if not exists idea_label text;
alter table public.marketplace_listings add column if not exists before_path text;
