-- Scope lines can be tied to a schedule phase. A row can now exist before work starts (status not_started) to hold the phase.
alter table public.project_scope_status add column if not exists phase_id uuid references public.project_phases(id) on delete set null;
alter table public.project_scope_status drop constraint if exists project_scope_status_status_check;
alter table public.project_scope_status add constraint project_scope_status_status_check check (status in ('not_started', 'in_progress', 'done'));
