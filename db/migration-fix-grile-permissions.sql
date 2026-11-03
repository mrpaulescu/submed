-- SubMed - fix permissions for admin chapter/question management
-- Safe to run more than once. Apply in the Supabase SQL Editor.

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.chapters to authenticated;
grant select, insert, update, delete on table public.questions to authenticated;
grant usage on schema public to anon;
revoke all privileges on table public.chapters, public.questions from anon;
grant select on table public.chapters, public.questions to anon;

-- Keep the admin UI contract: deleting a chapter also deletes its questions.
alter table public.questions
  drop constraint if exists questions_chapter_id_fkey;
alter table public.questions
  add constraint questions_chapter_id_fkey
  foreign key (chapter_id) references public.chapters(id) on delete cascade;

alter table public.question_attempts
  drop constraint if exists question_attempts_question_id_fkey;
alter table public.question_attempts
  add constraint question_attempts_question_id_fkey
  foreign key (question_id) references public.questions(id) on delete cascade;

drop policy if exists chapters_read on public.chapters;
create policy chapters_read on public.chapters
  for select to anon, authenticated
  using (true);

drop policy if exists chapters_write on public.chapters;
create policy chapters_write on public.chapters
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists questions_read on public.questions;
create policy questions_read on public.questions
  for select to anon, authenticated
  using (active is true);

drop policy if exists questions_write on public.questions;
create policy questions_write on public.questions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
