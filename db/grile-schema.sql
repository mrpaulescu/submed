-- ============================================================================
-- SubMed v2 — Schema „Grile pe capitole"
-- ============================================================================
-- Rulează în Supabase → SQL Editor. Adaugă: capitole, întrebări, încercări.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── Capitole (Biologie / Chimie → capitol) ──────────────────────
create table if not exists public.chapters (
  id         uuid primary key default gen_random_uuid(),
  subject    text not null check (subject in ('biologie','chimie')),
  name       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

-- ── Întrebări ───────────────────────────────────────────────────
create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  chapter_id  uuid not null references public.chapters(id) on delete cascade,
  text        text not null,
  options     jsonb not null,           -- [{"key":"a","text":"..."}, ...]
  correct     jsonb not null,           -- ["a","c"]  (1+ pentru complement multiplu)
  explanation text,
  multiple    boolean not null default false,
  difficulty  text check (difficulty in ('usor','mediu','greu')),
  source      text,                      -- ex. "Admitere Cluj 2024"
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists idx_questions_chapter on public.questions(chapter_id);

-- ── Încercări (răspunsurile userilor) ───────────────────────────
create table if not exists public.question_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected    jsonb not null,           -- ["a","c"]
  is_correct  boolean not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_attempts_user on public.question_attempts(user_id);
create index if not exists idx_attempts_question on public.question_attempts(question_id);

-- ============================================================================
-- ROW-LEVEL SECURITY
-- ============================================================================
alter table public.chapters          enable row level security;
alter table public.questions         enable row level security;
alter table public.question_attempts enable row level security;

-- capitole & întrebări: citite de oricine autentificat; scrise doar de admin
grant usage on schema public to anon;
revoke all privileges on table public.chapters, public.questions from anon;
grant select on table public.chapters, public.questions to anon;

drop policy if exists chapters_read on public.chapters;
create policy chapters_read on public.chapters for select to anon, authenticated using (true);
drop policy if exists chapters_write on public.chapters;
create policy chapters_write on public.chapters for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists questions_read on public.questions;
create policy questions_read on public.questions for select to anon, authenticated using (active is true);
drop policy if exists questions_write on public.questions;
create policy questions_write on public.questions for all using (public.is_admin()) with check (public.is_admin());

-- încercări: fiecare le vede/creează pe ale lui; adminul le vede pe toate
drop policy if exists attempts_select on public.question_attempts;
create policy attempts_select on public.question_attempts for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists attempts_insert on public.question_attempts;
create policy attempts_insert on public.question_attempts for insert
  with check (user_id = auth.uid());

-- ── (opțional) seed minimal pentru test ─────────────────────────
-- insert into public.chapters (subject, name, sort_order) values
--   ('biologie','Celula', 1), ('chimie','Hidrocarburi', 1);
