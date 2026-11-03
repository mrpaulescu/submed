-- ============================================================================
-- SubMed v2 — Schema bazei de date (Supabase / PostgreSQL)
-- ============================================================================
-- Rulează acest fișier în Supabase → SQL Editor.
-- Auth-ul (tabela auth.users) e gestionat de Supabase; noi adăugăm `profiles`
-- legat de el și restul entităților din roadmap.
--
-- Convenții:
--   • toate tabelele au id uuid (default gen_random_uuid) + created_at
--   • RLS (Row-Level Security) activ pe tot; politici la final
--   • cheile de răspuns se stochează ca jsonb {"1":["b"],"2":["a","c"], ...}
-- ============================================================================

-- extensii necesare
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. PROFILES  (1-la-1 cu auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  avatar_url  text,
  role        text not null default 'student' check (role in ('student','admin')),
  student_code text,                       -- codul de bule pentru identificare pe foaie
  created_at  timestamptz not null default now()
);

-- creează automat un profil când se înregistrează un user nou
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. FACULTIES  (universități / centre)
-- ---------------------------------------------------------------------------
create table if not exists public.faculties (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,                -- "UMF Cluj-Napoca"
  city       text,                         -- "Cluj-Napoca"
  slug       text unique not null,         -- "cluj"
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. EXAMS  (subiecte din anii anteriori)
-- ---------------------------------------------------------------------------
create table if not exists public.exams (
  id           uuid primary key default gen_random_uuid(),
  faculty_id   uuid references public.faculties(id) on delete set null,
  name         text not null,              -- "Simulare Mai 2024"
  year         int,
  session      text,                       -- "mai" / "septembrie" / "presimulare"
  exam_date    date,
  sheet_type   text not null default 'submed' check (sheet_type in ('submed','cluj','iasi')),
  num_questions int not null default 150,
  subject_pdf_url text,                    -- link PDF subiect (Storage sau extern)
  is_premium   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists idx_exams_faculty on public.exams(faculty_id);

-- ---------------------------------------------------------------------------
-- 4. ANSWER_KEYS  (baremul oficial; un examen poate avea variante)
-- ---------------------------------------------------------------------------
create table if not exists public.answer_keys (
  id          uuid primary key default gen_random_uuid(),
  exam_id     uuid not null references public.exams(id) on delete cascade,
  variant     text not null default '1',   -- "1", "2" pentru subiecte cu variante
  key         jsonb not null,              -- {"1":["b"],"2":["a","c"], ...}
  verified    boolean not null default false,  -- a fost revizuit manual după OCR?
  created_at  timestamptz not null default now(),
  unique (exam_id, variant)
);

-- ---------------------------------------------------------------------------
-- 5. SUBMISSIONS  (rezultatele scanate ale userilor)
-- ---------------------------------------------------------------------------
create table if not exists public.submissions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  exam_id       uuid references public.exams(id) on delete set null,
  answer_key_id uuid references public.answer_keys(id) on delete set null,
  score         int  not null default 0,   -- răspunsuri corecte
  total         int  not null default 0,   -- întrebări notate
  percentage    numeric(5,2) not null default 0,
  answers       jsonb,                      -- [{q,student,correct,status}, ...]
  raw_matrix    jsonb,                      -- matricea 150×5 brută (audit/re-evaluare)
  sheet_image_url     text,                 -- imaginea originală (Storage)
  annotated_image_url text,                 -- imaginea adnotată (Storage)
  created_at    timestamptz not null default now()
);
create index if not exists idx_submissions_user on public.submissions(user_id);
create index if not exists idx_submissions_exam on public.submissions(exam_id);

-- ---------------------------------------------------------------------------
-- 6. LEARNING CATALOG  (chapters, question bank, exam topic map)
-- ---------------------------------------------------------------------------
create table if not exists public.chapters (
  id         uuid primary key default gen_random_uuid(),
  subject    text not null check (subject in ('biologie','chimie')),
  name       text not null check (length(btrim(name)) > 0),
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject, name)
);

create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  source_key  text unique,
  chapter_id  uuid not null references public.chapters(id) on delete cascade,
  text        text not null check (length(btrim(text)) > 0),
  options     jsonb not null check (
                jsonb_typeof(options) = 'array'
                and jsonb_array_length(options) between 2 and 5
              ),
  correct     jsonb not null check (
                jsonb_typeof(correct) = 'array'
                and jsonb_array_length(correct) >= 1
              ),
  explanation text,
  multiple    boolean not null default false,
  difficulty  text check (difficulty in ('usor','mediu','greu')),
  source      text,
  tags        text[] not null default '{}',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_questions_chapter on public.questions(chapter_id);
