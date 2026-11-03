-- ============================================================================
-- SubMed — migrare securitate + integritate + abonamente
-- Rulează în Supabase → SQL Editor, pe bucăți (secțiunile 1–8), într-un proiect
-- de test întâi. Fă backup înainte. Constrângerile sunt NOT VALID: nu pică pe
-- datele vechi, dar se aplică pe tot ce se scrie de acum. Validarea e la final.
-- ============================================================================

-- ── 1. profiles: utilizatorul nu își mai poate schimba rolul/accesul/codul ───
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- auth.uid() e null pentru service_role / SQL editor / Edge Functions → permis
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if  new.id            is distinct from old.id
   or new.role          is distinct from old.role
   or new.access_status is distinct from old.access_status
   or new.student_code  is distinct from old.student_code
   or new.approved_at   is distinct from old.approved_at
   or new.approved_by   is distinct from old.approved_by
   or new.created_at    is distinct from old.created_at
  then
    raise exception 'Coloane protejate: nu poți modifica rolul, accesul sau codul de concurs'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_profiles_protect on public.profiles;
create trigger trg_profiles_protect
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- policy-uri profiles cu (select auth.uid()) → evaluat o dată pe query, nu pe rând
alter policy profiles_select on public.profiles
  using ((id = (select auth.uid())) or (select public.is_admin()));
alter policy profiles_update on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- funcțiile de rol: search_path fix (previne hijack prin scheme)
alter function public.is_admin()         set search_path = public, pg_temp;
alter function public.is_approved_user() set search_path = public, pg_temp;


-- ── 2. RLS: răspunsurile nu mai sunt publice + roluri corecte ───────────────
-- ATENȚIE: dacă o pagină publică (landing/demo) citește întrebări fără login,
-- va înceta să funcționeze. Altfel, e scurgerea principală de conținut.
drop policy if exists questions_read on public.questions;
create policy questions_read on public.questions
  for select to authenticated
  using ((select public.is_admin())
         or ((select public.is_approved_user()) and active is true));

-- politicile „admin write” erau TO public → authenticated
alter policy exams_write                         on public.exams                         to authenticated;
alter policy keys_admin                          on public.answer_keys                   to authenticated;
alter policy faculties_write                     on public.faculties                     to authenticated;
alter policy exam_questions_write                on public.exam_questions                to authenticated;
alter policy chemical_structures_write           on public.chemical_structures           to authenticated;
alter policy flashcard_decks_write               on public.flashcard_decks               to authenticated;
alter policy flashcards_write                    on public.flashcards                    to authenticated;
alter policy flashcard_chemical_structures_write on public.flashcard_chemical_structures to authenticated;

-- question_review_schedule: aceeași regulă „aprobat + al tău” ca restul
alter policy question_review_schedule_all on public.question_review_schedule
  to authenticated
  using      ((select public.is_admin()) or ((user_id = (select auth.uid())) and (select public.is_approved_user())))
  with check ((select public.is_admin()) or ((user_id = (select auth.uid())) and (select public.is_approved_user())));

-- study_sessions: (select auth.uid()) + aprobat
alter policy study_sessions_select_own on public.study_sessions
  using ((select auth.uid()) = user_id and (select public.is_approved_user()));
alter policy study_sessions_insert_own on public.study_sessions
  with check ((select auth.uid()) = user_id and (select public.is_approved_user()));
alter policy study_sessions_update_own on public.study_sessions
  using ((select auth.uid()) = user_id and (select public.is_approved_user()))
  with check ((select auth.uid()) = user_id and (select public.is_approved_user()));
alter policy study_sessions_delete_own on public.study_sessions
  using ((select auth.uid()) = user_id and (select public.is_approved_user()));

-- tabela de staging: RLS activ, fără policy → inaccesibilă din client
-- (service_role / SQL editor continuă să funcționeze)
alter table public.questions_import_stage_cluj_2023 enable row level security;


