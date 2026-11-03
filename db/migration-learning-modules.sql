-- ============================================================================
-- SubMed v2 - Learning modules migration
-- Adds:
--   - chapters/question bank if they do not already exist
--   - exam question -> subject/chapter mapping for scanned wrong answers
--   - flashcard decks/cards/reviews
--   - chemical structures for chemistry flashcards
-- ============================================================================

create extension if not exists "pgcrypto";

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- Question bank and topic map
-- ---------------------------------------------------------------------------
create table if not exists public.chapters (
  id         uuid primary key default gen_random_uuid(),
  subject    text not null check (subject in ('biologie','chimie')),
  name       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_chapters_subject_name on public.chapters(subject, name);
alter table public.chapters add column if not exists updated_at timestamptz not null default now();

create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  chapter_id  uuid not null references public.chapters(id) on delete cascade,
  text        text not null,
  options     jsonb not null,
  correct     jsonb not null,
  explanation text,
  multiple    boolean not null default false,
  difficulty  text check (difficulty in ('usor','mediu','greu')),
  source      text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.questions add column if not exists source_key text;
alter table public.questions add column if not exists tags text[] not null default '{}';
alter table public.questions add column if not exists updated_at timestamptz not null default now();
create index if not exists idx_questions_chapter on public.questions(chapter_id);
create unique index if not exists idx_questions_source_key on public.questions(source_key);
create index if not exists idx_questions_chapter_active on public.questions(chapter_id, active);
create index if not exists idx_questions_tags on public.questions using gin(tags);

create table if not exists public.question_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected    jsonb not null,
  is_correct  boolean not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_attempts_user on public.question_attempts(user_id);
create index if not exists idx_attempts_question on public.question_attempts(question_id);
create index if not exists idx_attempts_user_question_created on public.question_attempts(user_id, question_id, created_at desc);

create table if not exists public.exam_questions (
  id                 uuid primary key default gen_random_uuid(),
  exam_id            uuid not null references public.exams(id) on delete cascade,
  question_no        int not null check (question_no > 0),
  subject            text not null check (subject in ('biologie','chimie')),
  chapter_id         uuid references public.chapters(id) on delete set null,
  source_question_id uuid references public.questions(id) on delete set null,
  explanation        text,
  tags               text[] not null default '{}',
  created_at         timestamptz not null default now()
);
create unique index if not exists idx_exam_questions_exam_no_unique on public.exam_questions(exam_id, question_no);
create index if not exists idx_exam_questions_exam_no on public.exam_questions(exam_id, question_no);
create index if not exists idx_exam_questions_chapter on public.exam_questions(chapter_id);
create index if not exists idx_exam_questions_exam_chapter on public.exam_questions(exam_id, chapter_id);
alter table public.exam_questions add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- Flashcards and chemistry structures
-- ---------------------------------------------------------------------------
create table if not exists public.chemical_structures (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  iupac_name  text,
  smiles      text not null,
  formula     text,
  molfile     text,
  aliases     text[] not null default '{}',
  functional_groups text[] not null default '{}',
  subject     text not null default 'chimie' check (subject in ('biologie','chimie')),
  chapter_id  uuid references public.chapters(id) on delete set null,
  metadata    jsonb not null default '{}'::jsonb,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists idx_chemical_structures_chapter on public.chemical_structures(chapter_id);
create index if not exists idx_chemical_structures_name on public.chemical_structures(name);
create index if not exists idx_chemical_structures_aliases on public.chemical_structures using gin(aliases);
create index if not exists idx_chemical_structures_groups on public.chemical_structures using gin(functional_groups);
alter table public.chemical_structures add column if not exists updated_at timestamptz not null default now();

create table if not exists public.flashcard_decks (
  id          uuid primary key default gen_random_uuid(),
  subject     text not null check (subject in ('biologie','chimie')),
  chapter_id  uuid references public.chapters(id) on delete set null,
  title       text not null,
  description text,
  source      text,
  sort_order  int not null default 0,
  is_premium  boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.flashcard_decks add column if not exists slug text;
alter table public.flashcard_decks add column if not exists updated_at timestamptz not null default now();
create unique index if not exists idx_flashcard_decks_slug on public.flashcard_decks(slug);
create index if not exists idx_flashcard_decks_subject on public.flashcard_decks(subject, sort_order);
create index if not exists idx_flashcard_decks_chapter on public.flashcard_decks(chapter_id);
create index if not exists idx_flashcard_decks_active on public.flashcard_decks(subject, active, sort_order);

create table if not exists public.flashcards (
  id                    uuid primary key default gen_random_uuid(),
  deck_id               uuid references public.flashcard_decks(id) on delete cascade,
  chapter_id            uuid references public.chapters(id) on delete set null,
  chemical_structure_id uuid references public.chemical_structures(id) on delete set null,
  front                 text not null,
  back                  text not null,
  card_type             text not null default 'basic'
                        check (card_type in ('basic','cloze','chemical_structure')),
  tags                  text[] not null default '{}',
  difficulty            text check (difficulty in ('usor','mediu','greu')),
  source                text,
  active                boolean not null default true,
  created_at            timestamptz not null default now()
);
alter table public.flashcards add column if not exists source_key text;
alter table public.flashcards add column if not exists updated_at timestamptz not null default now();
create unique index if not exists idx_flashcards_source_key on public.flashcards(source_key);
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

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chapters_name_not_blank' and conrelid = 'public.chapters'::regclass) then
    alter table public.chapters
      add constraint chapters_name_not_blank check (length(btrim(name)) > 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'questions_text_not_blank' and conrelid = 'public.questions'::regclass) then
    alter table public.questions
      add constraint questions_text_not_blank check (length(btrim(text)) > 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'questions_options_array' and conrelid = 'public.questions'::regclass) then
    alter table public.questions
      add constraint questions_options_array check (
        jsonb_typeof(options) = 'array'
        and jsonb_array_length(options) between 2 and 5
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'questions_correct_array' and conrelid = 'public.questions'::regclass) then
    alter table public.questions
      add constraint questions_correct_array check (
        jsonb_typeof(correct) = 'array'
        and jsonb_array_length(correct) >= 1
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'attempts_selected_array' and conrelid = 'public.question_attempts'::regclass) then
    alter table public.question_attempts
      add constraint attempts_selected_array check (jsonb_typeof(selected) = 'array') not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'exam_questions_question_no_range' and conrelid = 'public.exam_questions'::regclass) then
    alter table public.exam_questions
      add constraint exam_questions_question_no_range check (question_no between 1 and 300) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'chemical_structures_slug_format' and conrelid = 'public.chemical_structures'::regclass) then
    alter table public.chemical_structures
      add constraint chemical_structures_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$') not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'chemical_structures_name_not_blank' and conrelid = 'public.chemical_structures'::regclass) then
    alter table public.chemical_structures
      add constraint chemical_structures_name_not_blank check (length(btrim(name)) > 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'chemical_structures_smiles_not_blank' and conrelid = 'public.chemical_structures'::regclass) then
    alter table public.chemical_structures
      add constraint chemical_structures_smiles_not_blank check (length(btrim(smiles)) > 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'flashcard_decks_slug_format' and conrelid = 'public.flashcard_decks'::regclass) then
    alter table public.flashcard_decks
      add constraint flashcard_decks_slug_format check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$') not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'flashcard_decks_title_not_blank' and conrelid = 'public.flashcard_decks'::regclass) then
    alter table public.flashcard_decks
      add constraint flashcard_decks_title_not_blank check (length(btrim(title)) > 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'flashcards_deck_required' and conrelid = 'public.flashcards'::regclass) then
    alter table public.flashcards
      add constraint flashcards_deck_required check (deck_id is not null) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'flashcards_front_not_blank' and conrelid = 'public.flashcards'::regclass) then
    alter table public.flashcards
      add constraint flashcards_front_not_blank check (length(btrim(front)) > 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'flashcards_back_not_blank' and conrelid = 'public.flashcards'::regclass) then
    alter table public.flashcards
      add constraint flashcards_back_not_blank check (length(btrim(back)) > 0) not valid;
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

-- ---------------------------------------------------------------------------
-- Analytics views
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

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.chapters enable row level security;
alter table public.questions enable row level security;
alter table public.question_attempts enable row level security;
alter table public.exam_questions enable row level security;
alter table public.chemical_structures enable row level security;
alter table public.flashcard_decks enable row level security;
alter table public.flashcards enable row level security;
alter table public.flashcard_reviews enable row level security;
alter table public.flashcard_chemical_structures enable row level security;

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

drop policy if exists attempts_select on public.question_attempts;
create policy attempts_select on public.question_attempts for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists attempts_insert on public.question_attempts;
create policy attempts_insert on public.question_attempts for insert
  with check (user_id = auth.uid());

drop policy if exists exam_questions_read on public.exam_questions;
create policy exam_questions_read on public.exam_questions for select using (auth.role() = 'authenticated');
drop policy if exists exam_questions_write on public.exam_questions;
create policy exam_questions_write on public.exam_questions for all using (public.is_admin()) with check (public.is_admin());

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
