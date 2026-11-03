-- ============================================================================
-- SubMed v2 — Seed de test: 1 facultate + 1 examen + 1 barem
-- ============================================================================
-- Rulează în Supabase → SQL Editor ca să ai cu ce testa fluxul de scanare.
-- Baremul are doar 10 întrebări completate (restul rămân „ungraded").
-- Foaie tip „submed" (poză de telefon).
-- ============================================================================

with f as (
  insert into public.faculties (name, city, slug)
  values ('UMF „Iuliu Hațieganu"', 'Cluj-Napoca', 'cluj')
  on conflict (slug) do update set name = excluded.name
  returning id
),
e as (
  insert into public.exams (faculty_id, name, year, session, exam_date, sheet_type, num_questions)
  select id, 'Simulare Mai 2024 – Varianta 2', 2024, 'mai', '2024-05-10', 'submed', 150
  from f
  returning id
)
insert into public.answer_keys (exam_id, variant, key, verified)
select id, '1', '{
  "1":["a","c","e"], "2":["d"], "3":["c","e"], "4":["b","e"], "5":["b","e"],
  "6":["a","b","e"], "7":["d"], "8":["a","d","e"], "9":["b","e"], "10":["e"]
}'::jsonb, true
from e;

-- Verifică:
select ex.name, ex.sheet_type, ak.variant, jsonb_object_keys(ak.key) as q
from public.exams ex
join public.answer_keys ak on ak.exam_id = ex.id
order by ex.created_at desc, q::int
limit 12;
