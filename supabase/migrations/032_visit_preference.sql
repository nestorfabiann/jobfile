-- Visit preference on a marketplace post. Run once in the Supabase SQL editor.
alter table public.marketplace_listings
  add column if not exists visit_pref text not null default 'yes',
  add column if not exists visit_free text not null default '';
