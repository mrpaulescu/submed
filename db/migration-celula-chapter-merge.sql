-- Merge the imported biology chapter "Organizarea corpului uman. Celula"
-- into the public chapter "Celula" so its questions appear in one grile card.
-- Safe to run repeatedly in the Supabase SQL Editor.

begin;

do $$
declare
  canonical_id uuid;
begin
  select id
    into canonical_id
    from public.chapters
   where subject = 'biologie'
     and lower(btrim(name)) = 'celula'
   order by sort_order, created_at, id
   limit 1;

  if canonical_id is null then
    select id
      into canonical_id
      from public.chapters
     where subject = 'biologie'
       and lower(btrim(name)) = 'organizarea corpului uman. celula'
     order by sort_order, created_at, id
     limit 1;

    if canonical_id is null then
      return;
    end if;

    update public.chapters
       set name = 'Celula'
     where id = canonical_id;
  end if;

  update public.questions
     set chapter_id = canonical_id
   where chapter_id in (
     select id from public.chapters
      where subject = 'biologie'
        and lower(btrim(name)) in ('celula', 'organizarea corpului uman. celula')
   )
     and chapter_id <> canonical_id;

  update public.exam_questions
     set chapter_id = canonical_id
   where chapter_id in (
     select id from public.chapters
      where subject = 'biologie'
        and lower(btrim(name)) in ('celula', 'organizarea corpului uman. celula')
   )
     and chapter_id <> canonical_id;

  update public.chemical_structures
     set chapter_id = canonical_id
   where chapter_id in (
     select id from public.chapters
      where subject = 'biologie'
        and lower(btrim(name)) in ('celula', 'organizarea corpului uman. celula')
   )
     and chapter_id <> canonical_id;

  update public.flashcard_decks
     set chapter_id = canonical_id
   where chapter_id in (
     select id from public.chapters
      where subject = 'biologie'
        and lower(btrim(name)) in ('celula', 'organizarea corpului uman. celula')
   )
     and chapter_id <> canonical_id;

  update public.flashcards
     set chapter_id = canonical_id
   where chapter_id in (
     select id from public.chapters
      where subject = 'biologie'
        and lower(btrim(name)) in ('celula', 'organizarea corpului uman. celula')
   )
     and chapter_id <> canonical_id;

  delete from public.chapters
   where subject = 'biologie'
     and lower(btrim(name)) in ('celula', 'organizarea corpului uman. celula')
     and id <> canonical_id;
end;
$$;

commit;

-- Verificare: SQL Editor va afișa numărul de întrebări active rămase la Celula.
select
  c.id as chapter_id,
  c.name as chapter_name,
  count(q.id) filter (where q.active) as active_question_count
from public.chapters c
left join public.questions q on q.chapter_id = c.id
where c.subject = 'biologie'
  and lower(btrim(c.name)) = 'celula'
group by c.id, c.name;