create index if not exists idx_questions_chapter_active on public.questions(chapter_id, active);
create index if not exists idx_questions_tags on public.questions using gin(tags);

create table if not exists public.question_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected    jsonb not null check (jsonb_typeof(selected) = 'array'),
  is_correct  boolean not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_attempts_user on public.question_attempts(user_id);
create index if not exists idx_attempts_question on public.question_attempts(question_id);
create index if not exists idx_attempts_user_question_created on public.question_attempts(user_id, question_id, created_at desc);

-- Repetarea greșelilor folosește o programare separată de istoricul imuabil al răspunsurilor.
create table if not exists public.question_review_schedule (
  user_id          uuid not null references auth.users(id) on delete cascade,
  question_id      uuid not null references public.questions(id) on delete cascade,
  repetition_count int not null default 0 check (repetition_count >= 0),
  interval_days    int not null default 1 check (interval_days >= 1),
  ease             numeric(4,2) not null default 2.50 check (ease >= 1.30),
  next_review_at   timestamptz not null default now(),
  last_reviewed_at timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (user_id, question_id)
);
create index if not exists idx_question_review_schedule_due
  on public.question_review_schedule(user_id, next_review_at);

-- Maps scanned exam question numbers to the learning taxonomy.
-- This lets wrong scanned answers say "chimie / hidrocarburi".
create table if not exists public.exam_questions (
  id                 uuid primary key default gen_random_uuid(),
  exam_id            uuid not null references public.exams(id) on delete cascade,
  question_no        int not null check (question_no between 1 and 300),
  subject            text not null check (subject in ('biologie','chimie')),
  chapter_id         uuid references public.chapters(id) on delete set null,
  source_question_id uuid references public.questions(id) on delete set null,
  explanation        text,
  tags               text[] not null default '{}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (exam_id, question_no)
);
create index if not exists idx_exam_questions_exam_no on public.exam_questions(exam_id, question_no);
create index if not exists idx_exam_questions_chapter on public.exam_questions(chapter_id);
create index if not exists idx_exam_questions_exam_chapter on public.exam_questions(exam_id, chapter_id);

