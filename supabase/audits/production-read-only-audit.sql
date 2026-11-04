-- SubMed production audit — READ ONLY
-- Run in Supabase SQL Editor against the EXISTING production project.
-- This script only reads catalog metadata; it does not modify tables or data.
-- Copy the result sets back for review. Never paste service-role keys or secrets.

-- 1. RLS status for all public tables.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r','p')
order by c.relname;

-- 2. Policies, including command, roles, USING and WITH CHECK.
select
  schemaname, tablename, policyname, permissive, roles,
  cmd, qual, with_check
from pg_policies
where schemaname in ('public','storage')
order by schemaname, tablename, policyname;

-- 3. Table-level privileges for client and server roles.
select
  table_schema, table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema in ('public','storage')
  and grantee in ('anon','authenticated','service_role','PUBLIC')
order by table_schema, table_name, grantee, privilege_type;

-- 4. Column-level privileges (important for sensitive columns such as questions.correct).
select
  table_schema, table_name, column_name, grantee, privilege_type
from information_schema.role_column_grants
where table_schema = 'public'
  and grantee in ('anon','authenticated','service_role','PUBLIC')
order by table_name, column_name, grantee, privilege_type;

-- 5. Constraints and foreign keys.
select
  n.nspname as schema_name,
  t.relname as table_name,
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_get_constraintdef(con.oid) as definition,
  con.convalidated as validated
from pg_constraint con
join pg_class t on t.oid = con.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
order by t.relname, con.conname;

-- 6. Indexes.
select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;

-- 7. User-defined triggers (exclude internal FK triggers).
select
  event_object_schema as schema_name,
  event_object_table as table_name,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
order by event_object_table, trigger_name, event_manipulation;

-- 8. Security-definer functions and their search_path configuration.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.proconfig as function_settings,
  pg_get_function_result(p.oid) as return_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
order by p.proname;

-- 9. Views and security-invoker setting.
select
  schemaname, viewname, definition
from pg_views
where schemaname = 'public'
order by viewname;

-- 10. Storage buckets (metadata only).
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by name;

-- 11. Applied Supabase migrations.
select version, name
from supabase_migrations.schema_migrations
order by version;
