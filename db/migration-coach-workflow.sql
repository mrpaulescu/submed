-- SubMed — programarea personalizată pentru întrebările greșite
-- Rulează în Supabase → SQL Editor. Migrarea este idempotentă.

create table if not exists public.question_review_schedule (
  user_id          uuid not null references auth.users(id) on delete cascade,
  question_id      uuid not null references public.questions(id) on delete cascade,
  repetition_count int not null default 0 check (repetition_count >= 0),
  interval_days    int not null default 1 check (interval_days >= 1),
  ease             numeric(4,2) not null default 2.50 check (ease >= 1.30),
  next_review_at   timestamptz not null default now(),
  last_reviewed_at timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (user_id, question_id)
);

drop trigger if exists set_question_review_schedule_updated_at on public.question_review_schedule;
create trigger set_question_review_schedule_updated_at
  before update on public.question_review_schedule
  for each row execute function public.set_updated_at();

create index if not exists idx_question_review_schedule_due
  on public.question_review_schedule(user_id, next_review_at);

alter table public.question_review_schedule enable row level security;
drop policy if exists question_review_schedule_all on public.question_review_schedule;
create policy question_review_schedule_all on public.question_review_schedule for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- Importă greșelile istorice care au rămas greșite la ultima încercare.
insert into public.question_review_schedule
  (user_id, question_id, repetition_count, interval_days, ease, next_review_at, last_reviewed_at)
select latest.user_id, latest.question_id, 0, 1, 2.50, now(), latest.created_at
from (
  select distinct on (user_id, question_id)
    user_id, question_id, is_correct, created_at, id
  from public.question_attempts
  where case
    when jsonb_typeof(selected) = 'array' then jsonb_array_length(selected) > 0
    else false
  end
  order by user_id, question_id, created_at desc, id desc
) as latest
where latest.is_correct = false
on conflict (user_id, question_id) do nothing;