-- ---------------------------------------------------------------------------
-- 7. FLASHCARDS + CHEMICAL STRUCTURES
-- ---------------------------------------------------------------------------
create table if not exists public.chemical_structures (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null check (length(btrim(name)) > 0),
  iupac_name  text,
  smiles      text not null check (length(btrim(smiles)) > 0),
  formula     text,
  molfile     text,
  aliases     text[] not null default '{}',
  functional_groups text[] not null default '{}',
  subject     text not null default 'chimie' check (subject in ('biologie','chimie')),
  chapter_id  uuid references public.chapters(id) on delete set null,
  metadata    jsonb not null default '{}'::jsonb,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_chemical_structures_chapter on public.chemical_structures(chapter_id);
create index if not exists idx_chemical_structures_name on public.chemical_structures(name);
create index if not exists idx_chemical_structures_aliases on public.chemical_structures using gin(aliases);
create index if not exists idx_chemical_structures_groups on public.chemical_structures using gin(functional_groups);

create table if not exists public.flashcard_decks (
  id          uuid primary key default gen_random_uuid(),
  subject     text not null check (subject in ('biologie','chimie')),
  chapter_id  uuid references public.chapters(id) on delete set null,
  slug        text unique check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title       text not null check (length(btrim(title)) > 0),
  description text,
  source      text,
  sort_order  int not null default 0,
  is_premium  boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_flashcard_decks_subject on public.flashcard_decks(subject, sort_order);
create index if not exists idx_flashcard_decks_chapter on public.flashcard_decks(chapter_id);
create index if not exists idx_flashcard_decks_active on public.flashcard_decks(subject, active, sort_order);

create table if not exists public.flashcards (
  id                    uuid primary key default gen_random_uuid(),
  source_key            text unique,
  deck_id               uuid not null references public.flashcard_decks(id) on delete cascade,
  chapter_id            uuid references public.chapters(id) on delete set null,
  chemical_structure_id uuid references public.chemical_structures(id) on delete set null,
  front                 text not null check (length(btrim(front)) > 0),
  back                  text not null check (length(btrim(back)) > 0),
  card_type             text not null default 'basic'
                        check (card_type in ('basic','cloze','chemical_structure')),
  tags                  text[] not null default '{}',
  difficulty            text check (difficulty in ('usor','mediu','greu')),
  source                text,
  active                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_flashcards_deck on public.flashcards(deck_id);
create index if not exists idx_flashcards_chapter on public.flashcards(chapter_id);
create index if not exists idx_flashcards_structure on public.flashcards(chemical_structure_id);
create index if not exists idx_flashcards_deck_active on public.flashcards(deck_id, active);
create index if not exists idx_flashcards_tags on public.flashcards using gin(tags);

create table if not exists public.flashcard_reviews (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  flashcard_id   uuid not null references public.flashcards(id) on delete cascade,
  rating         text not null check (rating in ('again','hard','good','easy')),
  is_known       boolean not null default false,
  interval_days  int not null default 0,
  ease           numeric(4,2) not null default 2.50,
  reviewed_at    timestamptz not null default now(),
  next_review_at timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_flashcard_reviews_user on public.flashcard_reviews(user_id);
create index if not exists idx_flashcard_reviews_card on public.flashcard_reviews(flashcard_id);
create index if not exists idx_flashcard_reviews_user_card_reviewed on public.flashcard_reviews(user_id, flashcard_id, reviewed_at desc);
create index if not exists idx_flashcard_reviews_due on public.flashcard_reviews(user_id, next_review_at);

create table if not exists public.flashcard_chemical_structures (
  flashcard_id          uuid not null references public.flashcards(id) on delete cascade,
  chemical_structure_id uuid not null references public.chemical_structures(id) on delete cascade,
  role                  text,
  primary key (flashcard_id, chemical_structure_id)
);

-- ---------------------------------------------------------------------------
-- 6. SUBSCRIPTIONS  (free/premium — pregătit pentru monetizare)
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  tier       text not null default 'free' check (tier in ('free','premium')),
  status     text not null default 'active' check (status in ('active','expired','cancelled')),
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_subscriptions_user on public.subscriptions(user_id);

-- ---------------------------------------------------------------------------
-- 7. PAYMENTS  (schema gata; implementare după V1.0)
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider        text,                    -- "netopia" / "stripe"
  amount          numeric(10,2),
  currency        text default 'RON',
  status          text default 'pending' check (status in ('pending','paid','failed','refunded')),
  provider_ref    text,                    -- id tranzacție de la procesator
  created_at      timestamptz not null default now()
);
create index if not exists idx_payments_user on public.payments(user_id);

-- ---------------------------------------------------------------------------
-- 8. VIEW: weak_questions  (agregare întrebări slabe per examen)
-- ---------------------------------------------------------------------------
drop view if exists public.flashcard_deck_progress;
drop view if exists public.flashcard_latest_reviews;
drop view if exists public.submission_chapter_results;
drop view if exists public.wrong_answers;
drop view if exists public.weak_chapters;
drop view if exists public.weak_questions;
drop view if exists public.scored_answers;

create or replace view public.flashcard_latest_reviews
with (security_invoker=on) as
select distinct on (fr.user_id, fr.flashcard_id)
  fr.user_id,
  fr.flashcard_id,
  fr.rating,
  fr.is_known,
  fr.interval_days,
  fr.ease,
  fr.reviewed_at,
  fr.next_review_at
from public.flashcard_reviews fr
order by fr.user_id, fr.flashcard_id, fr.reviewed_at desc;

create or replace view public.flashcard_deck_progress
with (security_invoker=on) as
select
  lr.user_id,
  fc.deck_id,
  fd.subject,
  fd.chapter_id,
  (count(*))::int as reviewed_count,
  (count(*) filter (where lr.is_known))::int as known_count,
  (count(*) filter (where lr.next_review_at is null or lr.next_review_at <= now()))::int as due_reviewed_count,
  max(lr.reviewed_at) as last_reviewed_at
from public.flashcard_latest_reviews lr
join public.flashcards fc on fc.id = lr.flashcard_id
join public.flashcard_decks fd on fd.id = fc.deck_id
group by lr.user_id, fc.deck_id, fd.subject, fd.chapter_id;

create or replace view public.scored_answers
with (security_invoker=on) as
select
  s.id as submission_id,
  s.user_id,
  s.exam_id,
  s.answer_key_id,
  (a->>'q')::int as question_no,
  a->>'status' as status,
  coalesce(a->'student', '[]'::jsonb) as student,
  coalesce(a->'correct', '[]'::jsonb) as correct,
  coalesce(nullif(a->>'subject',''), eq.subject) as subject,
  coalesce(nullif(a->>'chapter_id','')::uuid, eq.chapter_id) as chapter_id,
  ch.name as chapter_name,
  coalesce(nullif(a->>'explanation',''), eq.explanation) as explanation,
  s.created_at
from public.submissions s
cross join lateral jsonb_array_elements(coalesce(s.answers, '[]'::jsonb)) a
left join public.exam_questions eq
  on eq.exam_id = s.exam_id and eq.question_no = (a->>'q')::int
left join public.chapters ch
  on ch.id = coalesce(nullif(a->>'chapter_id','')::uuid, eq.chapter_id);

create or replace view public.wrong_answers
with (security_invoker=on) as
select *
from public.scored_answers
where status = 'wrong';

create or replace view public.weak_questions
with (security_invoker=on) as
select
  user_id,
  exam_id,
  question_no,
  subject,
  chapter_id,
  chapter_name,
  count(*) as attempts,
  sum(case when status = 'correct' then 1 else 0 end) as correct,
  sum(case when status = 'wrong' then 1 else 0 end) as wrong,
  round(100.0 * sum(case when status = 'correct' then 1 else 0 end)
        / nullif(count(*),0), 1) as success_rate
from public.scored_answers
where status in ('correct','wrong')
group by user_id, exam_id, question_no, subject, chapter_id, chapter_name;

create or replace view public.weak_chapters
with (security_invoker=on) as
select
  user_id,
  exam_id,
  subject,
  chapter_id,
  chapter_name,
  sum(attempts) as attempts,
  sum(correct) as correct,
  sum(wrong) as wrong,
  round(100.0 * sum(correct) / nullif(sum(attempts),0), 1) as success_rate
from public.weak_questions
where subject is not null or chapter_id is not null
group by user_id, exam_id, subject, chapter_id, chapter_name;

create or replace view public.submission_chapter_results
with (security_invoker=on) as
select
  submission_id,
  user_id,
  exam_id,
  subject,
  chapter_id,
  chapter_name,
  count(*) as attempts,
  sum(case when status = 'correct' then 1 else 0 end) as correct,
  sum(case when status = 'wrong' then 1 else 0 end) as wrong,
  round(100.0 * sum(case when status = 'correct' then 1 else 0 end)
        / nullif(count(*),0), 1) as success_rate
from public.scored_answers
where status in ('correct','wrong') and (subject is not null or chapter_id is not null)
group by submission_id, user_id, exam_id, subject, chapter_id, chapter_name;

-- ============================================================================
-- ROW-LEVEL SECURITY
-- ============================================================================
alter table public.profiles      enable row level security;
alter table public.faculties     enable row level security;
alter table public.exams         enable row level security;
alter table public.answer_keys   enable row level security;
alter table public.submissions   enable row level security;
alter table public.chapters      enable row level security;
alter table public.questions     enable row level security;
alter table public.question_attempts enable row level security;
alter table public.question_review_schedule enable row level security;
alter table public.exam_questions enable row level security;
alter table public.chemical_structures enable row level security;
alter table public.flashcard_decks enable row level security;
alter table public.flashcards enable row level security;
alter table public.flashcard_reviews enable row level security;
alter table public.flashcard_chemical_structures enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments      enable row level security;

-- helper: e admin?
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- profiles: fiecare își vede/editează propriul profil; adminul le vede pe toate
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_question_review_schedule_updated_at on public.question_review_schedule;
create trigger set_question_review_schedule_updated_at
  before update on public.question_review_schedule
  for each row execute function public.set_updated_at();

drop trigger if exists set_chapters_updated_at on public.chapters;
create trigger set_chapters_updated_at
  before update on public.chapters
  for each row execute function public.set_updated_at();

drop trigger if exists set_questions_updated_at on public.questions;
create trigger set_questions_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

drop trigger if exists set_exam_questions_updated_at on public.exam_questions;
create trigger set_exam_questions_updated_at
  before update on public.exam_questions
  for each row execute function public.set_updated_at();

drop trigger if exists set_chemical_structures_updated_at on public.chemical_structures;
create trigger set_chemical_structures_updated_at
  before update on public.chemical_structures
  for each row execute function public.set_updated_at();

drop trigger if exists set_flashcard_decks_updated_at on public.flashcard_decks;
create trigger set_flashcard_decks_updated_at
  before update on public.flashcard_decks
  for each row execute function public.set_updated_at();

drop trigger if exists set_flashcards_updated_at on public.flashcards;
create trigger set_flashcards_updated_at
  before update on public.flashcards
  for each row execute function public.set_updated_at();

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid());

-- faculties & exams: lizibile de oricine autentificat; scrise doar de admin
drop policy if exists faculties_read on public.faculties;
create policy faculties_read on public.faculties for select using (auth.role() = 'authenticated');
drop policy if exists faculties_write on public.faculties;
create policy faculties_write on public.faculties for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists exams_read on public.exams;
create policy exams_read on public.exams for select using (auth.role() = 'authenticated');
drop policy if exists exams_write on public.exams;
create policy exams_write on public.exams for all using (public.is_admin()) with check (public.is_admin());

-- answer_keys: NU se expun userilor (ar vedea răspunsurile)! doar adminul direct.
-- Validarea folosește cheia server-side (Render) sau printr-o funcție SECURITY DEFINER.
drop policy if exists keys_admin on public.answer_keys;
create policy keys_admin on public.answer_keys for all using (public.is_admin()) with check (public.is_admin());

-- submissions: fiecare își vede/creează propriile rezultate; adminul le vede pe toate
drop policy if exists subs_select on public.submissions;
create policy subs_select on public.submissions for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists subs_insert on public.submissions;
create policy subs_insert on public.submissions for insert
  with check (user_id = auth.uid());

-- learning taxonomy and question bank
drop policy if exists chapters_read on public.chapters;
grant usage on schema public to anon;
revoke all privileges on table public.chapters, public.questions from anon;
grant select on table public.chapters, public.questions to anon;
create policy chapters_read on public.chapters for select to anon, authenticated using (true);
drop policy if exists chapters_write on public.chapters;
create policy chapters_write on public.chapters for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists questions_read on public.questions;
create policy questions_read on public.questions for select to anon, authenticated using (active is true);
drop policy if exists questions_write on public.questions;
create policy questions_write on public.questions for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists attempts_select on public.question_attempts;
create policy attempts_select on public.question_attempts for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists attempts_insert on public.question_attempts;
create policy attempts_insert on public.question_attempts for insert
  with check (user_id = auth.uid());

drop policy if exists question_review_schedule_all on public.question_review_schedule;
create policy question_review_schedule_all on public.question_review_schedule for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists exam_questions_read on public.exam_questions;
create policy exam_questions_read on public.exam_questions for select using (auth.role() = 'authenticated');
drop policy if exists exam_questions_write on public.exam_questions;
create policy exam_questions_write on public.exam_questions for all using (public.is_admin()) with check (public.is_admin());

-- flashcards and chemical structures
drop policy if exists chemical_structures_read on public.chemical_structures;
create policy chemical_structures_read on public.chemical_structures for select using (auth.role() = 'authenticated');
drop policy if exists chemical_structures_write on public.chemical_structures;
create policy chemical_structures_write on public.chemical_structures for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists flashcard_decks_read on public.flashcard_decks;
create policy flashcard_decks_read on public.flashcard_decks for select using (auth.role() = 'authenticated');
drop policy if exists flashcard_decks_write on public.flashcard_decks;
create policy flashcard_decks_write on public.flashcard_decks for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists flashcards_read on public.flashcards;
create policy flashcards_read on public.flashcards for select using (auth.role() = 'authenticated');
drop policy if exists flashcards_write on public.flashcards;
create policy flashcards_write on public.flashcards for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists flashcard_reviews_select on public.flashcard_reviews;
create policy flashcard_reviews_select on public.flashcard_reviews for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists flashcard_reviews_insert on public.flashcard_reviews;
create policy flashcard_reviews_insert on public.flashcard_reviews for insert
  with check (user_id = auth.uid());
drop policy if exists flashcard_reviews_update on public.flashcard_reviews;
create policy flashcard_reviews_update on public.flashcard_reviews for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists flashcard_chemical_structures_read on public.flashcard_chemical_structures;
create policy flashcard_chemical_structures_read on public.flashcard_chemical_structures
  for select using (auth.role() = 'authenticated');
drop policy if exists flashcard_chemical_structures_write on public.flashcard_chemical_structures;
create policy flashcard_chemical_structures_write on public.flashcard_chemical_structures
  for all using (public.is_admin()) with check (public.is_admin());

-- subscriptions & payments: fiecare le vede pe ale lui
drop policy if exists subscr_select on public.subscriptions;
create policy subscr_select on public.subscriptions for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists pay_select on public.payments;
create policy pay_select on public.payments for select
  using (user_id = auth.uid() or public.is_admin());

-- ============================================================================
-- STORAGE (rulează după ce creezi bucket-ul "sheets" în Supabase → Storage)
-- ============================================================================
-- Bucket: "sheets" (privat). Userii încarcă în folderul propriu {user_id}/...
-- insert into storage.buckets (id, name, public) values ('sheets','sheets', false);
--
-- create policy "own sheets upload" on storage.objects for insert
--   with check (bucket_id = 'sheets' and (storage.foldername(name))[1] = auth.uid()::text);
-- create policy "own sheets read"   on storage.objects for select
--   using (bucket_id = 'sheets' and (storage.foldername(name))[1] = auth.uid()::text);
