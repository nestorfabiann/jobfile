-- Message translation (English and Spanish). Run once in the Supabase SQL editor after 001-006.

alter table public.profiles add column if not exists language text not null default 'en' check (language in ('en', 'es'));
alter table public.profiles add column if not exists auto_translate boolean not null default true;

-- One cached translation per message and language, so each message is translated at most once per language.
create table if not exists public.message_translations (
  message_id uuid not null references public.messages(id) on delete cascade,
  lang text not null check (lang in ('en', 'es')),
  body text not null,
  same boolean not null default false,
  model text not null default '',
  requested_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (message_id, lang)
);
create index if not exists message_translations_user_day on public.message_translations (requested_by, created_at);

alter table public.message_translations enable row level security;
drop policy if exists "translations visible to members" on public.message_translations;
create policy "translations visible to members" on public.message_translations for select
  using (exists (select 1 from public.messages m where m.id = message_id and public.is_project_member(m.project_id)));
-- Writes come only from the server (service role), after it checks the person can see the message.

-- Security hardening: signed-in people may edit only their own settings columns.
-- This stops anyone from clearing their own suspension flag or changing the email on their profile.
-- The server (service role) is not affected.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, notify_email, notify_sms, sms_consent_at, language, auto_translate) on public.profiles to authenticated;
