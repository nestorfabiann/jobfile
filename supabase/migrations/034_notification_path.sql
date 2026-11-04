-- Lets an alert remember the exact page it should open (for example a post before any bid).
alter table public.notifications add column if not exists path text;
