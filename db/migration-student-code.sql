-- ============================================================================
-- SubMed v2 — Migrație: cod de concurs unic per user (5 cifre)
-- ============================================================================
-- Fiecare user primește un cod numeric unic de 5 cifre, stocat în
-- profiles.student_code. Userul îl bifează în zona „număr de concurs" de pe
-- foaia BulineSubmed.pdf; la scanare se citește și leagă rezultatul de cont.
-- Rulează în Supabase → SQL Editor.
-- ============================================================================

-- 1. unicitate pe student_code (NULL-urile rămân permise până la backfill)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_student_code_key') then
    alter table public.profiles add constraint profiles_student_code_key unique (student_code);
  end if;
end $$;

-- 2. generator de cod unic de 5 cifre
create or replace function public.gen_student_code()
returns text language plpgsql as $$
declare c text;
begin
  loop
    c := lpad((floor(random() * 100000))::int::text, 5, '0');
    exit when not exists (select 1 from public.profiles where student_code = c);
  end loop;
  return c;
end; $$;

-- 3. trigger nou: la crearea profilului, asignează automat un cod
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, avatar_url, student_code)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
          new.raw_user_meta_data->>'avatar_url',
          public.gen_student_code())
  on conflict (id) do nothing;
  return new;
end; $$;

-- 4. backfill: dă cod conturilor existente fără cod (inclusiv contul tău)
update public.profiles
set student_code = public.gen_student_code()
where student_code is null;

-- verifică:
select name, student_code from public.profiles order by created_at;
