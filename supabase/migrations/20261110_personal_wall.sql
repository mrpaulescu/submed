-- SubMed Second Brain / Personal Wall
-- Stores short text and references to canonical SubMed content. It never copies
-- question text, answer keys, flashcard content, exam PDFs or binary attachments.

begin;

create table if not exists public.personal_wall_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (
    item_type in (
      'note', 'postit', 'question', 'flashcard', 'exam',
      'chemical_structure', 'lesson', 'submission', 'calendar_event'
    )
  ),
  title varchar(120) not null default '',
  body varchar(4000) not null default '',
  category text not null default 'altele'
    check (category in ('biologie', 'chimie', 'altele')),
  tags text[] not null default '{}',
  is_important boolean not null default false,
  content_id uuid,
  source_page varchar(120) not null default '',
  in_mindmap boolean not null default false,
  on_board boolean not null default false,
  board_x integer not null default 24 check (board_x between 0 and 10000),
  board_y integer not null default 24 check (board_y between 0 and 10000),
  postit_color text not null default '#FFF3C4'
    check (postit_color in ('#FFF3C4', '#DCE9FF', '#D9F3E6', '#FBE0E0')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_wall_item_content_shape check (
    (
      item_type in ('note', 'postit')
      and content_id is null
      and length(btrim(body)) > 0
    )
    or
    (
      item_type not in ('note', 'postit')
      and content_id is not null
      and title = ''
      and body = ''
    )
  ),
  constraint personal_wall_tags_limit check (cardinality(tags) <= 12)
);

create index if not exists personal_wall_items_user_updated_idx
  on public.personal_wall_items (user_id, updated_at desc);

create index if not exists personal_wall_items_user_type_updated_idx
  on public.personal_wall_items (user_id, item_type, updated_at desc);

create index if not exists personal_wall_items_user_category_updated_idx
  on public.personal_wall_items (user_id, category, updated_at desc);

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

create table if not exists public.personal_wall_comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.personal_wall_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body varchar(1000) not null,
  created_at timestamptz not null default now(),
  constraint personal_wall_comment_nonempty check (length(btrim(body)) > 0)
);

create index if not exists personal_wall_comments_item_created_idx
  on public.personal_wall_comments (item_id, created_at asc);

alter table public.personal_wall_comments enable row level security;

drop policy if exists personal_wall_comments_select_own on public.personal_wall_comments;
create policy personal_wall_comments_select_own
  on public.personal_wall_comments for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.personal_wall_items i
      where i.id = item_id and i.user_id = (select auth.uid())
    )
  );

drop policy if exists personal_wall_comments_insert_own on public.personal_wall_comments;
create policy personal_wall_comments_insert_own
  on public.personal_wall_comments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.personal_wall_items i
      where i.id = item_id and i.user_id = (select auth.uid())
    )
  );

drop policy if exists personal_wall_comments_update_own on public.personal_wall_comments;
create policy personal_wall_comments_update_own
  on public.personal_wall_comments for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.personal_wall_items i
      where i.id = item_id and i.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.personal_wall_items i
      where i.id = item_id and i.user_id = (select auth.uid())
    )
  );

drop policy if exists personal_wall_comments_delete_own on public.personal_wall_comments;
create policy personal_wall_comments_delete_own
  on public.personal_wall_comments for delete to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.personal_wall_items i
      where i.id = item_id and i.user_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on public.personal_wall_comments to authenticated;

create or replace function public.guard_personal_wall_item()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  item_count integer;
  reference_exists boolean := false;
begin
  if auth.uid() is null or new.user_id <> auth.uid() then
    raise exception 'Autentificarea este necesară pentru peretele personal.';
  end if;

  if tg_op = 'UPDATE' then
    if new.user_id <> old.user_id
       or new.item_type <> old.item_type
       or new.content_id is distinct from old.content_id then
      raise exception 'Tipul și referința unui material salvat nu pot fi schimbate.';
    end if;
  else
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
    select count(*) into item_count
    from public.personal_wall_items
    where user_id = new.user_id;

    if item_count >= 500 then
      raise exception 'Ai atins limita de 500 de elemente pe peretele personal. Șterge câteva elemente vechi pentru a continua.';
    end if;
  end if;

  if new.item_type in ('note', 'postit') then
    if length(btrim(new.body)) = 0 then
      raise exception 'Conținutul nu poate fi gol.';
    end if;
  else
    if new.content_id is null then
      raise exception 'Elementul salvat nu are o referință validă.';
    end if;

    -- These checks run as the authenticated caller, so the source table's
    -- existing RLS policy still decides whether this content is accessible.
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
      when 'calendar_event' then
        select exists(select 1 from public.user_day_events where id = new.content_id and user_id = new.user_id) into reference_exists;
      else
        reference_exists := false;
    end case;

    if not reference_exists then
      raise exception 'Conținutul selectat nu mai este disponibil sau nu ai acces la el.';
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
  for each row execute function public.guard_personal_wall_item();

create or replace function public.guard_personal_wall_comment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_owner uuid;
  comment_count integer;
begin
  if auth.uid() is null or new.user_id <> auth.uid() then
    raise exception 'Autentificarea este necesară pentru comentarii.';
  end if;

  select user_id into parent_owner
  from public.personal_wall_items
  where id = new.item_id;

  if parent_owner is null or parent_owner <> new.user_id then
    raise exception 'Elementul nu aparține contului tău.';
  end if;

  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended(new.item_id::text, 0));
    select count(*) into comment_count
    from public.personal_wall_comments
    where item_id = new.item_id;
    if comment_count >= 30 then
      raise exception 'Poți adăuga maximum 30 de comentarii la un element.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists personal_wall_comments_guard on public.personal_wall_comments;
create trigger personal_wall_comments_guard
  before insert or update on public.personal_wall_comments
  for each row execute function public.guard_personal_wall_comment();

commit;
