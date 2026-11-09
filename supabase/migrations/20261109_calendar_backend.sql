-- SubMed calendar backend hardening
-- Idempotent migration. Preserves existing tables and RLS policies.

begin;

-- Calendar event metadata already consumed by assets/js/api.js and calendar.html.
alter table public.user_day_events
  add column if not exists event_type text not null default 'personal',
  add column if not exists notes text;

update public.user_day_events
set event_type = 'personal'
where event_type is null or btrim(event_type) = '';

alter table public.user_day_events
  alter column event_type set default 'personal',
  alter column event_type set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_day_events_event_type_check'
      and conrelid = 'public.user_day_events'::regclass
  ) then
    alter table public.user_day_events
      add constraint user_day_events_event_type_check
      check (event_type in ('study', 'personal', 'exam', 'appointment', 'work', 'other'));
  end if;
end
$$;

-- Existing Coach methods use this composite conflict target for habit upserts.
create unique index if not exists user_habits_user_habit_day_uidx
  on public.user_habits (user_id, habit_id, day);

-- Calendar range reads: user-scoped and ordered by day/time.
create index if not exists user_day_events_user_day_start_idx
  on public.user_day_events (user_id, day, start_min);

-- Coach exam list is ordered by exam_date for the current user.
create index if not exists user_exams_user_exam_date_idx
  on public.user_exams (user_id, exam_date);

-- Keep RLS enabled; do not replace permissive owner policies already present.
alter table public.user_day_events enable row level security;
alter table public.user_exams enable row level security;
alter table public.user_habits enable row level security;

commit;

-- Expected owner policies (already present in the supplied schema):
-- user_day_events: authenticated ALL, user_id = auth.uid(), is_approved_user()
-- user_exams:      authenticated ALL, user_id = auth.uid(), is_approved_user()
-- user_habits:     authenticated ALL, user_id = auth.uid(), is_approved_user()
-- This migration intentionally does not broaden or replace those policies.
