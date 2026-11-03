-- ============================================================================
-- SubMed — Migrare: preferințe utilizator + simulările din coach
-- ============================================================================
-- Rulează în Supabase → SQL Editor, DUPĂ schema.sql.
-- Adaugă: coloane de preferințe pe `profiles`, tabela `user_exams` (coach),
-- politici RLS și trigger de updated_at.
-- Idempotentă — se poate rula de mai multe ori.
-- ============================================================================

-- ── 1. Preferințe pe profilul utilizatorului ────────────────────
alter table public.profiles
  add column if not exists center         text,                         -- 'cluj' | 'iasi' | 'mures'
  add column if not exists subjects        text[]  not null default '{}', -- {'biologie','chimie'}
  add column if not exists preferred_tool  text,                         -- 'grile' | 'flashcards' | 'subiecte'
  add column if not exists goal            text,                         -- 'admis' | 'top' | 'max'
  add column if not exists target_score    int,                          -- ex. 42 (din 45)
  add column if not exists settings        jsonb   not null default '{}'::jsonb, -- catch-all (obiceiuri, misc)
  add column if not exists updated_at      timestamptz not null default now();

-- trigger updated_at (funcția set_updated_at există deja în schema.sql)
drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- (politicile profiles_select / profiles_update există deja în schema.sql)

-- ── 2. Simulările & examenele utilizatorului (coach) ────────────
create table if not exists public.user_exams (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  exam_date  date not null,
  type       text not null default 'sim' check (type in ('sim','exam')),
  center     text,
  created_at timestamptz not null default now()
);
create index if not exists idx_user_exams_user on public.user_exams(user_id, exam_date);

alter table public.user_exams enable row level security;

-- fiecare își gestionează propriile intrări
drop policy if exists user_exams_all on public.user_exams;
create policy user_exams_all on public.user_exams for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── 3. Obiceiurile zilnice (coach → „Urmărește-ți obiceiurile”) ──
-- Un rând per user × obicei × zi; `note` = „cum a mers azi”.
create table if not exists public.user_habits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  habit_id   text not null,          -- 'studiu' | 'miscare' | 'somn' | 'apa'
  day        date not null,
  done       boolean not null default false,
  note       text,
  created_at timestamptz not null default now(),
  unique (user_id, habit_id, day)
);
create index if not exists idx_user_habits_user_day on public.user_habits(user_id, day);

alter table public.user_habits enable row level security;

drop policy if exists user_habits_all on public.user_habits;
create policy user_habits_all on public.user_habits for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── 4. Evenimentele personale din programul zilei (coach → calendar)
-- Activitățile adăugate de user; planul de studiu se reașază în jurul lor.
create table if not exists public.user_day_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  day          date not null,
  name         text not null,
  start_min    int  not null check (start_min between 0 and 1439),   -- minute din zi
  duration_min int  not null check (duration_min between 5 and 720),
  created_at   timestamptz not null default now()
);
create index if not exists idx_user_day_events_user_day on public.user_day_events(user_id, day);

alter table public.user_day_events enable row level security;

drop policy if exists user_day_events_all on public.user_day_events;
create policy user_day_events_all on public.user_day_events for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================================
-- Gata. Preferințele se citesc/scriu din `profiles`, simulările din `user_exams`,
-- obiceiurile din `user_habits`, evenimentele zilei din `user_day_events`.
-- ============================================================================
