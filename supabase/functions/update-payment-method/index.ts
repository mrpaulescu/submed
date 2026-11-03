import { SITE, stripe, json, corsHeaders, requireUser, getOrCreateCustomer } from "../_shared/stripe.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Metodă neacceptată" }, 405);
  try {
    const user = await requireUser(req);
    if (!user) return json(req, { error: "Neautentificat" }, 401);
    const customer = await getOrCreateCustomer(user);
    const session = await stripe.checkout.sessions.create({
      mode: "setup", ui_mode: "hosted", customer, currency: "ron",
      payment_method_types: ["card"], billing_address_collection: "auto", locale: "ro",
      success_url: SITE + "/user.html?payment_method=updated#abonament",
      cancel_url: SITE + "/user.html#abonament",
      setup_intent_data: { metadata: { user_id: user.id } },
      metadata: { user_id: user.id, integration_identifier: "hosted_web_0001", origin_context: "web" },
    });
    if (!session.url) return json(req, { error: "Stripe nu a returnat un URL" }, 502);
    return json(req, { url: session.url });
  } catch (error) {
    console.error("update-payment-method failed", error);
    return json(req, { error: "Nu am putut deschide actualizarea metodei de plată" }, 500);
  }
});
