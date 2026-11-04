-- SubMed production guardrails: protect privileged profile fields and billing writes.
-- Safe to apply on the existing project. No rows are deleted or rewritten.
-- Apply only after reviewing the current production schema and taking a backup.

-- Profile privilege protection already exists in submed_migration.sql
-- as public.protect_profile_columns() with trigger trg_profiles_protect.
-- Do not create a second trigger; preserve the established production guard.

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