-- ── 3. Abonamente & plăți ───────────────────────────────────────────────────
alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists canceled_at timestamptz,
  add column if not exists provider text,
  add column if not exists provider_subscription_id text;

-- un singur abonament „viu” per utilizator
-- (dacă pică: ai dubluri → select user_id, count(*) from subscriptions
--  where status in ('active','trialing','past_due') group by 1 having count(*)>1;)
create unique index if not exists subscriptions_one_live_per_user
  on public.subscriptions (user_id)
  where status in ('active','trialing','past_due');

-- webhook-urile reîncercate nu mai creează plăți duble
create unique index if not exists payments_provider_ref_uq
  on public.payments (provider, provider_ref)
  where provider_ref is not null;

-- planul curent, calculat în DB (clientul nu mai ghicește dacă e activ)
create or replace view public.my_current_plan
with (security_invoker = true) as
select distinct on (user_id)
  user_id, tier, status, started_at, expires_at, cancel_at_period_end,
  (status in ('active','trialing','past_due')
     and (expires_at is null or expires_at > now())) as is_live
from public.subscriptions
where user_id = auth.uid()
order by user_id, started_at desc;

-- nivelul curent ('free' | 'basic' | 'premium') — folosește-l în RLS pt. funcții plătite
create or replace function public.current_tier()
returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select s.tier from public.subscriptions s
      where s.user_id = auth.uid()
        and s.status in ('active','trialing','past_due')
        and (s.expires_at is null or s.expires_at > now())
      order by s.started_at desc limit 1),
    'free');
$$;
revoke all on function public.current_tier() from public, anon;
grant execute on function public.current_tier() to authenticated;


