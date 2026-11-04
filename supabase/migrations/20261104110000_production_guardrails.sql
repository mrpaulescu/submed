-- SubMed production guardrails: protect privileged profile fields and billing writes.
-- Safe to apply on the existing project. No rows are deleted or rewritten.
-- Apply only after reviewing the current production schema and taking a backup.

create or replace function public.guard_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Service-role/server-side operations and SQL Editor sessions normally have
  -- auth.uid() = NULL. Authenticated non-admin users may edit personal fields,
  -- but cannot grant themselves privileges or alter approval/student identity.
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
       or new.access_status is distinct from old.access_status
       or new.approved_at is distinct from old.approved_at
       or new.approved_by is distinct from old.approved_by
       or new.student_code is distinct from old.student_code then
      raise exception 'Nu poți modifica rolul, aprobarea sau codul de student.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_privileged_fields on public.profiles;
create trigger guard_profile_privileged_fields
before update on public.profiles
for each row
execute function public.guard_profile_privileged_fields();

-- Financial records are written by trusted Edge Functions/webhooks only.
-- Preserve SELECT permissions/policies so users can still see their own data.
revoke insert, update, delete on table public.subscriptions
  from public, anon, authenticated;
revoke insert, update, delete on table public.payments
  from public, anon, authenticated;
revoke all on table public.billing_customers
  from public, anon, authenticated;

comment on function public.guard_profile_privileged_fields() is
  'Prevents non-admin authenticated users from changing role, approval, or student_code fields.';
