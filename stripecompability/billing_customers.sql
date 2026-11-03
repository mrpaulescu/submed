-- Legătura user ↔ client Stripe. Tabel separat (nu o coloană în profiles) ca
-- utilizatorul să nu-și poată schimba stripe_customer_id și să ajungă în portalul altcuiva.
-- RLS activ FĂRĂ policy-uri → accesibil doar din Edge Functions (service_role).
create table if not exists public.billing_customers (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at         timestamptz not null default now()
);
alter table public.billing_customers enable row level security;
revoke all on public.billing_customers from anon, authenticated;
