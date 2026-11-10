-- SubMed personal wall: compact, text-only private notes.
-- Max 200 notes per user; title <= 80 chars; body <= 2,000 chars.
-- No uploads, rich-text blobs, or attachments.

begin;

create table if not exists public.personal_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title varchar(80) not null default '',
  body varchar(2000) not null,
  category text not null default 'general'
    check (category in ('general', 'study', 'idea', 'todo', 'important')),
  source_page varchar(120) not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_notes_body_nonempty check (length(btrim(body)) > 0)
);

create index if not exists personal_notes_user_updated_idx
  on public.personal_notes (user_id, updated_at desc);

create index if not exists personal_notes_user_category_updated_idx
  on public.personal_notes (user_id, category, updated_at desc);

alter table public.personal_notes enable row level security;

drop policy if exists personal_notes_select_own on public.personal_notes;
create policy personal_notes_select_own
  on public.personal_notes for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists personal_notes_insert_own on public.personal_notes;
create policy personal_notes_insert_own
  on public.personal_notes for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists personal_notes_update_own on public.personal_notes;
create policy personal_notes_update_own
  on public.personal_notes for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists personal_notes_delete_own on public.personal_notes;
create policy personal_notes_delete_own
  on public.personal_notes for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.personal_notes to authenticated;

create or replace function public.enforce_personal_notes_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  if auth.uid() is null or new.user_id <> auth.uid() then
    raise exception 'Autentificarea este necesară pentru notițe.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  select count(*) into current_count
  from public.personal_notes
  where user_id = new.user_id;

  if current_count >= 200 then
    raise exception 'Ai atins limita de 200 de notițe. Șterge câteva notițe vechi pentru a continua.';
  end if;

  return new;
end;
$$;

drop trigger if exists personal_notes_limit_before_insert on public.personal_notes;
create trigger personal_notes_limit_before_insert
  before insert on public.personal_notes
  for each row execute function public.enforce_personal_notes_limit();

create or replace function public.set_personal_notes_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists personal_notes_updated_at on public.personal_notes;
create trigger personal_notes_updated_at
  before update on public.personal_notes
  for each row execute function public.set_personal_notes_updated_at();

commit;
