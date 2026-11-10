-- SubMed Personal Wall
-- Stores short text for notes and lightweight references to existing platform content.
-- Question/flashcard/exam records are referenced by ID: their content is never copied here.

begin;

create table if not exists public.personal_wall_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (
    item_type in ('note', 'postit', 'question', 'flashcard', 'exam',
                  'chemical_structure', 'lesson', 'submission')
  ),
  title varchar(80) not null default '',
  body varchar(2000) not null default '',
  category text not null default 'general'
    check (category in ('general', 'study', 'idea', 'todo', 'important')),
  content_id uuid,
  source_page varchar(120) not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_wall_item_payload check (
    (
      item_type in ('note', 'postit')
      and length(btrim(body)) > 0
      and content_id is null
    )
    or
    (
      item_type not in ('note', 'postit')
      and content_id is not null
      and title = ''
      and body = ''
    )
  )
);

create index if not exists personal_wall_items_user_updated_idx
  on public.personal_wall_items (user_id, updated_at desc);

create index if not exists personal_wall_items_user_type_updated_idx
  on public.personal_wall_items (user_id, item_type, updated_at desc);

create unique index if not exists personal_wall_items_unique_reference_idx
  on public.personal_wall_items (user_id, item_type, content_id)
  where content_id is not null;

alter table public.personal_wall_items enable row level security;

drop policy if exists personal_wall_items_select_own on public.personal_wall_items;
create policy personal_wall_items_select_own
  on public.personal_wall_items for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists personal_wall_items_insert_own on public.personal_wall_items;
create policy personal_wall_items_insert_own
  on public.personal_wall_items for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists personal_wall_items_update_own on public.personal_wall_items;
create policy personal_wall_items_update_own
  on public.personal_wall_items for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists personal_wall_items_delete_own on public.personal_wall_items;
create policy personal_wall_items_delete_own
  on public.personal_wall_items for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.personal_wall_items to authenticated;

create or replace function public.enforce_personal_wall_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  reference_exists boolean := false;
begin
  if auth.uid() is null or new.user_id <> auth.uid() then
    raise exception 'Autentificarea este necesară pentru peretele personal.';
  end if;

  if tg_op = 'UPDATE' then
    if new.user_id <> old.user_id
       or new.item_type <> old.item_type
       or new.content_id is distinct from old.content_id then
      raise exception 'Tipul și referința unui element salvat nu pot fi schimbate.';
    end if;
  else
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

    select count(*) into current_count
    from public.personal_wall_items
    where user_id = new.user_id;

    if current_count >= 500 then
      raise exception 'Ai atins limita de 500 de elemente pe peretele personal. Șterge câteva elemente vechi pentru a continua.';
    end if;
  end if;

  if new.item_type in ('note', 'postit') then
    if length(btrim(new.body)) = 0 then
      raise exception 'Conținutul nu poate fi gol.';
    end if;
  else
    if new.content_id is null then
      raise exception 'Elementul de salvat nu are o referință validă.';
    end if;

    case new.item_type
      when 'question' then
        select exists(select 1 from public.questions where id = new.content_id and active) into reference_exists;
      when 'flashcard' then
        select exists(select 1 from public.flashcards where id = new.content_id and active) into reference_exists;
      when 'exam' then
        select exists(select 1 from public.exams where id = new.content_id and is_published) into reference_exists;
      when 'chemical_structure' then
        select exists(select 1 from public.chemical_structures where id = new.content_id and active) into reference_exists;
      when 'lesson' then
        select exists(select 1 from public.learning_lessons where id = new.content_id and active) into reference_exists;
      when 'submission' then
        select exists(select 1 from public.submissions where id = new.content_id and user_id = new.user_id) into reference_exists;
      else
        reference_exists := false;
    end case;

    if not reference_exists then
      raise exception 'Conținutul selectat nu mai este disponibil.';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists personal_wall_items_guard on public.personal_wall_items;
create trigger personal_wall_items_guard
  before insert or update on public.personal_wall_items
  for each row execute function public.enforce_personal_wall_item();

commit;
