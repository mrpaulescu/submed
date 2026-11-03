import { admin, stripe, json, corsHeaders, requireUser, liveSubscription } from "../_shared/stripe.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Metodă neacceptată" }, 405);
  try {
    const user = await requireUser(req);
    if (!user) return json(req, { error: "Neautentificat" }, 401);
    const sub = await liveSubscription(user.id);
    if (!sub?.provider_subscription_id) return json(req, { error: "Nu ai un abonament Stripe activ" }, 404);
    const updated = await stripe.subscriptions.update(sub.provider_subscription_id, { cancel_at_period_end: true });
    const item = updated.items.data[0] as any;
    const periodEnd = (updated as any).current_period_end ?? item?.current_period_end;
    const { error } = await admin.from("subscriptions").update({
      cancel_at_period_end: true, canceled_at: new Date().toISOString(),
      ...(periodEnd ? { expires_at: new Date(periodEnd * 1000).toISOString() } : {}),
    }).eq("id", sub.id).eq("user_id", user.id);
    if (error) throw error;
    return json(req, { ok: true });
  } catch (error) {
    console.error("cancel-subscription failed", error);
    return json(req, { error: "Nu am putut anula reînnoirea" }, 500);
  }
});
