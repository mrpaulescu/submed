import Stripe from "npm:stripe@17";
import { admin, stripe, tierFromPrice } from "../_shared/common.ts";

// Starea Stripe → starea din tabelul tău (CHECK: active/trialing/past_due/canceled/expired)
const STATUS: Record<string, string | null> = {
  active: "active", trialing: "trialing", past_due: "past_due",
  canceled: "canceled", unpaid: "expired", incomplete_expired: "expired",
  paused: "expired", incomplete: null,        // null = ignorăm până devine activ
};
const LIVE = ["active", "trialing", "past_due"];
const iso = (s?: number | null) => (s ? new Date(s * 1000).toISOString() : null);
const idOf = (x: any) => (typeof x === "string" ? x : x?.id);

async function userIdForCustomer(customerId: string) {
  const { data } = await admin.from("billing_customers")
    .select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
  return data?.user_id as string | undefined;
}

async function syncSubscription(sub: Stripe.Subscription) {
  const status = STATUS[sub.status];
  if (!status) return;

  const userId = sub.metadata?.user_id || await userIdForCustomer(idOf(sub.customer));
  if (!userId) throw new Error(`Fără user pentru subscripția ${sub.id}`);

  const item = sub.items.data[0];
  const tier = sub.metadata?.tier || tierFromPrice(item?.price.id);
  if (!tier) throw new Error(`Tier necunoscut pentru price ${item?.price.id}`);

  // Stripe a mutat current_period_end pe item în API-urile noi; le acoperim pe ambele
  const periodEnd = (sub as any).current_period_end ?? (item as any)?.current_period_end;

  const row = {
    user_id: userId, tier, status,
    started_at: iso(sub.start_date),
    expires_at: iso(periodEnd),
    cancel_at_period_end: sub.cancel_at_period_end,
    canceled_at: iso(sub.canceled_at),
    provider: "stripe", provider_subscription_id: sub.id,
  };

  // Indexul „un singur abonament viu” → închidem eventualele alte rânduri vii ale userului
  if (LIVE.includes(status)) {
    await admin.from("subscriptions").update({ status: "expired" })
      .eq("user_id", userId).in("status", LIVE).neq("provider_subscription_id", sub.id);
    await admin.from("subscriptions").update({ status: "expired" })
      .eq("user_id", userId).in("status", LIVE).is("provider_subscription_id", null);
  }

  const { data: existing } = await admin.from("subscriptions").select("id")
    .eq("provider_subscription_id", sub.id).maybeSingle();
  const { error } = existing
    ? await admin.from("subscriptions").update(row).eq("id", existing.id)
    : await admin.from("subscriptions").insert(row);
  if (error) throw error;
}

async function recordInvoice(inv: Stripe.Invoice, paid: boolean) {
  const userId = await userIdForCustomer(idOf(inv.customer));
  if (!userId) throw new Error(`Fără user pentru factura ${inv.id}`);

  const stripeSubId = (inv as any).subscription ?? (inv as any).parent?.subscription_details?.subscription;
  let subscriptionId: string | null = null;
  if (stripeSubId) {
    const { data } = await admin.from("subscriptions").select("id")
      .eq("provider_subscription_id", idOf(stripeSubId)).maybeSingle();
    subscriptionId = data?.id ?? null;
  }

  const row = {
    user_id: userId, subscription_id: subscriptionId,
    provider: "stripe", provider_ref: inv.id,
    amount: (paid ? inv.amount_paid : inv.amount_due) / 100,
    currency: inv.currency.toUpperCase(),
    status: paid ? "paid" : "failed",
  };
  const { data: existing } = await admin.from("payments").select("id")
    .eq("provider", "stripe").eq("provider_ref", inv.id).maybeSingle();
  const { error } = existing
    ? await admin.from("payments").update(row).eq("id", existing.id)
    : await admin.from("payments").insert(row);
  if (error) throw error;
}

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body, sig!, Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
      undefined, Stripe.createSubtleCryptoProvider(),
    );
  } catch {
    return new Response("Semnătură invalidă", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode === "subscription" && s.subscription)
          await syncSubscription(await stripe.subscriptions.retrieve(idOf(s.subscription)));
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case "invoice.paid":
        await recordInvoice(event.data.object as Stripe.Invoice, true);
        break;
      case "invoice.payment_failed":
        await recordInvoice(event.data.object as Stripe.Invoice, false);
        break;
    }
  } catch (e) {
    console.error(event.type, e);
    return new Response("Eroare procesare", { status: 500 });   // Stripe reîncearcă automat
  }
  return new Response("ok");
});
