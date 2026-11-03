-- ============================================================================
-- SubMed v2 — Migrație: categorie examen (admitere / simulare / presimulare)
-- ============================================================================
-- Rulează în Supabase → SQL Editor. Adaugă filtrul pe categorie folosit de
-- pagina de scanare și de admin.
-- ============================================================================

alter table public.exams
  add column if not exists category text
  check (category in ('admitere', 'simulare', 'presimulare'));

-- exemplul deja existent (Simulare Mai 2024) → categoria „simulare"
update public.exams
set category = 'simulare'
where category is null and name ilike '%simulare%';

-- restul fără categorie → implicit „admitere" (poți ajusta din admin)
update public.exams
set category = 'admitere'
where category is null;
