-- ============================================================================
-- SubMed v2 — Seed de test pentru grile (capitole + întrebări)
-- Rulează în Supabase → SQL Editor după grile-schema.sql.
-- ============================================================================

insert into public.chapters (subject, name, sort_order) values
  ('biologie', 'Celula', 1),
  ('biologie', 'Țesuturi', 2),
  ('chimie',   'Hidrocarburi', 1);

-- ── Biologie · Celula ───────────────────────────────────────────
insert into public.questions (chapter_id, text, options, correct, explanation, multiple, difficulty, source) values
((select id from public.chapters where subject='biologie' and name='Celula' limit 1),
 'Membrana celulară conține:',
 '[{"key":"a","text":"lipide"},{"key":"b","text":"proteine"},{"key":"c","text":"celuloză"},{"key":"d","text":"colesterol"},{"key":"e","text":"amidon"}]'::jsonb,
 '["a","b","d"]'::jsonb,
 'Conform modelului mozaicului fluid: bistrat lipidic, proteine și colesterol. Celuloza și amidonul sunt polizaharide vegetale de structură/rezervă.',
 true, 'mediu', 'seed'),

((select id from public.chapters where subject='biologie' and name='Celula' limit 1),
 'Organitul cu rol principal în sinteza proteinelor este:',
 '[{"key":"a","text":"ribozomul"},{"key":"b","text":"lizozomul"},{"key":"c","text":"mitocondria"},{"key":"d","text":"aparatul Golgi"},{"key":"e","text":"centrozomul"}]'::jsonb,
 '["a"]'::jsonb,
 'Ribozomii asamblează lanțul polipeptidic (traducerea ARNm).',
 false, 'usor', 'seed'),

((select id from public.chapters where subject='biologie' and name='Celula' limit 1),
 'Despre mitocondrie sunt adevărate:',
 '[{"key":"a","text":"produce ATP"},{"key":"b","text":"are ADN propriu"},{"key":"c","text":"este sediul fotosintezei"},{"key":"d","text":"are membrană dublă"},{"key":"e","text":"lipsește din celulele animale"}]'::jsonb,
 '["a","b","d"]'::jsonb,
 'Mitocondria: respirație celulară (ATP), ADN propriu, membrană dublă. Fotosinteza are loc în cloroplaste.',
 true, 'mediu', 'seed');

-- ── Chimie · Hidrocarburi ───────────────────────────────────────
insert into public.questions (chapter_id, text, options, correct, explanation, multiple, difficulty, source) values
((select id from public.chapters where subject='chimie' and name='Hidrocarburi' limit 1),
 'Formula moleculară a metanului este:',
 '[{"key":"a","text":"CH4"},{"key":"b","text":"C2H6"},{"key":"c","text":"C2H4"},{"key":"d","text":"C2H2"},{"key":"e","text":"C6H6"}]'::jsonb,
 '["a"]'::jsonb,
 'Metanul este cea mai simplă hidrocarbură: CH4.',
 false, 'usor', 'seed'),

((select id from public.chapters where subject='chimie' and name='Hidrocarburi' limit 1),
 'Sunt hidrocarburi nesaturate:',
 '[{"key":"a","text":"alcanii"},{"key":"b","text":"alchenele"},{"key":"c","text":"alchinele"},{"key":"d","text":"arenele"},{"key":"e","text":"cicloalcanii"}]'::jsonb,
 '["b","c","d"]'::jsonb,
 'Alchenele (legătură dublă), alchinele (legătură triplă) și arenele (sistem aromatic) sunt nesaturate. Alcanii și cicloalcanii sunt saturați.',
 true, 'greu', 'seed');
