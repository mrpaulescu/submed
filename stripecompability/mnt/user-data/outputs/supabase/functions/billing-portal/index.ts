import { SITE, stripe, corsHeaders, json, requireUser, admin } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  try {
    const user = await requireUser(req);
    if (!user) return json(req, { error: "Neautentificat" }, 401);

    const { data } = await admin.from("billing_customers")
      .select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
    if (!data) return json(req, { error: "Nu ai încă plăți înregistrate" }, 404);

    const portal = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${SITE}/user.html#abonament`,
    });
    return json(req, { url: portal.url });
  } catch (e) {
    console.error(e);
    return json(req, { error: "Eroare la deschiderea portalului" }, 500);
  }
});
