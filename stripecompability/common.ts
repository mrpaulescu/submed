import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

export const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
export const SITE = Deno.env.get("SITE_URL") ?? "https://www.submed.ro";

// Prețurile vin DOAR de pe server — clientul trimite numai „basic” / „premium”.
export const PRICES: Record<string, string | undefined> = {
  basic: Deno.env.get("STRIPE_PRICE_BASIC"),
  premium: Deno.env.get("STRIPE_PRICE_PREMIUM"),
};
export const tierFromPrice = (priceId?: string) =>
  Object.entries(PRICES).find(([, id]) => id && id === priceId)?.[0];

export const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ALLOWED = [SITE, "https://submed.ro", "https://www.submed.ro"];
export function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : ALLOWED[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
export const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });

export async function requireUser(req: Request) {
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const { data: { user } } = await client.auth.getUser();
  return user;
}

export async function getOrCreateCustomer(user: { id: string; email?: string }) {
  const { data } = await admin.from("billing_customers")
    .select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
  if (data?.stripe_customer_id) return data.stripe_customer_id as string;

  const customer = await stripe.customers.create(
    { email: user.email, metadata: { user_id: user.id } },
    { idempotencyKey: `cust-${user.id}` },
  );
  await admin.from("billing_customers")
    .upsert({ user_id: user.id, stripe_customer_id: customer.id });
  return customer.id;
}

export async function liveSubscription(userId: string) {
  const { data } = await admin.from("subscriptions").select("*")
    .eq("user_id", userId).eq("provider", "stripe")
    .in("status", ["active", "trialing", "past_due"])
    .order("started_at", { ascending: false }).limit(1).maybeSingle();
  return data;
}
