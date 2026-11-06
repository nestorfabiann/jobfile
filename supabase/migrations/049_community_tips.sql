-- Community Tips: lets community_posts hold a third kind, 'tip'. Run once in the Supabase SQL editor.
alter table public.community_posts drop constraint if exists community_posts_kind_check;
alter table public.community_posts add constraint community_posts_kind_check check (kind in ('showcase', 'idea', 'tip'));
