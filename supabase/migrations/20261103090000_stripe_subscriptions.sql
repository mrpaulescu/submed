-- Stripe subscription support for the existing SubMed schema.
-- Run after the base db/schema.sql migration. Secrets stay in Edge Function env vars.
alter table public.subscriptions drop constraint if exists subscriptions_tier_check, drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_tier_check check (tier in ('free','basic','premium'));
alter table public.subscriptions add constraint subscriptions_status_check check (status in ('active','trialing','past_due','canceled','cancelled','expired'));
alter table public.subscriptions add column if not exists provider text, add column if not exists provider_subscription_id text, add column if not exists cancel_at_period_end boolean not null default false, add column if not exists canceled_at timestamptz;
create unique index if not exists subscriptions_provider_subscription_id_uidx on public.subscriptions(provider_subscription_id) where provider_subscription_id is not null;
create table if not exists public.billing_customers (user_id uuid primary key references auth.users(id) on delete cascade, stripe_customer_id text not null unique, created_at timestamptz not null default now());
alter table public.billing_customers enable row level security;
revoke all on public.billing_customers from anon, authenticated;
create unique index if not exists payments_provider_ref_uidx on public.payments(provider, provider_ref) where provider is not null and provider_ref is not null;
