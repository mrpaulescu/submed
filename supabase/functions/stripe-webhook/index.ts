import Stripe from "npm:stripe@17";
import { admin, stripe, tierFromPrice } from "../_shared/stripe.ts";
const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const STATUS: Record<string, string | null> = { active: "active", trialing: "trialing", past_due: "past_due", canceled: "canceled", unpaid: "expired", incomplete_expired: "expired", paused: "expired", incomplete: null };
const LIVE = ["active", "trialing", "past_due"];
const iso = (s?: number | null) => s ? new Date(s * 1000).toISOString() : null;
const idOf = (v: any) => typeof v === "string" ? v : v?.id;
async function userForCustomer(customerId: string) {
  const { data, error } = await admin.from("billing_customers").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
  if (error) throw error;
  return data?.user_id as string | undefined;
}
async function syncSubscription(sub: Stripe.Subscription) {
  const status = STATUS[sub.status];
  if (!status) return;
  const customerId = idOf(sub.customer);
  const userId = sub.metadata?.user_id || (customerId ? await userForCustomer(customerId) : undefined);
  if (!userId) throw new Error("Utilizator lipsă pentru " + sub.id);
  const item = sub.items.data[0];
  const tier = sub.metadata?.tier || tierFromPrice(item?.price.id);
  if (!tier) throw new Error("Tier necunoscut pentru " + sub.id);
  const periodEnd = (sub as any).current_period_end ?? (item as any)?.current_period_end;
  const row = { user_id: userId, tier, status, started_at: iso(sub.start_date) ?? new Date().toISOString(), expires_at: iso(periodEnd), cancel_at_period_end: sub.cancel_at_period_end, canceled_at: iso(sub.canceled_at), provider: "stripe", provider_subscription_id: sub.id };
  if (LIVE.includes(status)) {
    const { error } = await admin.from("subscriptions").update({ status: "expired" }).eq("user_id", userId).in("status", LIVE).neq("provider_subscription_id", sub.id);
    if (error) throw error;
    const { error: legacyError } = await admin.from("subscriptions").update({ status: "expired" }).eq("user_id", userId).in("status", LIVE).is("provider_subscription_id", null);
    if (legacyError) throw legacyError;
  }
  const { data: existing, error: findError } = await admin.from("subscriptions").select("id").eq("provider_subscription_id", sub.id).maybeSingle();
  if (findError) throw findError;
  const result = existing ? await admin.from("subscriptions").update(row).eq("id", existing.id) : await admin.from("subscriptions").insert(row);
  if (result.error) throw result.error;
}
async function recordInvoice(inv: Stripe.Invoice, paid: boolean) {
  const customerId = idOf(inv.customer);
  const userId = customerId ? await userForCustomer(customerId) : undefined;
  if (!userId) throw new Error("Utilizator lipsă pentru factura " + inv.id);
  const subscriptionRef = (inv as any).subscription ?? (inv as any).parent?.subscription_details?.subscription;
  let subscriptionId: string | null = null;
  if (subscriptionRef) {
    const { data, error } = await admin.from("subscriptions").select("id").eq("provider_subscription_id", idOf(subscriptionRef)).maybeSingle();
    if (error) throw error;
    subscriptionId = data?.id ?? null;
  }
  const row = { user_id: userId, subscription_id: subscriptionId, provider: "stripe", provider_ref: inv.id, amount: (paid ? inv.amount_paid : inv.amount_due) / 100, currency: inv.currency.toUpperCase(), status: paid ? "paid" : "failed" };
  const { data: existing, error: findError } = await admin.from("payments").select("id").eq("provider", "stripe").eq("provider_ref", inv.id).maybeSingle();
  if (findError) throw findError;
  const result = existing ? await admin.from("payments").update(row).eq("id", existing.id) : await admin.from("payments").insert(row);
  if (result.error) throw result.error;
}
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const signature = req.headers.get("stripe-signature");
  if (!signature || !secret) return new Response("Webhook not configured", { status: 400 });
  const rawBody = await req.text();
  let event: Stripe.Event;
  try { event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret, undefined, Stripe.createSubtleCryptoProvider()); }
  catch { return new Response("Semnătură invalidă", { status: 400 }); }
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) await syncSubscription(await stripe.subscriptions.retrieve(idOf(session.subscription)));
        if (session.mode === "setup" && session.setup_intent && session.customer) {
          const setup = await stripe.setupIntents.retrieve(idOf(session.setup_intent));
          const paymentMethod = idOf(setup.payment_method);
          if (setup.status === "succeeded" && paymentMethod) await stripe.customers.update(idOf(session.customer), { invoice_settings: { default_payment_method: paymentMethod } });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": await syncSubscription(event.data.object as Stripe.Subscription); break;
      case "invoice.paid": await recordInvoice(event.data.object as Stripe.Invoice, true); break;
      case "invoice.payment_failed": await recordInvoice(event.data.object as Stripe.Invoice, false); break;
    }
  } catch (error) {
    console.error("stripe-webhook failed", event.id, event.type, error);
    return new Response("Eroare procesare", { status: 500 });
  }
  return new Response("ok");
});
