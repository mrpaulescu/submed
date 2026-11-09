-- SubMed calendar backend
-- Idempotent migration for calendar.html.
-- Existing tables and owner-only RLS policies are preserved.

begin;

-- These fields are consumed by calendar.html.
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

-- The Coach.setHabit() API upserts by (user_id, habit_id, day).
-- Refuse to silently discard historical data if duplicates are present.
do $$
begin
  if exists (
    select 1
    from public.user_habits
    group by user_id, habit_id, day
    having count(*) > 1
  ) then
    raise exception
      'Duplicate user_habits rows exist for (user_id, habit_id, day). Resolve duplicates before applying this migration.';
  end if;
end
$$;

create unique index if not exists user_habits_user_habit_day_uidx
  on public.user_habits (user_id, habit_id, day);

-- Efficient calendar range reads and Coach exam lists.
create index if not exists user_day_events_user_day_start_idx
  on public.user_day_events (user_id, day, start_min);

create index if not exists user_exams_user_exam_date_idx
  on public.user_exams (user_id, exam_date);

create index if not exists user_habits_user_day_idx
  on public.user_habits (user_id, day);

-- RLS is enabled; existing owner-only policies from the current schema remain
-- responsible for authorizing SELECT/INSERT/UPDATE/DELETE.
alter table public.user_day_events enable row level security;
alter table public.user_exams enable row level security;
alter table public.user_habits enable row level security;

commit;