-- ── 4. Integritate: FK către auth.users cu ștergere în cascadă ──────────────
do $$
declare t text;
begin
  foreach t in array array['submissions','subscriptions','payments','question_attempts',
    'flashcard_reviews','user_exams','user_habits','user_day_events','question_sessions',
    'study_sessions','question_review_schedule','user_lesson_progress'] loop
    if not exists (
      select 1 from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
      where c.contype = 'f' and c.conrelid = format('public.%I', t)::regclass and a.attname = 'user_id'
    ) then
      execute format('alter table public.%I add constraint %I foreign key (user_id)
                      references auth.users(id) on delete cascade not valid', t, t || '_user_fk');
    end if;
  end loop;
end $$;


-- ── 5. Constrângeri de valori (NOT VALID) ───────────────────────────────────
create or replace function pg_temp.add_check(tbl text, cname text, expr text) returns void
language plpgsql as $$
begin
  execute format('alter table public.%I add constraint %I check (%s) not valid', tbl, cname, expr);
exception when duplicate_object then null;
end $$;

select pg_temp.add_check('submissions','submissions_score_chk','score >= 0 and score <= total');
select pg_temp.add_check('submissions','submissions_pct_chk','percentage between 0 and 100');
select pg_temp.add_check('exams','exams_numq_chk','num_questions between 1 and 150');
select pg_temp.add_check('profiles','profiles_target_chk','target_score is null or target_score between 1 and 45');
select pg_temp.add_check('profiles','profiles_code_chk','student_code is null or student_code ~ ''^\d{5}$''');
select pg_temp.add_check('subscriptions','subscriptions_tier_chk','tier in (''free'',''basic'',''premium'')');
select pg_temp.add_check('subscriptions','subscriptions_status_chk',
  'status in (''active'',''trialing'',''past_due'',''canceled'',''cancelled'',''expired'')');
-- verifică înainte: select distinct tier, status from subscriptions;


-- ── 6. Idempotență + updated_at automat ─────────────────────────────────────
create unique index if not exists submissions_client_uq
  on public.submissions (user_id, client_submission_id) where client_submission_id is not null;
create unique index if not exists question_sessions_client_uq
  on public.question_sessions (user_id, client_session_id);

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

do $$
declare t text;
begin
  for t in select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'updated_at'
      and table_name in ('profiles','chapters','questions','exam_questions','chemical_structures',
        'flashcard_decks','flashcards','subjects','learning_courses','learning_modules',
        'learning_lessons','learning_steps','question_review_schedule')
  loop
    execute format('drop trigger if exists trg_set_updated_at on public.%I', t);
    execute format('create trigger trg_set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;


-- ── 7. Indexuri (FK-uri și istoricul utilizatorului) ────────────────────────
create index if not exists idx_submissions_user      on public.submissions (user_id, created_at desc);
create index if not exists idx_attempts_user         on public.question_attempts (user_id, created_at desc);
create index if not exists idx_attempts_question     on public.question_attempts (question_id);
create index if not exists idx_attempts_session      on public.question_attempts (session_id);
create index if not exists idx_qsessions_user        on public.question_sessions (user_id, created_at desc);
create index if not exists idx_fc_reviews_user       on public.flashcard_reviews (user_id, reviewed_at desc);
create index if not exists idx_fc_reviews_card       on public.flashcard_reviews (flashcard_id);
create index if not exists idx_study_sessions_user   on public.study_sessions (user_id, started_at desc);
create index if not exists idx_payments_user         on public.payments (user_id, created_at desc);
create index if not exists idx_subscriptions_user    on public.subscriptions (user_id, started_at desc);
create index if not exists idx_questions_chapter     on public.questions (chapter_id);
create index if not exists idx_flashcards_deck       on public.flashcards (deck_id);
create index if not exists idx_flashcards_chapter    on public.flashcards (chapter_id);
create index if not exists idx_exam_questions_exam   on public.exam_questions (exam_id);
create index if not exists idx_answer_keys_exam      on public.answer_keys (exam_id);
create index if not exists idx_exams_faculty         on public.exams (faculty_id);
create index if not exists idx_user_habits_user_day  on public.user_habits (user_id, day);
create index if not exists idx_user_events_user_day  on public.user_day_events (user_id, day);
create index if not exists idx_user_exams_user_date  on public.user_exams (user_id, exam_date);
create index if not exists idx_review_sched_due      on public.question_review_schedule (user_id, next_review_at);
create index if not exists idx_learning_modules_c    on public.learning_modules (course_id);
create index if not exists idx_learning_lessons_m    on public.learning_lessons (module_id);
create index if not exists idx_learning_steps_l      on public.learning_steps (lesson_id);


-- ── 8. Generator de cod de concurs (pentru admin / Edge Function) ───────────
create or replace function public.generate_student_code()
returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare c text; i int := 0;
begin
  loop
    c := lpad((floor(random() * 100000))::int::text, 5, '0');
    exit when not exists (select 1 from public.profiles where student_code = c);
    i := i + 1;
    if i > 100 then raise exception 'Nu am găsit un cod liber'; end if;
  end loop;
  return c;
end $$;
revoke all on function public.generate_student_code() from public, anon, authenticated;
-- apel din admin/service_role:  update profiles set student_code = generate_student_code() where id = '...';


-- ── 9. După ce verifici că aplicația merge: validează constrângerile ────────
-- (dacă una pică, îți arată rândurile vechi greșite; corectează-le și reia)
-- alter table public.submissions   validate constraint submissions_score_chk;
-- alter table public.submissions   validate constraint submissions_pct_chk;
-- alter table public.exams         validate constraint exams_numq_chk;
-- alter table public.profiles      validate constraint profiles_target_chk;
-- alter table public.profiles      validate constraint profiles_code_chk;
-- alter table public.subscriptions validate constraint subscriptions_tier_chk;
-- alter table public.subscriptions validate constraint subscriptions_status_chk;
-- alter table public.submissions   validate constraint submissions_user_fk;   -- etc. pentru *_user_fk
