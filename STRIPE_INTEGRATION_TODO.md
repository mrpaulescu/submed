# SubMed Stripe integration — checklist

Status: implementation scaffold committed to a feature branch; **not deployed and not validated in Stripe test mode**. Do not enable live payments before all test-mode checks pass.

## Confirmed decisions
- Static HTML/CSS/JS frontend on cPanel; Supabase Edge Functions provide server-side Stripe access.
- Monthly recurring flat-rate subscriptions, no trial.
- Hosted Stripe Checkout for new subscriptions.
- Custom SubMed account UI for cancellation, plan changes and payment-method updates; no Customer Portal.
- Automatic tax disabled pending Romanian accounting review; promo codes disabled.
- Paid access is controlled by verified Stripe webhooks, never the success redirect.

## Code added
- [ ] Apply `supabase/migrations/20261103090000_stripe_subscriptions.sql` after reviewing it against the deployed schema.
- [ ] Deploy `create-checkout`, `cancel-subscription`, `update-payment-method`, and `stripe-webhook` Edge Functions.
- [ ] Configure Supabase secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PREMIUM`, `SITE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Create monthly Basic/Premium prices in Stripe **test mode** and configure the test price IDs.
- [ ] Create test webhook at `https://<project-ref>.supabase.co/functions/v1/stripe-webhook` for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
- [ ] Disable JWT verification only for the webhook endpoint; signature verification in code remains mandatory.
- [ ] Wire `user.html` payment-method button to `update-payment-method`; verify `preturi.html` invokes `create-checkout`.
- [ ] Check RLS on subscriptions/payments and ensure premium feature gates are server-authoritative where applicable.

## Test-mode acceptance
- [ ] Basic and Premium Checkout create exactly one Stripe subscription and one matching database row.
- [ ] Replayed webhook delivery is safe and does not duplicate subscription/payment rows.
- [ ] User A cannot view or mutate User B's subscription/customer/payment method.
- [ ] Failed payment does not grant paid access; invoice.paid records payment.
- [ ] Cancel-at-period-end retains access until the paid-through date.
- [ ] Plan change updates existing subscription rather than creating a second one.
- [ ] Setup Checkout updates the Stripe customer's default payment method after verified webhook.
- [ ] Test mobile layout, redirects, invoice/payment history, function logs, and RLS.
- [ ] Verify entitlement gating across every premium feature.

## Before live launch
- [ ] Romanian accountant confirms invoice/fiscal document workflow, VAT treatment and any OSS/consumer obligations.
- [ ] Create live products/prices and a live webhook only after test-mode acceptance.
- [ ] Keep live keys exclusively in Supabase secrets; never commit them.
- [ ] Confirm business verification, payout bank details, refund/dispute handling, cancellation policy, support contact, terms and privacy disclosures.
- [ ] Make a small live transaction only after explicit approval and verify payment, access, cancellation and records end-to-end.

## Review caveats
- The original schema only allowed tier `free/premium` and statuses `active/expired/cancelled`; the migration expands these for Basic/Premium and Stripe lifecycle statuses.
- Prototype code in `stripecompability/` is retained for reference; deployable Edge Functions are placed under `supabase/functions/`.
- This branch has not been deployed; no Stripe products/prices or live changes have been created.
