import { admin, stripe, corsHeaders, json, requireUser, liveSubscription } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  try {
    const user = await requireUser(req);
    if (!user) return json(req, { error: "Neautentificat" }, 401);

    const sub = await liveSubscription(user.id);   // căutat după user.id din JWT, nu din request
    if (!sub?.provider_subscription_id) return json(req, { error: "Nu ai un abonament activ" }, 404);

    // Anulează la sfârșitul perioadei plătite — accesul rămâne până atunci
    await stripe.subscriptions.update(sub.provider_subscription_id, { cancel_at_period_end: true });
    await admin.from("subscriptions")
      .update({ cancel_at_period_end: true, canceled_at: new Date().toISOString() })
      .eq("id", sub.id);

    return json(req, { ok: true });
  } catch (e) {
    console.error(e);
    return json(req, { error: "Nu am putut anula abonamentul" }, 500);
  }
});
