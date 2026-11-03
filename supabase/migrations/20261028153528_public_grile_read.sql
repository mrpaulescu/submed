-- Public can read chapters and active questions for the guest grids page.
-- Questions include answer keys because grading currently happens in the browser.
grant usage on schema public to anon;
revoke all privileges on table public.chapters, public.questions from anon;
grant select on table public.chapters, public.questions to anon;

drop policy if exists chapters_read on public.chapters;
create policy chapters_read on public.chapters
  for select to anon, authenticated
  using (true);

drop policy if exists questions_read on public.questions;
create policy questions_read on public.questions
  for select to anon, authenticated
  using (active is true);
