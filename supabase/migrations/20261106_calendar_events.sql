-- Calendar personal Submed. Rulați în Supabase SQL Editor înainte de lansare.
-- Tabela user_day_events și politicile ei RLS existente sunt păstrate.

alter table public.user_day_events
  add column if not exists event_type text not null default 'personal',
  add column if not exists notes text;

update public.user_day_events
set event_type = 'personal'
where event_type is null or event_type = '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_day_events_event_type_check'
      and conrelid = 'public.user_day_events'::regclass
  ) then
    alter table public.user_day_events
      add constraint user_day_events_event_type_check
      check (event_type in ('study', 'personal', 'exam', 'appointment', 'work', 'other'));
  end if;
end $$;

create index if not exists user_day_events_user_day_start_idx
  on public.user_day_events (user_id, day, start_min);
