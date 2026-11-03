import { SITE, PRICES, stripe, json, corsHeaders, requireUser, getOrCreateCustomer, liveSubscription } from "../_shared/stripe.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Metodă neacceptată" }, 405);
  try {
    const user = await requireUser(req);
    if (!user) return json(req, { error: "Neautentificat" }, 401);
    const body = await req.json().catch(() => ({}));
    const tier = typeof body?.tier === "string" ? body.tier : "";
    const price = PRICES[tier];
    if (!price || !["basic", "premium"].includes(tier)) return json(req, { error: "Plan invalid sau preț Stripe neconfigurat" }, 400);
    const customer = await getOrCreateCustomer(user);
    const current = await liveSubscription(user.id);
    if (current?.provider_subscription_id) {
      const sub = await stripe.subscriptions.retrieve(current.provider_subscription_id);
      const item = sub.items.data[0];
      if (!item) return json(req, { error: "Abonamentul nu are un articol de preț" }, 409);
      if (item.price.id !== price) await stripe.subscriptions.update(sub.id, {
        items: [{ id: item.id, price }],
        proration_behavior: "create_prorations",
        metadata: { user_id: user.id, tier },
      });
      return json(req, { url: SITE + "/user.html?plan=updated#abonament" });
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription", ui_mode: "hosted", customer, client_reference_id: user.id,
      line_items: [{ price, quantity: 1 }],
      billing_address_collection: "auto",
      phone_number_collection: { enabled: false },
      automatic_tax: { enabled: false },
      allow_promotion_codes: false,
      payment_method_collection: "always",
      submit_type: "auto",
      locale: "ro",
      success_url: SITE + "/user.html?checkout=success#abonament",
      cancel_url: SITE + "/preturi.html",
      subscription_data: { metadata: { user_id: user.id, tier } },
      metadata: { user_id: user.id, tier, integration_identifier: "hosted_web_0001", origin_context: "web" },
    });
    if (!session.url) return json(req, { error: "Stripe nu a returnat un URL de plată" }, 502);
    return json(req, { url: session.url });
  } catch (error) {
    console.error("create-checkout failed", error);
    return json(req, { error: "Nu am putut iniția plata. Încearcă din nou." }, 500);
  }
});
