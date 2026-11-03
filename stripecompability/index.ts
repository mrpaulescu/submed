import { SITE, PRICES, stripe, corsHeaders, json, requireUser, getOrCreateCustomer, liveSubscription } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  try {
    const user = await requireUser(req);
    if (!user) return json(req, { error: "Neautentificat" }, 401);

    const { tier } = await req.json().catch(() => ({}));
    const price = PRICES[tier as string];
    if (!price) return json(req, { error: "Plan invalid" }, 400);

    const customer = await getOrCreateCustomer(user);

    // Are deja abonament activ → nu creăm unul al doilea; îl trimitem în portal (schimbare plan)
    if (await liveSubscription(user.id)) {
      const portal = await stripe.billingPortal.sessions.create({
        customer, return_url: `${SITE}/user.html#abonament`,
      });
      return json(req, { url: portal.url });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: user.id,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      locale: "ro",
      success_url: `${SITE}/user.html?checkout=success#abonament`,
      cancel_url: `${SITE}/preturi.html`,
      subscription_data: { metadata: { user_id: user.id, tier } },
    });
    return json(req, { url: session.url });
  } catch (e) {
    console.error(e);
    return json(req, { error: "Eroare la crearea plății" }, 500);
  }
});
